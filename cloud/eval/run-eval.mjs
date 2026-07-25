#!/usr/bin/env node
/**
 * Search-lab evaluation harness.
 *
 * Commands:
 *   probe                       Check which embedding models answer, and how they score a
 *                               known cross-language pair.
 *   stats                       Corpus and chunk statistics for the deployed instance.
 *   seed [--dataset name] [--no-enqueue]
 *                               Insert base, visible, or full local corpora.
 *   cleanup [--prune-cache]     Hard-delete the [EVAL:*] corpus (and optionally the cache).
 *   sweep [options]             Run golden queries against strategy presets and record raw JSON.
 *   live [options]              Score deployed semantic retrieval only; this bypasses
 *                               the lexical-first API gate.
 *   report [file] [--thresholds]  Score a recorded sweep; optionally grid-search thresholds.
 *
 * sweep options:
 *   --preset a,b       Strategy presets from strategies.json (default: all)
 *   --scenario s       Only golden queries whose scenario contains this string
 *   --query s          Only golden queries whose text contains this string
 *   --corpus all|eval|real (default: eval)
 *   --suite name        Suite from dataset-manifest.mjs (default: visible-calibration)
 *   --confirm-blind-final
 *                       Required before opening/running the final blind suite
 *   --label name       Output file label
 *
 * Environment: NOTESFLASH_LAB_URL, NOTESFLASH_LAB_TOKEN (or cloud/.lab-token.local).
 */
import { createHash } from "node:crypto";
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { callLab } from "./lab-client.mjs";
import {
  CORPUS_SETS,
  corpusFilesForSet,
  SUITE_ALIASES,
  SUITES,
} from "./dataset-manifest.mjs";
import {
  byScenario,
  corpusIndex,
  evaluateQuery,
  expectedLineNumber,
  formatRatio,
  formatScore,
  markdownTable,
  RAW_CANDIDATE_DEPTH,
  rescore,
  summarize,
} from "./metrics.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(here, "out");
const QUERIES_PER_REQUEST = 6;

function loadJson(name) {
  return JSON.parse(readFileSync(resolve(here, name), "utf8"));
}

function hashFiles(files) {
  const hash = createHash("sha256");
  for (const file of files) {
    const bytes = readFileSync(resolve(here, file));
    hash.update(`${file.length}:${file}\0${bytes.length}:`);
    hash.update(bytes);
    hash.update("\0");
  }
  return hash.digest("hex");
}

function loadCorpusSet(name) {
  const files = corpusFilesForSet(name);
  return {
    name,
    files,
    hash: hashFiles(files),
    notes: files.flatMap((file) => loadJson(file).notes ?? []),
  };
}

export function suiteName(args, fallback = "visible-calibration") {
  const requested = typeof args.flags.suite === "string" ? args.flags.suite : fallback;
  const canonical = SUITE_ALIASES[requested] ?? requested;
  const suite = SUITES[canonical];
  if (!suite) {
    throw new Error(
      `Unknown suite "${requested}". Available: ${Object.keys(SUITES).join(", ")}`,
    );
  }
  if (suite.protected && args.flags["confirm-blind-final"] !== true) {
    throw new Error(
      `Suite "${canonical}" is protected. Re-run with --confirm-blind-final only for the one-time final release audit.`,
    );
  }
  if (suite.frozen) {
    const forbiddenFilter = ["query", "scenario"].find((flag) =>
      typeof args.flags[flag] === "string"
    );
    if (forbiddenFilter) {
      throw new Error(
        `Suite "${canonical}" is frozen; --${forbiddenFilter} would reveal a filtered slice and is not allowed.`,
      );
    }
  }
  if (
    args.flags.thresholds === true &&
    (suite.frozen || suite.allowThresholdGrid === false)
  ) {
    throw new Error(
      `Suite "${canonical}" cannot be used for threshold selection. Use a calibration or regression suite.`,
    );
  }
  return canonical;
}

function loadGoldenSuite(name) {
  const definition = SUITES[name];
  if (!definition) throw new Error(`Unknown suite "${name}".`);
  const sources = definition.queryFiles.map((file) => ({ file, data: loadJson(file) }));
  return {
    name,
    role: definition.role,
    corpusSet: definition.corpusSet,
    sourceFiles: sources.map((source) => source.file),
    hash: hashFiles(sources.map((source) => source.file)),
    queries: sources.flatMap((source) => source.data.queries ?? []),
  };
}

function parseArgs(argv) {
  const args = { command: argv[0] ?? "help", flags: {}, positional: [] };
  for (let index = 1; index < argv.length; index += 1) {
    const value = argv[index];
    if (!value.startsWith("--")) {
      args.positional.push(value);
      continue;
    }
    const name = value.slice(2);
    const next = argv[index + 1];
    if (next === undefined || next.startsWith("--")) {
      args.flags[name] = true;
    } else {
      args.flags[name] = next;
      index += 1;
    }
  }
  return args;
}

function chunked(items, size) {
  const batches = [];
  for (let offset = 0; offset < items.length; offset += size) {
    batches.push(items.slice(offset, offset + size));
  }
  return batches;
}

function evalTitle(note) {
  return `[EVAL:${note.key}] ${note.title}`;
}

async function commandProbe(args) {
  const models = typeof args.flags.models === "string" ? args.flags.models.split(",") : undefined;
  const { payload, elapsedMs } = await callLab({ action: "probe", models });
  const rows = payload.probes.map((probe) => [
    probe.model,
    probe.ok ? "ok" : "FAIL",
    probe.dimensions ?? "-",
    `${probe.latencyMs}ms`,
    formatScore(probe.crossLanguageDocumentSimilarity),
    formatScore(probe.queryToChineseDocument),
    formatScore(probe.queryToEnglishDocument),
    formatScore(probe.queryToUnrelatedDocument),
    probe.error ?? "",
  ]);
  console.log(
    markdownTable(
      ["model", "state", "dims", "latency", "zh~en doc", "q>zh", "q>en", "q>noise", "error"],
      rows,
    ),
  );
  console.log(`\ntotal ${elapsedMs}ms`);
}

async function commandStats() {
  const { payload } = await callLab({ action: "corpus-stats" });
  console.log(JSON.stringify(payload, null, 2));
}

async function commandSeed(args) {
  const dataset = typeof args.flags.dataset === "string" ? args.flags.dataset : "base";
  if (!CORPUS_SETS[dataset]) {
    throw new Error(
      `Unknown dataset "${dataset}". Available: ${Object.keys(CORPUS_SETS).join(", ")}`,
    );
  }
  const corpus = loadCorpusSet(dataset);
  const enqueue = args.flags["no-enqueue"] !== true;
  let inserted = 0;
  let replaced = 0;
  let enqueued = 0;

  for (const batch of chunked(corpus.notes, 50)) {
    const { payload } = await callLab({
      action: "seed",
      enqueue,
      notes: batch.map((note) => ({ title: evalTitle(note), body: note.body })),
    });
    inserted += payload.inserted;
    replaced += payload.replaced;
    enqueued += payload.enqueued;
    console.log(`seeded ${payload.inserted} notes (replaced ${payload.replaced})`);
  }
  console.log(
    `\ndataset=${dataset} hash=${corpus.hash} files=${corpus.files.length} notes=${corpus.notes.length} ` +
      `inserted=${inserted} replaced=${replaced} enqueued=${enqueued}`,
  );
}

async function commandCleanup(args) {
  const { payload } = await callLab({
    action: "cleanup",
    pruneCache: args.flags["prune-cache"] === true,
  });
  console.log(JSON.stringify(payload, null, 2));
}

function selectPresets(args) {
  const { presets } = loadJson("strategies.json");
  const requested = typeof args.flags.preset === "string"
    ? args.flags.preset.split(",").map((name) => name.trim())
    : Object.keys(presets);
  return requested.map((name) => {
    const preset = presets[name];
    if (!preset) {
      throw new Error(`Unknown preset "${name}". Available: ${Object.keys(presets).join(", ")}`);
    }
    const { note, ...strategy } = preset;
    return { name, ...strategy };
  });
}

function selectQueries(args, golden) {
  return golden.queries.filter((entry) => {
    if (typeof args.flags.scenario === "string" && !entry.scenario.includes(args.flags.scenario)) {
      return false;
    }
    if (typeof args.flags.query === "string" && !entry.query.includes(args.flags.query)) {
      return false;
    }
    return true;
  });
}

async function commandSweep(args) {
  const golden = loadGoldenSuite(suiteName(args));
  const expectedCorpus = loadCorpusSet(golden.corpusSet);
  const strategies = selectPresets(args);
  const queries = selectQueries(args, golden);
  if (queries.length === 0) throw new Error("No golden queries matched the filters.");

  const corpus = typeof args.flags.corpus === "string" ? args.flags.corpus : "eval";
  const record = {
    createdAt: new Date().toISOString(),
    suite: golden.name,
    suiteRole: golden.role,
    suiteHash: golden.hash,
    expectedCorpusSet: golden.corpusSet,
    corpusHash: expectedCorpus.hash,
    corpusFiles: expectedCorpus.files,
    suiteFiles: golden.sourceFiles,
    goldenQueryCount: golden.queries.length,
    selectedQueries: queries.map((entry) => entry.query),
    rawCandidateDepth: RAW_CANDIDATE_DEPTH,
    corpus,
    strategies: {},
    requests: [],
  };

  for (const strategy of strategies) {
    console.log(`\n== ${strategy.name} (${strategy.model ?? "default"})`);
    for (const batch of chunked(queries, QUERIES_PER_REQUEST)) {
      const { payload, elapsedMs } = await callLab({
        action: "sweep",
        corpus,
        queries: batch.map((entry) => entry.query),
        strategies: [strategy],
      });
      const report = payload.strategies[0];
      const bucket = record.strategies[strategy.name] ?? {
        name: strategy.name,
        model: report.model,
        dimensions: report.dimensions,
        instruction: report.instruction,
        chunking: report.chunking,
        aggregation: report.aggregation,
        shortQueryRescue: report.shortQueryRescue ?? null,
        chunkCount: report.chunkCount,
        noteCount: payload.noteCount,
        queries: {},
      };
      for (const queryReport of report.queries) bucket.queries[queryReport.query] = queryReport;
      record.strategies[strategy.name] = bucket;
      record.requests.push({
        strategy: strategy.name,
        queries: batch.length,
        elapsedMs,
        aiCalls: report.aiCalls,
        cacheHits: report.cacheHits,
        embeddedTexts: report.embeddedTexts,
        timings: report.timings,
      });
      console.log(
        `  ${batch.length} queries in ${elapsedMs}ms (aiCalls=${report.aiCalls} cacheHits=${report.cacheHits} chunks=${report.chunkCount})`,
      );
    }
  }

  mkdirSync(OUT_DIR, { recursive: true });
  const label = typeof args.flags.label === "string" ? args.flags.label : "sweep";
  const file = resolve(OUT_DIR, `${new Date().toISOString().replace(/[:.]/g, "-")}-${label}.json`);
  writeFileSync(file, JSON.stringify(record, null, 2));
  console.log(`\nwrote ${file}`);
  reportRecord(record, golden, args);
}

async function commandLive(args) {
  const golden = loadGoldenSuite(suiteName(args));
  const expectedCorpus = loadCorpusSet(golden.corpusSet);
  const queries = selectQueries(args, golden);
  if (queries.length === 0) throw new Error("No golden queries matched the filters.");

  const record = {
    createdAt: new Date().toISOString(),
    suite: golden.name,
    suiteRole: golden.role,
    suiteHash: golden.hash,
    expectedCorpusSet: golden.corpusSet,
    corpusHash: expectedCorpus.hash,
    corpusFiles: expectedCorpus.files,
    suiteFiles: golden.sourceFiles,
    goldenQueryCount: golden.queries.length,
    selectedQueries: queries.map((entry) => entry.query),
    rawCandidateDepth: RAW_CANDIDATE_DEPTH,
    corpus: "live",
    strategies: {},
    requests: [],
  };

  console.log(
    "== live semantic retrieval-only diagnostic " +
      "(/api/search/semantic internals; not the lexical-first API)",
  );
  for (const batch of chunked(queries, QUERIES_PER_REQUEST)) {
    const { payload, elapsedMs } = await callLab({
      action: "live",
      queries: batch.map((entry) => entry.query),
    });
    const bucket = record.strategies["live-retrieval-only"] ?? {
      name: "live-retrieval-only",
      model: payload.embeddingModel,
      dimensions: payload.embeddingDimensions,
      instruction: null,
      chunking: payload.chunking,
      aggregation: payload.aggregation,
      chunkCount: null,
      queries: {},
    };
    for (const queryReport of payload.queries) {
      bucket.queries[queryReport.query] = queryReport;
    }
    record.strategies["live-retrieval-only"] = bucket;
    record.requests.push({ strategy: "live-retrieval-only", queries: batch.length, elapsedMs });
    const latencies = payload.queries.map((entry) => entry.elapsedMs);
    console.log(
      `  ${batch.length} queries in ${elapsedMs}ms (per-query ${Math.min(...latencies)}-${Math.max(...latencies)}ms)`,
    );
  }

  mkdirSync(OUT_DIR, { recursive: true });
  const file = resolve(OUT_DIR, `${new Date().toISOString().replace(/[:.]/g, "-")}-live.json`);
  writeFileSync(file, JSON.stringify(record, null, 2));
  console.log(`\nwrote ${file}`);

  const latencies = Object.values(record.strategies["live-retrieval-only"].queries)
    .map((entry) => entry.elapsedMs)
    .sort((left, right) => left - right);
  console.log(
    `latency p50=${latencies[Math.floor(latencies.length / 2)]}ms ` +
      `p95=${latencies[Math.min(latencies.length - 1, Math.floor(latencies.length * 0.95))]}ms ` +
      `max=${latencies[latencies.length - 1]}ms`,
  );
  reportRecord(record, golden, args);
}

function latestRecord() {
  const files = readdirSync(OUT_DIR)
    .filter((name) => name.endsWith(".json"))
    .sort();
  if (files.length === 0) throw new Error(`No sweep output found in ${OUT_DIR}`);
  return resolve(OUT_DIR, files[files.length - 1]);
}

function scoreStrategy(bucket, golden, corpus, overrides, candidateCaptureLimit) {
  return golden.queries
    .filter((entry) => bucket.queries[entry.query] !== undefined)
    .map((entry) => {
      const queryReport = bucket.queries[entry.query];
      const results = overrides
        ? rescore(queryReport.rankedChunks ?? [], { ...bucket.aggregation, ...overrides })
        : queryReport.results;
      return evaluateQuery({
        golden: entry,
        results,
        rankedChunks: queryReport.rankedChunks ?? [],
        candidateUniverseSize:
          queryReport.candidateUniverseSize ??
          bucket.chunkCount ??
          null,
        candidateCaptureLimit,
        corpus,
      });
    });
}

function warnIfPartial(record, golden) {
  for (const bucket of Object.values(record.strategies)) {
    const present = new Set(Object.keys(bucket.queries));
    const missing = golden.queries
      .map((entry, index) => ({ query: entry.query, index }))
      .filter((entry) => !present.has(entry.query));
    if (missing.length === 0) continue;
    const captured = golden.queries.length - missing.length;
    const preview = missing.slice(0, 8).map((entry) =>
      golden.role === "blind-final" ? `query-index-${entry.index}` : JSON.stringify(entry.query)
    ).join(", ");
    const suffix = missing.length > 8 ? `, and ${missing.length - 8} more` : "";
    console.error(
      `\nWARNING: partial golden run for ${bucket.name}: ` +
        `${captured}/${golden.queries.length} suite queries captured; ` +
        `${missing.length} missing (${preview}${suffix}). ` +
        "Do not compare these aggregate metrics with a complete run.",
    );
  }
}

export function assertRecordHashes(record, golden, corpusArtifact) {
  if (typeof record.suiteHash !== "string" || typeof record.corpusHash !== "string") {
    throw new Error(
      "Recorded evaluation has no suite/corpus hashes and cannot be verified. Re-run it with the current harness.",
    );
  }
  if (record.suiteHash !== golden.hash) {
    throw new Error(
      `Suite hash drift for ${golden.name}: record=${record.suiteHash} current=${golden.hash}. ` +
        "Do not report metrics from changed queries.",
    );
  }
  if (record.corpusHash !== corpusArtifact.hash) {
    throw new Error(
      `Corpus hash drift for ${golden.corpusSet}: record=${record.corpusHash} current=${corpusArtifact.hash}. ` +
        "Do not report metrics from changed notes.",
    );
  }
}

export function bucketUsesConsensusRescue(bucket) {
  if (bucket.shortQueryRescue?.enabled === true) return true;
  return Object.values(bucket.queries ?? {}).some((queryReport) =>
    queryReport?.shortQueryRescue?.attempted === true ||
    queryReport?.shortQueryRescue?.applied === true
  );
}

export function assertThresholdReplaySafe(record) {
  if (record.corpus === "live") {
    throw new Error(
      "Threshold grids require an in-request sweep record; live retrieval records cannot be replayed exactly.",
    );
  }
  const consensusBucket = Object.values(record.strategies).find(bucketUsesConsensusRescue);
  if (consensusBucket) {
    throw new Error(
      `Threshold grid refused for ${consensusBucket.name}: short-query consensus rescue was enabled, ` +
        "and raw-only rescore() cannot reproduce its expanded-view ranking exactly.",
    );
  }
}

function reportRecord(record, golden, args) {
  const corpusArtifact = loadCorpusSet(golden.corpusSet);
  assertRecordHashes(record, golden, corpusArtifact);
  if (args.flags.thresholds === true) {
    assertThresholdReplaySafe(record);
  }
  const corpus = corpusIndex(corpusArtifact);
  warnIfPartial(record, golden);
  const missing = golden.queries.flatMap((entry, queryIndex) =>
    (entry.expect ?? [])
      .filter((expectation) =>
        expectedLineNumber(corpus.get(expectation.key), expectation.lineIncludes) === null
      )
      .map((expectation) => golden.role === "blind-final"
        ? `query-index-${queryIndex} -> ${expectation.key}: <line redacted>`
        : `${entry.query} -> ${expectation.key}: "${expectation.lineIncludes}"`)
  );
  if (missing.length > 0) {
    console.error("\nGolden expectations that no longer match the corpus:");
    for (const item of missing) console.error(`  ${item}`);
  }

  const summaryRows = [];
  const perStrategyRows = [];
  for (const bucket of Object.values(record.strategies)) {
    const rows = scoreStrategy(bucket, golden, corpus, null, record.rawCandidateDepth ?? null);
    const summary = summarize(rows);
    summaryRows.push([
      bucket.name,
      String(bucket.model ?? "-").replace("@cf/", ""),
      bucket.chunkCount,
      `${formatRatio(summary.candidateRecall40)}${summary.incompleteCandidateCaptures > 0 ? "*" : ""}`,
      formatRatio(summary.recall1),
      formatRatio(summary.recall3),
      formatRatio(summary.recall8),
      formatScore(summary.mrr),
      formatRatio(summary.lineRecall1),
      formatRatio(summary.lineRecall3),
      formatRatio(summary.requiredRankPass),
      formatRatio(summary.negativeClean),
      formatRatio(summary.forbidden1),
      formatRatio(summary.forbidden3),
      formatRatio(summary.forbidden8),
      formatScore(summary.minPositiveScore),
      formatScore(summary.maxNegativeScore),
    ]);

    for (const row of byScenario(rows)) {
      perStrategyRows.push([
        bucket.name,
        row.scenario,
        row.queries,
        `${formatRatio(row.candidateRecall40)}${row.incompleteCandidateCaptures > 0 ? "*" : ""}`,
        formatRatio(row.recall1),
        formatRatio(row.recall3),
        formatRatio(row.lineRecall1),
        formatRatio(row.lineRecall3),
        formatRatio(row.requiredRankPass),
        formatRatio(row.forbidden1),
        formatRatio(row.forbidden3),
        formatRatio(row.forbidden8),
        formatScore(row.minPositiveScore),
        formatScore(row.maxNegativeScore),
      ]);
    }

    if (args.flags.verbose === true) {
      console.log(`\n--- ${bucket.name} per-query`);
      console.log(
        markdownTable(
          ["query", "scenario", "cand", "rank", "line@1", "line@3", "target", "forbid", "score", "best-negative"],
          rows.map((row) => [
            row.query,
            row.scenario,
            row.candidateRank ?? "miss",
            row.rank ?? "miss",
            row.negative ? "-" : row.lineHitAt1 ? "yes" : "no",
            row.negative ? "-" : row.lineHitAt3 ? "yes" : "no",
            row.requiredRankHit === null ? "-" : row.requiredRankHit ? "pass" : "FAIL",
            row.forbiddenRank ?? "-",
            formatScore(row.expectedScore),
            formatScore(row.bestNegativeScore),
          ]),
        ),
      );
    }
  }

  console.log("\n### Strategy comparison");
  console.log(
    markdownTable(
      [
        "strategy",
        "model",
        "chunks",
        `C@${RAW_CANDIDATE_DEPTH}`,
        "R@1",
        "R@3",
        "R@8",
        "MRR",
        "line@1",
        "line@3",
        "target",
        "neg-clean",
        "F@1",
        "F@3",
        "F@8",
        "min-pos",
        "max-neg",
      ],
      summaryRows,
    ),
  );
  if (summaryRows.some((row) => String(row[3]).endsWith("*"))) {
    console.log(
      `\n* C@${RAW_CANDIDATE_DEPTH} is a lower bound because one or more query records could not prove ` +
        "complete raw-candidate capture (authoritative universe/depth missing or too few candidates recorded). " +
        "Re-record the sweep with a current full-corpus harness.",
    );
  }

  console.log("\n### By scenario");
  console.log(
    markdownTable(
      [
        "strategy",
        "scenario",
        "n",
        `C@${RAW_CANDIDATE_DEPTH}`,
        "R@1",
        "R@3",
        "line@1",
        "line@3",
        "target",
        "F@1",
        "F@3",
        "F@8",
        "min-pos",
        "max-neg",
      ],
      perStrategyRows,
    ),
  );

  if (args.flags.thresholds === true) {
    console.log("\n### Threshold grid (offline re-ranking of recorded chunks)");
    const rows = [];
    for (const bucket of Object.values(record.strategies)) {
      for (const minCosine of [0.2, 0.3, 0.35, 0.4, 0.45, 0.5, 0.55, 0.6]) {
        for (const relativeMinRatio of [0, 0.6, 0.7, 0.8, 0.9]) {
          const scored = scoreStrategy(
            bucket,
            golden,
            corpus,
            { minCosine, relativeMinRatio },
            record.rawCandidateDepth ?? null,
          );
          const summary = summarize(scored);
          rows.push([
            bucket.name,
            minCosine,
            relativeMinRatio,
            `${formatRatio(summary.candidateRecall40)}${summary.incompleteCandidateCaptures > 0 ? "*" : ""}`,
            formatRatio(summary.recall1),
            formatRatio(summary.recall3),
            formatRatio(summary.lineRecall1),
            formatRatio(summary.lineRecall3),
            formatRatio(summary.negativeClean),
            formatRatio(summary.forbidden1),
            formatRatio(summary.forbidden3),
            formatRatio(summary.forbidden8),
          ]);
        }
      }
    }
    console.log(
      markdownTable(
        [
          "strategy",
          "minCosine",
          "ratio",
          `C@${RAW_CANDIDATE_DEPTH}`,
          "R@1",
          "R@3",
          "line@1",
          "line@3",
          "neg-clean",
          "F@1",
          "F@3",
          "F@8",
        ],
        rows,
      ),
    );
  }
}

async function commandReport(args) {
  const file = args.positional[0] ? resolve(args.positional[0]) : latestRecord();
  console.log(`report for ${file}`);
  const record = JSON.parse(readFileSync(file, "utf8"));
  const golden = loadGoldenSuite(suiteName(args, record.suite ?? "calibration"));
  reportRecord(record, golden, args);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  switch (args.command) {
    case "probe":
      return commandProbe(args);
    case "stats":
      return commandStats();
    case "seed":
      return commandSeed(args);
    case "cleanup":
      return commandCleanup(args);
    case "sweep":
      return commandSweep(args);
    case "live":
      return commandLive(args);
    case "report":
      return commandReport(args);
    default:
      console.log(readFileSync(resolve(here, "run-eval.mjs"), "utf8").split("*/")[0]);
      return undefined;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
