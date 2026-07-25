#!/usr/bin/env node
/**
 * Search-lab evaluation harness.
 *
 * Commands:
 *   probe                       Check which embedding models answer, and how they score a
 *                               known cross-language pair.
 *   stats                       Corpus and chunk statistics for the deployed instance.
 *   seed [--no-enqueue]         Insert the [EVAL:*] corpus into the instance.
 *   cleanup [--prune-cache]     Hard-delete the [EVAL:*] corpus (and optionally the cache).
 *   sweep [options]             Run golden queries against strategy presets and record raw JSON.
 *   report [file] [--thresholds]  Score a recorded sweep; optionally grid-search thresholds.
 *
 * sweep options:
 *   --preset a,b       Strategy presets from strategies.json (default: all)
 *   --scenario s       Only golden queries whose scenario contains this string
 *   --query s          Only golden queries whose text contains this string
 *   --corpus all|eval|real
 *   --label name       Output file label
 *
 * Environment: NOTESFLASH_LAB_URL, NOTESFLASH_LAB_TOKEN (or cloud/.lab-token.local).
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { callLab } from "./lab-client.mjs";
import {
  byScenario,
  corpusIndex,
  evaluateQuery,
  expectedLineNumber,
  formatRatio,
  formatScore,
  markdownTable,
  rescore,
  summarize,
} from "./metrics.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(here, "out");
const QUERIES_PER_REQUEST = 6;

function loadJson(name) {
  return JSON.parse(readFileSync(resolve(here, name), "utf8"));
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
  const corpus = loadJson("corpus.json");
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
  console.log(`\ntotal inserted=${inserted} replaced=${replaced} enqueued=${enqueued}`);
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
  const golden = loadJson("golden.json");
  const strategies = selectPresets(args);
  const queries = selectQueries(args, golden);
  if (queries.length === 0) throw new Error("No golden queries matched the filters.");

  const corpus = typeof args.flags.corpus === "string" ? args.flags.corpus : "all";
  const record = {
    createdAt: new Date().toISOString(),
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
        includeText: true,
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
  reportRecord(record, loadJson("golden.json"), args);
}

function latestRecord() {
  const files = readdirSync(OUT_DIR)
    .filter((name) => name.endsWith(".json"))
    .sort();
  if (files.length === 0) throw new Error(`No sweep output found in ${OUT_DIR}`);
  return resolve(OUT_DIR, files[files.length - 1]);
}

function scoreStrategy(bucket, golden, corpus, overrides) {
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
        corpus,
      });
    });
}

function reportRecord(record, golden, args) {
  const corpus = corpusIndex(loadJson("corpus.json"));
  const missing = golden.queries.flatMap((entry) =>
    (entry.expect ?? [])
      .filter((expectation) =>
        expectedLineNumber(corpus.get(expectation.key), expectation.lineIncludes) === null
      )
      .map((expectation) => `${entry.query} -> ${expectation.key}: "${expectation.lineIncludes}"`)
  );
  if (missing.length > 0) {
    console.error("\nGolden expectations that no longer match the corpus:");
    for (const item of missing) console.error(`  ${item}`);
  }

  const summaryRows = [];
  const perStrategyRows = [];
  for (const bucket of Object.values(record.strategies)) {
    const rows = scoreStrategy(bucket, golden, corpus, null);
    const summary = summarize(rows);
    summaryRows.push([
      bucket.name,
      bucket.model.replace("@cf/", ""),
      bucket.chunkCount,
      formatRatio(summary.recall1),
      formatRatio(summary.recall3),
      formatRatio(summary.recall8),
      formatScore(summary.mrr),
      formatRatio(summary.lineAccuracy),
      formatRatio(summary.negativeClean),
      summary.forbiddenViolations,
      formatScore(summary.minPositiveScore),
      formatScore(summary.maxNegativeScore),
    ]);

    for (const row of byScenario(rows)) {
      perStrategyRows.push([
        bucket.name,
        row.scenario,
        row.queries,
        formatRatio(row.recall1),
        formatRatio(row.recall3),
        formatRatio(row.lineAccuracy),
        formatScore(row.minPositiveScore),
        formatScore(row.maxNegativeScore),
      ]);
    }

    if (args.flags.verbose === true) {
      console.log(`\n--- ${bucket.name} per-query`);
      console.log(
        markdownTable(
          ["query", "scenario", "rank", "line", "score", "best-negative"],
          rows.map((row) => [
            row.query,
            row.scenario,
            row.rank ?? "miss",
            row.lineHit === null ? "-" : row.lineHit ? "yes" : "no",
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
        "R@1",
        "R@3",
        "R@8",
        "MRR",
        "line",
        "neg-clean",
        "forbid",
        "min-pos",
        "max-neg",
      ],
      summaryRows,
    ),
  );

  console.log("\n### By scenario");
  console.log(
    markdownTable(
      ["strategy", "scenario", "n", "R@1", "R@3", "line", "min-pos", "max-neg"],
      perStrategyRows,
    ),
  );

  if (args.flags.thresholds === true) {
    console.log("\n### Threshold grid (offline re-ranking of recorded chunks)");
    const rows = [];
    for (const bucket of Object.values(record.strategies)) {
      for (const minCosine of [0.2, 0.3, 0.35, 0.4, 0.45, 0.5, 0.55, 0.6]) {
        for (const relativeMinRatio of [0, 0.6, 0.7, 0.8, 0.9]) {
          const scored = scoreStrategy(bucket, golden, corpus, { minCosine, relativeMinRatio });
          const summary = summarize(scored);
          rows.push([
            bucket.name,
            minCosine,
            relativeMinRatio,
            formatRatio(summary.recall1),
            formatRatio(summary.recall3),
            formatRatio(summary.lineAccuracy),
            formatRatio(summary.negativeClean),
          ]);
        }
      }
    }
    console.log(
      markdownTable(
        ["strategy", "minCosine", "ratio", "R@1", "R@3", "line", "neg-clean"],
        rows,
      ),
    );
  }
}

async function commandReport(args) {
  const file = args.positional[0] ? resolve(args.positional[0]) : latestRecord();
  console.log(`report for ${file}`);
  reportRecord(JSON.parse(readFileSync(file, "utf8")), loadJson("golden.json"), args);
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
    case "report":
      return commandReport(args);
    default:
      console.log(readFileSync(resolve(here, "run-eval.mjs"), "utf8").split("*/")[0]);
      return undefined;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
