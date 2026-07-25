#!/usr/bin/env node
/**
 * Reproducible large-corpus semantic-search experiment for the deployed legacy
 * operator search lab.
 *
 * Safety properties:
 * - only synthetic corpora are seeded, always with enqueue:false;
 * - every seeded title starts with the same non-semantic "[EVAL] " marker and
 *   never contains a corpus key;
 * - sweep is the only read action and is hard-wired to corpus:"eval" plus
 *   includeText:true;
 * - cleanup runs before seeding and again from finally, including SIGINT/SIGTERM;
 * - blind-final queries are deliberately absent from the suite registry;
 * - raw responses go to the gitignored cloud/eval/out tree and are never printed.
 *
 * The deployed legacy lab exposes only Top-20 rankedChunks, so this runner does
 * not use that field. It asks the lab for up to Top-50 notes, proves every
 * returned boundary maps one-to-one to a local chunk index, and proves any
 * chunk omitted by the legacy effective floor is below the reconstructed
 * Top-40 cutoff before accepting those note results.
 */

import {
  appendFileSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { buildNoteChunks } from "../../src/chunking.ts";
import {
  corpusIndex,
  evaluateQuery,
} from "../metrics.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const evalDir = resolve(here, "..");
const cloudDir = resolve(evalDir, "..");
const outputRoot = resolve(evalDir, "out", "large-experiment");
const tokenFile = resolve(cloudDir, ".lab-token.local");
const DEFAULT_LAB_URL = "https://notesflash-cloud.17828126523l.workers.dev";

const EVAL_PREFIX = "[EVAL] ";
const DEFAULT_EXPANSION_TEMPLATE = "notes related to {query}";
const MAX_LAB_NOTES = 400;
const MAX_LAB_CHARS = 400_000;
// The legacy Worker performs per-note D1 replacement/insertion inside one
// request. Batches of 200 are within its input validator but can exhaust the
// request's database budget under cron contention; 50 is the proven safe size.
// The legacy lab performs multiple non-transactional D1 operations per note.
// Production diagnostics observed transient 503s after only 21-43 partial
// inserts, so keep each request small; the runner's finally cleanup still
// removes any partial batch before a retry or failure is accepted.
const MAX_SEED_BATCH = 10;
const ORIGINAL_QUERIES_PER_SWEEP = 3;
const MAX_STRATEGIES_PER_SWEEP = 4;
const MAX_REQUESTS_PER_RUN = 220;
const LAB_RATE_LIMIT = 240;
const DEFAULT_TIMEOUT_MS = 10 * 60 * 1_000;

const ORACLE_AGGREGATION = Object.freeze({
  minCosine: -1,
  relativeMinRatio: 0,
  multiChunkBonus: 0,
  maxBonusChunks: 0,
  maxMatchesPerNote: 20,
  topK: 50,
});

const PRODUCTION_RANKING = Object.freeze({
  multiChunkBonus: 0.01,
  maxBonusChunks: 3,
  maxMatchesPerNote: 3,
  topK: 8,
});

const REPLAY_CONFIGS = Object.freeze([
  {
    name: "baseline-0.3-0.6",
    kind: "primary",
    minCosine: 0.3,
    relativeMinRatio: 0.6,
  },
  {
    name: "global-low-floor-0.235-0.6",
    kind: "primary",
    minCosine: 0.235,
    relativeMinRatio: 0.6,
  },
  {
    name: "consensus-0.235-0.3-0.6",
    kind: "consensus",
    minCosine: 0.3,
    relativeMinRatio: 0.6,
    rawMinCosine: 0.235,
    expandedMinCosine: 0.3,
  },
  {
    name: "consensus-loose-0.23-0.29-0.6",
    kind: "consensus",
    minCosine: 0.3,
    relativeMinRatio: 0.6,
    rawMinCosine: 0.23,
    expandedMinCosine: 0.29,
  },
  {
    name: "consensus-strict-0.24-0.31-0.6",
    kind: "consensus",
    minCosine: 0.3,
    relativeMinRatio: 0.6,
    rawMinCosine: 0.24,
    expandedMinCosine: 0.31,
  },
]);

// overlap=0 is deliberate: the legacy lab de-duplicates matches by primary
// line. With overlap=1, two distinct windows can share that anchor and one
// exact chunk becomes unobservable, making a proven Top-40 impossible.
const LINE_SHAPE = Object.freeze({
  targetChars: 220,
  maxChars: 400,
  minChars: 24,
  maxLines: 3,
  overlapLines: 0,
  titleContext: true,
  includeTitleChunk: true,
});

const NO_TITLE_LINE_SHAPE = Object.freeze({
  ...LINE_SHAPE,
  titleContext: false,
  includeTitleChunk: false,
});

const SINGLE_LINE_SHAPE = Object.freeze({
  targetChars: 60,
  maxChars: 400,
  minChars: 0,
  maxLines: 1,
  overlapLines: 0,
  titleContext: false,
  includeTitleChunk: false,
});

const TIGHT_LINE_SHAPE = Object.freeze({
  targetChars: 140,
  maxChars: 400,
  minChars: 24,
  maxLines: 2,
  overlapLines: 0,
  titleContext: true,
  includeTitleChunk: true,
});

function strategy(name, model, chunking, instruction) {
  return {
    name,
    model,
    ...(instruction ? { instruction } : {}),
    chunking,
    aggregation: ORACLE_AGGREGATION,
  };
}

const STRATEGY_GROUPS = Object.freeze([
  {
    name: "gemma-shapes",
    strategies: [
      strategy("gemma-lines-title", "@cf/google/embeddinggemma-300m", LINE_SHAPE),
      strategy("gemma-body-only", "@cf/google/embeddinggemma-300m", NO_TITLE_LINE_SHAPE),
      strategy("gemma-single-line-body", "@cf/google/embeddinggemma-300m", SINGLE_LINE_SHAPE),
      strategy("gemma-tight-lines", "@cf/google/embeddinggemma-300m", TIGHT_LINE_SHAPE),
    ],
  },
  {
    name: "model-lines",
    strategies: [
      strategy("bge-body-only", "@cf/baai/bge-m3", NO_TITLE_LINE_SHAPE),
      strategy("qwen-body-only", "@cf/qwen/qwen3-embedding-0.6b", NO_TITLE_LINE_SHAPE),
      strategy(
        "qwen-bilingual-body-only",
        "@cf/qwen/qwen3-embedding-0.6b",
        NO_TITLE_LINE_SHAPE,
        "Given a search query in any language, retrieve note lines with the same meaning, including lines written in a different language",
      ),
      strategy("qwen-single-line-body", "@cf/qwen/qwen3-embedding-0.6b", SINGLE_LINE_SHAPE),
    ],
  },
]);

const MODEL_BATCH_SIZE = Object.freeze({
  "@cf/google/embeddinggemma-300m": 48,
  "@cf/baai/bge-m3": 48,
  "@cf/qwen/qwen3-embedding-0.6b": 32,
});

const CORPUS_FILES = Object.freeze([
  { name: "legacy", path: resolve(evalDir, "corpus.json") },
  { name: "general", path: resolve(here, "general-corpus.json") },
  { name: "tech", path: resolve(here, "tech-corpus.json") },
  // Blind notes are background distractors only. Blind queries are never read.
  { name: "blind-background", path: resolve(here, "blind-corpus.json") },
]);

const QUERY_FILES = Object.freeze({
  calibration: [
    { name: "legacy-golden", path: resolve(evalDir, "golden.json") },
    { name: "general-calibration", path: resolve(here, "general-calibration.json") },
    { name: "tech-calibration", path: resolve(here, "tech-calibration.json") },
  ],
  regression: [
    { name: "legacy-short-regression", path: resolve(evalDir, "regression-short-cross-language.json") },
    { name: "general-holdout", path: resolve(here, "general-holdout.json") },
    { name: "tech-holdout", path: resolve(here, "tech-holdout.json") },
  ],
});

function parseArgs(argv) {
  const flags = {};
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (!value.startsWith("--")) throw new Error(`Unexpected positional argument: ${value}`);
    const name = value.slice(2);
    const next = argv[index + 1];
    if (next === undefined || next.startsWith("--")) {
      flags[name] = true;
    } else {
      flags[name] = next;
      index += 1;
    }
  }
  return flags;
}

function usage() {
  return `Usage:
  node cloud/eval/large/run-large-experiment.mjs --dry-run [options]
  node cloud/eval/large/run-large-experiment.mjs [options]

Options:
  --suite calibration|regression|all   Public suites to run (default: all)
  --groups gemma-shapes,model-lines    Model/shape groups (default: both)
  --strategies NAME[,NAME]             Restrict to named strategies inside the selected groups
  --strategies-per-request N           Split grouped sweeps to 1..4 strategies (default: 4)
  --subset all|eligible-short-negative Query subset (default: all)
  --expanded-template "...{query}..."  Context view (default: notes related to {query})
  --timeout-ms N                       Per-request timeout (default: 600000)
  --label NAME                         Safe output-directory label
  --dry-run                            Validate and print the plan; no network or output writes
  --help                               Show this help

There is intentionally no blind suite option. blind-final-holdout.json is never loaded.`;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function chunked(items, size) {
  const batches = [];
  for (let offset = 0; offset < items.length; offset += size) {
    batches.push(items.slice(offset, offset + size));
  }
  return batches;
}

function unique(items) {
  return [...new Set(items)];
}

function safeLabel(value) {
  const label = String(value ?? "large").trim().replace(/[^a-zA-Z0-9_-]+/g, "-");
  return label.slice(0, 48) || "large";
}

function parsePositiveInteger(value, fallback, name) {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) throw new Error(`${name} must be a positive integer.`);
  return parsed;
}

function selectSuiteNames(value) {
  const requested = value === undefined ? ["calibration", "regression"] : String(value).split(",");
  const expanded = requested.flatMap((name) => name.trim() === "all"
    ? ["calibration", "regression"]
    : [name.trim()]);
  const names = unique(expanded.filter(Boolean));
  const unknown = names.filter((name) => !QUERY_FILES[name]);
  if (unknown.length > 0) {
    throw new Error(`Unknown suite ${unknown.join(", ")}. Only calibration, regression, and all exist.`);
  }
  return names;
}

function selectGroups(value) {
  const requested = value === undefined
    ? STRATEGY_GROUPS.map((group) => group.name)
    : String(value).split(",").map((name) => name.trim()).filter(Boolean);
  const groups = unique(requested).map((name) => {
    const group = STRATEGY_GROUPS.find((candidate) => candidate.name === name);
    if (!group) {
      throw new Error(
        `Unknown group ${name}. Available: ${STRATEGY_GROUPS.map((item) => item.name).join(", ")}.`,
      );
    }
    return group;
  });
  if (groups.length === 0) throw new Error("At least one strategy group is required.");
  return groups;
}

function restrictAndSplitGroups(groups, strategyFilter, strategiesPerRequest) {
  const requested = strategyFilter === undefined
    ? null
    : new Set(String(strategyFilter).split(",").map((name) => name.trim()).filter(Boolean));
  const available = new Set(groups.flatMap((group) => group.strategies.map((item) => item.name)));
  if (requested) {
    const unknown = [...requested].filter((name) => !available.has(name));
    if (unknown.length > 0) {
      throw new Error(`Unknown strategy ${unknown.join(", ")}. Available: ${[...available].join(", ")}.`);
    }
  }
  const executionGroups = [];
  for (const group of groups) {
    const selected = requested
      ? group.strategies.filter((item) => requested.has(item.name))
      : group.strategies;
    for (const [index, strategies] of chunked(selected, strategiesPerRequest).entries()) {
      executionGroups.push({
        name: selected.length > strategiesPerRequest ? `${group.name}-${index + 1}` : group.name,
        strategies,
      });
    }
  }
  if (executionGroups.length === 0) throw new Error("No strategies selected.");
  return executionGroups;
}

function isShortQueryEligible(query) {
  const value = query.trim();
  return value.length > 0 && [...value].length <= 24 && value.split(/\s+/u).length <= 3;
}

function renderExpandedQuery(template, query) {
  if (!template.includes("{query}")) {
    throw new Error("--expanded-template must contain the literal placeholder {query}.");
  }
  const rendered = template.split("{query}").join(query).trim();
  if (rendered.length === 0 || rendered.length > 500) {
    throw new Error(`Expanded query must contain 1 to 500 characters: ${JSON.stringify(query)}`);
  }
  return rendered;
}

function normalizeText(value) {
  return value.trim().toLocaleLowerCase().replace(/\s+/gu, " ");
}

function tupleKey(value) {
  return [
    value.kind,
    value.lineStart ?? "null",
    value.lineEnd ?? "null",
    value.charStart ?? "null",
    value.charEnd ?? "null",
  ].join(":");
}

function anchorKey(value) {
  return value.kind === "title" ? "title" : `line:${value.lineNumber}`;
}

function percentile(values, fraction) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.round((sorted.length - 1) * fraction)));
  return sorted[index];
}

function median(values) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

function loadCorpora() {
  const notes = [];
  for (const source of CORPUS_FILES) {
    const corpus = readJson(source.path);
    if (!Array.isArray(corpus.notes)) throw new Error(`${source.path} has no notes array.`);
    for (const note of corpus.notes) notes.push({ ...note, corpus: source.name });
  }
  return notes;
}

function assignSeedTitles(notes) {
  const titleGroups = new Map();
  for (const note of notes) {
    const list = titleGroups.get(note.title) ?? [];
    list.push(note);
    titleGroups.set(note.title, list);
  }

  const seeded = [];
  const seededTitleToKey = new Map();
  for (const [title, group] of titleGroups) {
    const ordered = [...group].sort((left, right) => left.key.localeCompare(right.key));
    ordered.forEach((note, index) => {
      // Punctuation-only disambiguation prevents legacy seed's title replacement
      // from collapsing duplicate natural titles without embedding a semantic key.
      const suffix = ordered.length > 1 ? ` ${"·".repeat(index + 1)}` : "";
      const seededTitle = `${EVAL_PREFIX}${title}${suffix}`;
      if (seededTitleToKey.has(seededTitle)) throw new Error(`Seed title collision: ${seededTitle}`);
      seededTitleToKey.set(seededTitle, note.key);
      seeded.push({ ...note, seededTitle });
    });
  }
  return { notes: seeded, seededTitleToKey };
}

function loadQueries(suiteNames, subset) {
  const entries = [];
  for (const suiteName of suiteNames) {
    for (const source of QUERY_FILES[suiteName]) {
      const suite = readJson(source.path);
      if (!Array.isArray(suite.queries)) throw new Error(`${source.path} has no queries array.`);
      suite.queries.forEach((query, index) => {
        entries.push({
          ...query,
          suite: source.name,
          suiteKind: suiteName,
          frozen: suite.frozen === true,
          localIndex: index,
        });
      });
    }
  }
  if (subset === "all") return entries;
  if (subset === "eligible-short-negative") {
    return entries.filter((entry) => isShortQueryEligible(entry.query) || entry.expect.length === 0);
  }
  throw new Error("--subset must be all or eligible-short-negative.");
}

function buildLocalChunkProof(notes, strategies) {
  const byStrategy = new Map();
  const shapeStats = [];
  for (const item of strategies) {
    const byKey = new Map();
    let maxChunks = 0;
    let maxAnchors = 0;
    let totalChunks = 0;
    for (const note of notes) {
      const chunks = buildNoteChunks(
        { title: note.seededTitle, body: note.body },
        item.chunking,
      );
      const tupleToChunk = new Map();
      const anchors = new Set();
      for (const chunk of chunks) {
        const tuple = tupleKey(chunk);
        if (tupleToChunk.has(tuple)) {
          throw new Error(`${item.name}: local chunk boundary tuple is not unique for ${note.key}.`);
        }
        tupleToChunk.set(tuple, chunk);
        anchors.add(chunk.kind === "title" ? "title" : `line:${chunk.primaryLine}`);
      }
      if (anchors.size !== chunks.length) {
        throw new Error(
          `${item.name}: ${note.key} has ${chunks.length} chunks but only ${anchors.size} ` +
          "legacy response anchors; exact chunk identity cannot be reconstructed.",
        );
      }
      if (chunks.length > ORACLE_AGGREGATION.maxMatchesPerNote) {
        throw new Error(
          `${item.name}: ${note.key} has ${chunks.length} chunks, exceeding oracle maxMatches=20.`,
        );
      }
      if (anchors.size > ORACLE_AGGREGATION.maxMatchesPerNote) {
        throw new Error(
          `${item.name}: ${note.key} has ${anchors.size} anchors, exceeding oracle maxMatches=20.`,
        );
      }
      maxChunks = Math.max(maxChunks, chunks.length);
      maxAnchors = Math.max(maxAnchors, anchors.size);
      totalChunks += chunks.length;
      byKey.set(note.key, { chunks, tupleToChunk, anchors });
    }
    byStrategy.set(item.name, byKey);
    shapeStats.push({
      strategy: item.name,
      noteCount: notes.length,
      totalChunks,
      maxChunksPerNote: maxChunks,
      maxAnchorsPerNote: maxAnchors,
      maxMatchesPerNote: ORACLE_AGGREGATION.maxMatchesPerNote,
      boundaryTupleUnique: true,
    });
  }
  return { byStrategy, shapeStats };
}

function validateInputs({ notes, seededTitleToKey, queries, strategies, expansionTemplate }) {
  const errors = [];
  const lexicalRegressionQueries = [];
  const keys = new Set();
  const allCorpusText = notes.map((note) => `${note.seededTitle}\n${note.body}`).join("\n");
  const allCorpusFolded = allCorpusText.toLocaleLowerCase();
  for (const note of notes) {
    if (keys.has(note.key)) errors.push(`duplicate corpus key ${note.key}`);
    keys.add(note.key);
    if (`${note.title}\n${note.body}`.toLocaleLowerCase().includes(note.key.toLocaleLowerCase())) {
      errors.push(`metadata key leaked into its own title/body: ${note.key}`);
    }
    if (!note.seededTitle.startsWith(EVAL_PREFIX)) errors.push(`unsafe seed prefix: ${note.key}`);
    if (note.seededTitle.length > 500) errors.push(`seed title exceeds 500 chars: ${note.key}`);
    if (note.body.length > 200_000) errors.push(`body exceeds lab limit: ${note.key}`);
  }
  if (seededTitleToKey.size !== notes.length) errors.push("seed title mapping is not one-to-one");
  if (notes.length > MAX_LAB_NOTES) errors.push(`corpus has ${notes.length} notes; lab max is ${MAX_LAB_NOTES}`);
  const corpusChars = notes.reduce((sum, note) => sum + note.seededTitle.length + note.body.length, 0);
  if (corpusChars > MAX_LAB_CHARS) errors.push(`corpus has ${corpusChars} chars; lab max is ${MAX_LAB_CHARS}`);

  const corpusByKey = new Map(notes.map((note) => [note.key, note]));
  const viewTexts = new Map();
  for (const entry of queries) {
    if (typeof entry.query !== "string" || entry.query.trim().length === 0 || entry.query.length > 500) {
      errors.push(`invalid query in ${entry.suite}[${entry.localIndex}]`);
      continue;
    }
    if (!Array.isArray(entry.expect)) {
      errors.push(`missing expect array: ${entry.query}`);
      continue;
    }
    if (entry.expect.length > 0 && !Number.isInteger(entry.requiredRank)) {
      errors.push(`positive missing requiredRank: ${entry.query}`);
    }
    for (const expectation of entry.expect) {
      const note = corpusByKey.get(expectation.key);
      if (!note) {
        errors.push(`unknown expected key ${expectation.key}: ${entry.query}`);
        continue;
      }
      const matches = note.body.split("\n").filter((line) => line.includes(expectation.lineIncludes));
      if (matches.length !== 1) {
        errors.push(`lineIncludes matched ${matches.length} lines: ${entry.query} -> ${expectation.key}`);
      }
    }
    for (const forbidden of entry.forbid ?? []) {
      if (!corpusByKey.has(forbidden)) errors.push(`unknown forbidden key ${forbidden}: ${entry.query}`);
    }

    const raw = entry.query.trim();
    const expanded = renderExpandedQuery(expansionTemplate, raw);
    for (const [kind, text] of [["raw", raw], ["expanded", expanded]]) {
      const normalized = normalizeText(text);
      const existing = viewTexts.get(normalized) ?? [];
      existing.push({ kind, query: raw });
      viewTexts.set(normalized, existing);
    }
    // A full literal query anywhere in the merged candidate corpus would make
    // lexical-first behaviour bypass this semantic experiment.
    if (allCorpusFolded.includes(normalizeText(raw))) {
      entry.lexicalCorpusCollision = true;
      if (entry.suite.startsWith("legacy-")) {
        lexicalRegressionQueries.push({ suite: entry.suite, query: raw });
      } else {
        errors.push(`full query has a lexical corpus collision: ${JSON.stringify(raw)}`);
      }
    } else {
      entry.lexicalCorpusCollision = false;
    }
  }

  for (const [text, owners] of viewTexts) {
    const distinct = new Set(owners.map((owner) => `${owner.kind}\0${owner.query}`));
    if (distinct.size > 1 && owners.some((owner) => owner.kind === "expanded")) {
      errors.push(`raw/expanded query-view collision: ${JSON.stringify(text)}`);
    }
  }

  for (const item of strategies) {
    if (item.aggregation !== ORACLE_AGGREGATION) errors.push(`${item.name} does not use oracle aggregation`);
  }
  if (errors.length > 0) throw new Error(`Input validation failed:\n- ${errors.join("\n- ")}`);
  return { corpusChars, corpusByKey, lexicalRegressionQueries };
}

function buildPlan(flags) {
  const suiteNames = selectSuiteNames(flags.suite);
  const selectedGroups = selectGroups(flags.groups);
  const strategiesPerRequest = parsePositiveInteger(
    flags["strategies-per-request"],
    MAX_STRATEGIES_PER_SWEEP,
    "--strategies-per-request",
  );
  if (strategiesPerRequest > MAX_STRATEGIES_PER_SWEEP) {
    throw new Error(`--strategies-per-request must be between 1 and ${MAX_STRATEGIES_PER_SWEEP}.`);
  }
  const groups = restrictAndSplitGroups(
    selectedGroups,
    flags.strategies,
    strategiesPerRequest,
  );
  const strategies = groups.flatMap((group) => group.strategies);
  if (groups.some((group) => group.strategies.length > MAX_STRATEGIES_PER_SWEEP)) {
    throw new Error(`A strategy group exceeds the legacy limit of ${MAX_STRATEGIES_PER_SWEEP}.`);
  }
  const subset = flags.subset === undefined ? "all" : String(flags.subset);
  const expansionTemplate = flags["expanded-template"] === undefined
    ? DEFAULT_EXPANSION_TEMPLATE
    : String(flags["expanded-template"]);
  if (
    expansionTemplate !== DEFAULT_EXPANSION_TEMPLATE &&
    (suiteNames.includes("regression") || subset !== "eligible-short-negative")
  ) {
    throw new Error(
      "Custom expanded-query templates are calibration-only and require --subset eligible-short-negative.",
    );
  }

  const assigned = assignSeedTitles(loadCorpora());
  const queries = loadQueries(suiteNames, subset);
  if (queries.length === 0) throw new Error("No queries selected.");
  const validation = validateInputs({
    notes: assigned.notes,
    seededTitleToKey: assigned.seededTitleToKey,
    queries,
    strategies,
    expansionTemplate,
  });
  const chunkProof = buildLocalChunkProof(assigned.notes, strategies);

  const uniqueOriginalQueries = unique(queries.map((entry) => entry.query.trim()));
  const queryBatches = chunked(uniqueOriginalQueries, ORIGINAL_QUERIES_PER_SWEEP);
  const seedBatches = chunked(assigned.notes, MAX_SEED_BATCH);
  // Every strategy gets one single-strategy cold/warm-up request for batch 0.
  // Remaining batches run up to four already-warmed strategies per request.
  const sweepRequests = strategies.length + Math.max(0, queryBatches.length - 1) * groups.length;
  const expectedRequests = 2 + seedBatches.length + sweepRequests;
  if (expectedRequests > MAX_REQUESTS_PER_RUN) {
    throw new Error(
      `Plan needs ${expectedRequests} requests, above the safety ceiling ${MAX_REQUESTS_PER_RUN} ` +
      `(lab limit ${LAB_RATE_LIMIT}/5min). Narrow --suite, --groups, or --subset.`,
    );
  }

  return {
    suiteNames,
    subset,
    expansionTemplate,
    groups,
    strategies,
    notes: assigned.notes,
    seededTitleToKey: assigned.seededTitleToKey,
    queries,
    uniqueOriginalQueries,
    queryBatches,
    seedBatches,
    expectedRequests,
    validation,
    chunkProof,
  };
}

function loadLabConfig() {
  const baseUrl = (process.env.NOTESFLASH_LAB_URL ?? DEFAULT_LAB_URL).replace(/\/+$/, "");
  let token = process.env.NOTESFLASH_LAB_TOKEN ?? "";
  if (!token) {
    try {
      token = readFileSync(tokenFile, "utf8").trim();
    } catch {
      token = "";
    }
  }
  if (!token) {
    throw new Error(
      `No lab token found. Set NOTESFLASH_LAB_TOKEN or provide ${tokenFile}.`,
    );
  }
  return { baseUrl, token };
}

function assertSafeLabRequest(body) {
  if (!body || typeof body !== "object") throw new Error("Unsafe empty lab request.");
  if (body.action === "sweep") {
    if (body.corpus !== "eval") throw new Error("Refusing sweep outside corpus=eval.");
    if (body.includeText !== true) throw new Error("Oracle sweep requires includeText=true.");
    if (body.maxNotes !== MAX_LAB_NOTES) throw new Error("Oracle sweep must use maxNotes=400.");
    if (!Array.isArray(body.queries) || body.queries.length < 1 || body.queries.length > 6) {
      throw new Error("Sweep query count exceeds the legacy 1..6 bound.");
    }
    if (!Array.isArray(body.strategies) || body.strategies.length < 1 || body.strategies.length > 4) {
      throw new Error("Sweep strategy count exceeds the legacy 1..4 bound.");
    }
    for (const item of body.strategies) {
      if (JSON.stringify(item.aggregation) !== JSON.stringify(ORACLE_AGGREGATION)) {
        throw new Error(`Strategy ${item.name ?? "unknown"} is not using oracle aggregation.`);
      }
    }
    return;
  }
  if (body.action === "seed") {
    if (body.enqueue !== false) throw new Error("Refusing seed unless enqueue=false.");
    if (!Array.isArray(body.notes) || body.notes.length < 1 || body.notes.length > MAX_SEED_BATCH) {
      throw new Error("Seed batch exceeds the legacy 1..200 bound.");
    }
    for (const note of body.notes) {
      if (typeof note.title !== "string" || !note.title.startsWith(EVAL_PREFIX)) {
        throw new Error("Refusing to seed a title without the common [EVAL] prefix.");
      }
    }
    return;
  }
  if (body.action === "cleanup") return;
  throw new Error(`Refusing unsupported lab action ${JSON.stringify(body.action)}.`);
}

function requestSummary(body) {
  if (body.action === "sweep") {
    return {
      action: "sweep",
      corpus: body.corpus,
      includeText: body.includeText,
      maxNotes: body.maxNotes,
      queryCount: body.queries.length,
      queries: body.queries,
      strategyNames: body.strategies.map((item) => item.name),
    };
  }
  if (body.action === "seed") {
    return { action: "seed", enqueue: body.enqueue, noteCount: body.notes.length };
  }
  return { action: body.action, pruneCache: body.pruneCache === true };
}

function createRawLogger(rawFile) {
  let sequence = 0;
  return (body, response, elapsedMs, phase) => {
    sequence += 1;
    appendFileSync(
      rawFile,
      `${JSON.stringify({
        sequence,
        recordedAt: new Date().toISOString(),
        phase,
        request: requestSummary(body),
        elapsedMs,
        response,
      })}\n`,
      "utf8",
    );
  };
}

function sha256File(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function normalizeOracleView({
  queryReport,
  strategyName,
  noteCount,
  seededTitleToKey,
  localChunks,
}) {
  if (!queryReport || typeof queryReport !== "object") {
    throw new Error(`${strategyName}: missing oracle query report.`);
  }
  if (!Array.isArray(queryReport.results)) {
    throw new Error(`${strategyName}: legacy oracle results are unavailable.`);
  }
  if (queryReport.results.length > Math.min(ORACLE_AGGREGATION.topK, noteCount)) {
    throw new Error(
      `${strategyName}: oracle returned more than ${ORACLE_AGGREGATION.topK} notes.`,
    );
  }
  if (typeof queryReport.effectiveFloor !== "number" || !Number.isFinite(queryReport.effectiveFloor)) {
    throw new Error(`${strategyName}: oracle effective floor is unavailable.`);
  }

  const allChunks = [];
  for (const result of queryReport.results) {
    const key = seededTitleToKey.get(result.title);
    if (!key) {
      throw new Error(`${strategyName}: response title cannot be mapped to synthetic metadata.`);
    }
    const local = localChunks.get(key);
    if (!local) throw new Error(`${strategyName}: no local chunk proof for ${key}.`);
    if (!Array.isArray(result.matches)) {
      throw new Error(`${strategyName}: result matches are unavailable for ${key}.`);
    }
    if (result.matchedChunkCount !== result.matches.length) {
      throw new Error(
        `${strategyName}: server truncated matches for ${key} ` +
        `(${result.matches.length}/${result.matchedChunkCount}).`,
      );
    }
    const seenTuples = new Set();
    const normalized = result.matches.map((match) => {
      const tuple = tupleKey(match);
      if (seenTuples.has(tuple)) {
        throw new Error(`${strategyName}: duplicate response boundary tuple for ${key}.`);
      }
      seenTuples.add(tuple);
      const localChunk = local.tupleToChunk.get(tuple);
      if (!localChunk) {
        throw new Error(`${strategyName}: response boundary is absent locally for ${key}.`);
      }
      if (match.text !== localChunk.text) {
        throw new Error(`${strategyName}: response/local chunk text differs for ${key}.`);
      }
      if (typeof match.score !== "number" || !Number.isFinite(match.score)) {
        throw new Error(`${strategyName}: non-finite chunk score for ${key}.`);
      }
      return {
        noteRef: key,
        chunkIndex: localChunk.chunkIndex,
        chunkIdentity: `${key}:${localChunk.chunkIndex}`,
        kind: match.kind,
        lineNumber: match.lineNumber,
        lineStart: match.lineStart,
        lineEnd: match.lineEnd,
        charStart: match.charStart,
        charEnd: match.charEnd,
        score: match.score,
        text: match.text,
      };
    });

    const best = Math.max(...normalized.map((item) => item.score));
    if (Math.abs(best - result.bestScore) > 1e-9) {
      throw new Error(`${strategyName}: result bestScore disagrees with chunk scores for ${key}.`);
    }
    allChunks.push(...normalized);
  }

  allChunks.sort((left, right) =>
    right.score - left.score ||
    left.noteRef.localeCompare(right.noteRef) ||
    left.chunkIndex - right.chunkIndex
  );
  if (allChunks.length < 40) {
    throw new Error(`${strategyName}: only ${allChunks.length} chunks were reconstructable.`);
  }
  const top40 = allChunks.slice(0, 40);
  const cutoff = top40[39].score;
  // The deployed legacy core computes max(minCosine, top * 0), so this
  // nominal -1/0 oracle has an effective floor of 0 whenever the best score is
  // positive. Chunks omitted below that reported floor cannot enter a Top-40
  // whose cutoff is strictly higher. When 50 notes are returned, the 50th
  // note's best score is the tighter upper bound for every excluded note.
  const outsideUpperBound = noteCount <= queryReport.results.length
    ? null
    : queryReport.results.length === ORACLE_AGGREGATION.topK
    ? queryReport.results[queryReport.results.length - 1].bestScore
    : queryReport.effectiveFloor;
  if (outsideUpperBound !== null && !(cutoff > outsideUpperBound)) {
    throw new Error(
      `${strategyName}: Top-40 cutoff ${cutoff.toFixed(6)} is not strictly above ` +
      `the excluded-note upper bound ${outsideUpperBound.toFixed(6)}.`,
    );
  }

  return {
    query: queryReport.query,
    chunks: top40,
    proof: {
      complete: true,
      unit: "exact-local-chunk-identity-proxy",
      returnedNotes: queryReport.results.length,
      reconstructedChunks: allChunks.length,
      topK: 40,
      cutoff,
      excludedNoteBestScoreUpperBound: outsideUpperBound,
      legacyEffectiveFloor: queryReport.effectiveFloor,
      boundaryTupleToChunkIndexOneToOne: true,
      everyReturnedChunkMapsToLocalChunk: true,
      omittedChunksCannotReachTop40: cutoff > queryReport.effectiveFloor,
    },
  };
}

function processSweepPayload({
  payload,
  requestedStrategies,
  originals,
  plan,
  captures,
  requestMetrics,
  phase,
  elapsedMs,
  batchIndex,
  groupName,
}) {
  if (payload.action !== "sweep" || payload.includeText !== true) {
    throw new Error("Legacy lab did not return an includeText sweep response.");
  }
  if (payload.noteCount !== plan.notes.length) {
    throw new Error(`Sweep saw ${payload.noteCount}/${plan.notes.length} synthetic notes.`);
  }
  if (!Array.isArray(payload.strategies) || payload.strategies.length !== requestedStrategies.length) {
    throw new Error("Sweep strategy response count differs from the request.");
  }

  const requestedByName = new Map(requestedStrategies.map((item) => [item.name, item]));
  for (const report of payload.strategies) {
    const requested = requestedByName.get(report.name);
    if (!requested) throw new Error(`Unexpected strategy response ${report.name}.`);
    if (report.chunkCount !== plan.chunkProof.shapeStats.find((item) => item.strategy === report.name)?.totalChunks) {
      throw new Error(`${report.name}: server/local total chunk count differs.`);
    }
    if (!Array.isArray(report.queries) || report.queries.length !== originals.length * 2) {
      throw new Error(`${report.name}: paired query response count differs from request.`);
    }
    const localChunks = plan.chunkProof.byStrategy.get(report.name);
    const strategyCaptures = captures.get(report.name) ?? new Map();

    originals.forEach((original, index) => {
      const expectedExpanded = renderExpandedQuery(plan.expansionTemplate, original);
      const rawReport = report.queries[index * 2];
      const expandedReport = report.queries[index * 2 + 1];
      if (rawReport.query !== original || expandedReport.query !== expectedExpanded) {
        throw new Error(`${report.name}: server changed paired query order.`);
      }
      if (strategyCaptures.has(original)) {
        throw new Error(`${report.name}: duplicate capture for ${JSON.stringify(original)}.`);
      }
      strategyCaptures.set(original, {
        raw: normalizeOracleView({
          queryReport: rawReport,
          strategyName: report.name,
          noteCount: payload.noteCount,
          seededTitleToKey: plan.seededTitleToKey,
          localChunks,
        }),
        expanded: normalizeOracleView({
          queryReport: expandedReport,
          strategyName: report.name,
          noteCount: payload.noteCount,
          seededTitleToKey: plan.seededTitleToKey,
          localChunks,
        }),
      });
    });
    captures.set(report.name, strategyCaptures);

    requestMetrics.push({
      phase,
      group: groupName,
      batchIndex,
      strategy: report.name,
      model: report.model,
      originalQueryCount: originals.length,
      queryTextCount: originals.length * 2,
      requestElapsedMs: elapsedMs,
      aiCalls: report.aiCalls,
      cacheHits: report.cacheHits,
      embeddedTexts: report.embeddedTexts,
      chunkCount: report.chunkCount,
      uniqueChunkTexts: report.uniqueChunkTexts,
      timings: report.timings,
    });
  }
}

function compareChunks(left, right) {
  return right.score - left.score ||
    left.noteRef.localeCompare(right.noteRef) ||
    left.chunkIndex - right.chunkIndex;
}

function aggregateChunks(chunks, { minCosine, relativeMinRatio }) {
  const ranked = [...chunks].sort(compareChunks);
  const topChunkScore = ranked[0]?.score ?? null;
  const effectiveFloor = topChunkScore === null
    ? minCosine
    : Math.max(minCosine, topChunkScore * relativeMinRatio);
  const kept = ranked.filter((chunk) => chunk.score >= effectiveFloor);
  const byNote = new Map();
  for (const chunk of kept) {
    const list = byNote.get(chunk.noteRef) ?? [];
    list.push(chunk);
    byNote.set(chunk.noteRef, list);
  }
  const notes = [...byNote.entries()].map(([noteRef, matches]) => {
    matches.sort(compareChunks);
    const bestScore = matches[0].score;
    const bonusChunks = Math.min(
      Math.max(matches.length - 1, 0),
      PRODUCTION_RANKING.maxBonusChunks,
    );
    return {
      noteRef,
      score: bestScore + bonusChunks * PRODUCTION_RANKING.multiChunkBonus,
      bestScore,
      matchedChunkCount: matches.length,
      matches: matches.slice(0, PRODUCTION_RANKING.maxMatchesPerNote).map((match) => ({ ...match })),
    };
  });
  notes.sort((left, right) => right.score - left.score || left.noteRef.localeCompare(right.noteRef));
  return {
    notes: notes.slice(0, PRODUCTION_RANKING.topK).map((note, index) => ({
      ...note,
      rank: index + 1,
    })),
    topChunkScore,
    effectiveFloor,
    matchedChunkCount: kept.length,
  };
}

function applyConsensus(primary, rawChunks, expandedChunks, config, query) {
  const eligible = isShortQueryEligible(query);
  const emptyDiagnostics = {
    eligible,
    attempted: false,
    rawFloor: null,
    expandedFloor: null,
    consensusChunkCount: 0,
    candidateNoteCount: 0,
    addedNoteCount: 0,
    enrichedNoteCount: 0,
  };
  if (!eligible) return { aggregation: primary, diagnostics: emptyDiagnostics };

  const rawRanked = [...rawChunks].sort(compareChunks);
  const expandedRanked = [...expandedChunks].sort(compareChunks);
  const rawTop = rawRanked[0]?.score ?? null;
  const expandedTop = expandedRanked[0]?.score ?? null;
  const rawFloor = rawTop === null
    ? config.rawMinCosine
    : Math.max(config.rawMinCosine, rawTop * config.relativeMinRatio);
  const expandedFloor = expandedTop === null
    ? config.expandedMinCosine
    : Math.max(config.expandedMinCosine, expandedTop * config.relativeMinRatio);
  const expandedByIdentity = new Map(
    expandedRanked.map((chunk, index) => [chunk.chunkIdentity, { chunk, rank: index + 1 }]),
  );
  const consensus = [];
  rawRanked.forEach((raw, index) => {
    if (raw.score >= primary.effectiveFloor || raw.score < rawFloor) return;
    const expanded = expandedByIdentity.get(raw.chunkIdentity);
    if (!expanded || expanded.chunk.score < expandedFloor) return;
    const rawRank = index + 1;
    consensus.push({
      chunk: raw,
      rawRank,
      expandedRank: expanded.rank,
      expandedScore: expanded.chunk.score,
      rrfScore: 1 / (60 + rawRank) + 1 / (60 + expanded.rank),
    });
  });
  consensus.sort((left, right) =>
    right.rrfScore - left.rrfScore ||
    right.expandedScore - left.expandedScore ||
    right.chunk.score - left.chunk.score ||
    left.chunk.chunkIdentity.localeCompare(right.chunk.chunkIdentity)
  );

  const byNote = new Map();
  for (const candidate of consensus) {
    const list = byNote.get(candidate.chunk.noteRef) ?? [];
    list.push(candidate);
    byNote.set(candidate.chunk.noteRef, list);
  }
  const primaryNotes = primary.notes.map((note) => ({
    ...note,
    matches: note.matches.map((match) => ({ ...match })),
  }));
  const primaryByKey = new Map(primaryNotes.map((note) => [note.noteRef, note]));
  let enrichedNoteCount = 0;
  for (const [noteRef, candidates] of byNote) {
    const note = primaryByKey.get(noteRef);
    if (!note) continue;
    const existing = new Set(note.matches.map((match) => match.chunkIdentity));
    const additional = candidates.filter((candidate) => !existing.has(candidate.chunk.chunkIdentity));
    if (additional.length === 0) continue;
    note.matchedChunkCount += additional.length;
    for (const candidate of additional) {
      if (note.matches.length >= PRODUCTION_RANKING.maxMatchesPerNote) break;
      existing.add(candidate.chunk.chunkIdentity);
      note.matches.push({ ...candidate.chunk });
    }
    enrichedNoteCount += 1;
  }

  const rescuedNotes = [...byNote.entries()]
    .filter(([noteRef]) => !primaryByKey.has(noteRef))
    .map(([noteRef, candidates]) => {
      const best = candidates[0];
      return {
        note: {
          noteRef,
          score: best.chunk.score,
          bestScore: best.chunk.score,
          matchedChunkCount: candidates.length,
          matches: candidates
            .slice(0, PRODUCTION_RANKING.maxMatchesPerNote)
            .map((candidate) => ({ ...candidate.chunk })),
        },
        rrfScore: best.rrfScore,
        expandedScore: best.expandedScore,
        rawScore: best.chunk.score,
      };
    })
    .sort((left, right) =>
      right.rrfScore - left.rrfScore ||
      right.expandedScore - left.expandedScore ||
      right.rawScore - left.rawScore ||
      left.note.noteRef.localeCompare(right.note.noteRef)
    );
  const available = Math.max(0, PRODUCTION_RANKING.topK - primaryNotes.length);
  const appended = rescuedNotes.slice(0, available).map((item) => item.note);
  const notes = [...primaryNotes, ...appended].map((note, index) => ({ ...note, rank: index + 1 }));
  return {
    aggregation: {
      ...primary,
      notes,
      matchedChunkCount: primary.matchedChunkCount + consensus.length,
    },
    diagnostics: {
      eligible: true,
      attempted: true,
      rawFloor,
      expandedFloor,
      consensusChunkCount: consensus.length,
      candidateNoteCount: byNote.size,
      addedNoteCount: appended.length,
      enrichedNoteCount,
    },
  };
}

function replayOne(capture, config, query) {
  const primary = aggregateChunks(capture.raw.chunks, {
    minCosine: config.minCosine,
    relativeMinRatio: config.relativeMinRatio,
  });
  if (config.kind !== "consensus") {
    return {
      results: primary.notes,
      diagnostics: {
        eligible: false,
        attempted: false,
        rawFloor: null,
        expandedFloor: null,
        consensusChunkCount: 0,
        candidateNoteCount: 0,
        addedNoteCount: 0,
        enrichedNoteCount: 0,
      },
    };
  }
  const consensus = applyConsensus(primary, capture.raw.chunks, capture.expanded.chunks, config, query);
  return { results: consensus.aggregation.notes, diagnostics: consensus.diagnostics };
}

function wilson95(successes, total) {
  if (total === 0) return null;
  const z = 1.959963984540054;
  const probability = successes / total;
  const denominator = 1 + (z * z) / total;
  const center = (probability + (z * z) / (2 * total)) / denominator;
  const margin = (
    z * Math.sqrt((probability * (1 - probability) + (z * z) / (4 * total)) / total)
  ) / denominator;
  return { low: Math.max(0, center - margin), high: Math.min(1, center + margin) };
}

function binaryMetric(successes, total, includeWilson = true) {
  return {
    numerator: successes,
    denominator: total,
    value: total === 0 ? null : successes / total,
    wilson95: includeWilson ? wilson95(successes, total) : null,
  };
}

function scoreGaps(rows) {
  const positives = rows.filter((row) => !row.negative);
  const negatives = rows.filter((row) => row.negative);
  const targetScores = positives
    .map((row) => row.expectedCandidateScore)
    .filter((score) => typeof score === "number");
  const noiseScores = [
    ...positives.map((row) => row.bestCompetingCandidateScore),
    ...negatives.map((row) => row.unfilteredTopScore),
  ].filter((score) => typeof score === "number");
  const margins = positives
    .map((row) => typeof row.expectedCandidateScore === "number" &&
        typeof row.bestCompetingCandidateScore === "number"
      ? row.expectedCandidateScore - row.bestCompetingCandidateScore
      : null)
    .filter((value) => typeof value === "number");
  const minTarget = targetScores.length > 0 ? Math.min(...targetScores) : null;
  const maxNoise = noiseScores.length > 0 ? Math.max(...noiseScores) : null;
  return {
    targetScoreCount: targetScores.length,
    noiseScoreCount: noiseScores.length,
    minTarget,
    medianTarget: median(targetScores),
    maxNoise,
    medianNoise: median(noiseScores),
    globalGap: minTarget === null || maxNoise === null ? null : minTarget - maxNoise,
    perQueryMarginCount: margins.length,
    minPerQueryMargin: margins.length > 0 ? Math.min(...margins) : null,
    medianPerQueryMargin: median(margins),
  };
}

function summarizeRows(rows, baselineRows = null) {
  const positives = rows.filter((row) => !row.negative);
  const negatives = rows.filter((row) => row.negative);
  const required = positives.filter((row) => row.requiredRankHit !== null);
  const forbidden = rows.filter((row) => row.forbiddenCounted);
  const metrics = {
    candidateAt40: binaryMetric(
      positives.filter((row) => row.candidateHitAt40).length,
      positives.length,
    ),
    recallAt1: binaryMetric(
      positives.filter((row) => row.rank !== null && row.rank <= 1).length,
      positives.length,
    ),
    recallAt3: binaryMetric(
      positives.filter((row) => row.rank !== null && row.rank <= 3).length,
      positives.length,
    ),
    recallAt8: binaryMetric(
      positives.filter((row) => row.rank !== null && row.rank <= 8).length,
      positives.length,
    ),
    lineAt1: binaryMetric(
      positives.filter((row) => row.lineHitAt1).length,
      positives.length,
    ),
    lineAt3: binaryMetric(
      positives.filter((row) => row.lineHitAt3).length,
      positives.length,
    ),
    requiredRank: binaryMetric(
      required.filter((row) => row.requiredRankHit).length,
      required.length,
    ),
    negativeClean: binaryMetric(
      negatives.filter((row) => !row.falsePositive).length,
      negatives.length,
    ),
    forbiddenAt1: binaryMetric(
      forbidden.filter((row) => row.forbiddenAt1).length,
      forbidden.length,
    ),
    forbiddenAt3: binaryMetric(
      forbidden.filter((row) => row.forbiddenAt3).length,
      forbidden.length,
    ),
    forbiddenAt8: binaryMetric(
      forbidden.filter((row) => row.forbiddenAt8).length,
      forbidden.length,
    ),
  };
  const reciprocalRankSum = positives.reduce((sum, row) => sum + row.reciprocalRank, 0);
  const rescue = {
    eligibleQueries: rows.filter((row) => row.replayDiagnostics.eligible).length,
    attemptedQueries: rows.filter((row) => row.replayDiagnostics.attempted).length,
    consensusChunks: rows.reduce(
      (sum, row) => sum + row.replayDiagnostics.consensusChunkCount,
      0,
    ),
    candidateNotes: rows.reduce(
      (sum, row) => sum + row.replayDiagnostics.candidateNoteCount,
      0,
    ),
    addedNotes: rows.reduce((sum, row) => sum + row.replayDiagnostics.addedNoteCount, 0),
    enrichedNotes: rows.reduce((sum, row) => sum + row.replayDiagnostics.enrichedNoteCount, 0),
    rescuedPositiveHits: 0,
    rescuedRequiredRanks: 0,
    negativeCleanRegressions: 0,
  };
  if (baselineRows) {
    const baselineById = new Map(baselineRows.map((row) => [row.evaluationId, row]));
    for (const row of rows) {
      const baseline = baselineById.get(row.evaluationId);
      if (!baseline) continue;
      if (!row.negative && baseline.rank === null && row.rank !== null) rescue.rescuedPositiveHits += 1;
      if (
        !row.negative && baseline.requiredRankHit === false && row.requiredRankHit === true
      ) rescue.rescuedRequiredRanks += 1;
      if (row.negative && !baseline.falsePositive && row.falsePositive) {
        rescue.negativeCleanRegressions += 1;
      }
    }
  }
  return {
    queryCount: rows.length,
    positiveCount: positives.length,
    negativeCount: negatives.length,
    metrics,
    mrr: {
      numerator: reciprocalRankSum,
      denominator: positives.length,
      value: positives.length === 0 ? null : reciprocalRankSum / positives.length,
    },
    scoreGaps: scoreGaps(rows),
    rescue,
  };
}

function replayExperiment(plan, captures, replayConfigs = REPLAY_CONFIGS) {
  const corpus = corpusIndex({ notes: plan.notes });
  const reports = {};
  for (const item of plan.strategies) {
    const strategyCaptures = captures.get(item.name);
    if (!strategyCaptures || strategyCaptures.size !== plan.uniqueOriginalQueries.length) {
      throw new Error(
        `${item.name}: captured ${strategyCaptures?.size ?? 0}/${plan.uniqueOriginalQueries.length} queries.`,
      );
    }
    const rowsByConfig = new Map();
    for (const config of replayConfigs) {
      const rows = plan.queries.map((entry) => {
        const capture = strategyCaptures.get(entry.query.trim());
        if (!capture) throw new Error(`${item.name}: missing capture for ${entry.query}.`);
        const replay = replayOne(capture, config, entry.query);
        const evaluated = evaluateQuery({
          golden: entry,
          results: replay.results,
          rankedChunks: capture.raw.chunks,
          candidateUniverseSize: 40,
          candidateCaptureLimit: 40,
          corpus,
        });
        return {
          ...evaluated,
          evaluationId: `${entry.suite}:${entry.localIndex}`,
          suite: entry.suite,
          suiteKind: entry.suiteKind,
          lexicalCorpusCollision: entry.lexicalCorpusCollision === true,
          replayDiagnostics: replay.diagnostics,
          candidateReconstructionComplete: true,
        };
      });
      rowsByConfig.set(config.name, rows);
    }

    const baselineRows = rowsByConfig.get("baseline-0.3-0.6")
      ?? rowsByConfig.get(replayConfigs[0]?.name);
    if (!baselineRows) throw new Error(`${item.name}: no replay baseline was produced.`);
    reports[item.name] = {};
    for (const config of replayConfigs) {
      const rows = rowsByConfig.get(config.name);
      const sliceNames = ["all", "semantic-only", ...unique(rows.map((row) => row.suite))];
      const slices = {};
      for (const slice of sliceNames) {
        const selected = slice === "all"
          ? rows
          : slice === "semantic-only"
          ? rows.filter((row) => !row.lexicalCorpusCollision)
          : rows.filter((row) => row.suite === slice);
        const selectedBaseline = slice === "all"
          ? baselineRows
          : slice === "semantic-only"
          ? baselineRows.filter((row) => !row.lexicalCorpusCollision)
          : baselineRows.filter((row) => row.suite === slice);
        slices[slice] = summarizeRows(selected, selectedBaseline);
      }
      reports[item.name][config.name] = {
        config,
        slices,
      };
    }
  }
  return reports;
}

function summarizeRequestMetrics(requestMetrics) {
  const byStrategy = {};
  for (const name of unique(requestMetrics.map((entry) => entry.strategy))) {
    const entries = requestMetrics.filter((entry) => entry.strategy === name);
    const warmup = entries.find((entry) => entry.phase === "document-warmup") ?? null;
    const warm = entries.filter((entry) => entry.phase === "warm-query-batch");
    const warmEmbedding = warm
      .map((entry) => entry.timings?.embeddingMs)
      .filter((value) => typeof value === "number");
    const strategy = STRATEGY_GROUPS
      .flatMap((group) => group.strategies)
      .find((item) => item.name === name);
    const modelBatchSize = MODEL_BATCH_SIZE[strategy?.model] ?? null;
    const singleBatchEvidence = warm.length > 0 && warm.every((entry) =>
      entry.queryTextCount <= modelBatchSize &&
      entry.aiCalls <= 1 &&
      entry.embeddedTexts <= entry.queryTextCount
    );
    byStrategy[name] = {
      requests: entries.length,
      aiCalls: entries.reduce((sum, entry) => sum + entry.aiCalls, 0),
      cacheHits: entries.reduce((sum, entry) => sum + entry.cacheHits, 0),
      embeddedTexts: entries.reduce((sum, entry) => sum + entry.embeddedTexts, 0),
      documentWarmup: warmup
        ? {
          combinedEmbeddingPhaseMs: warmup.timings?.embeddingMs ?? null,
          requestElapsedMs: warmup.requestElapsedMs,
          aiCalls: warmup.aiCalls,
          cacheHits: warmup.cacheHits,
          embeddedTexts: warmup.embeddedTexts,
          exactDocumentOnlyLatencyMs: null,
          exactDocumentOnlyLatencyStatus:
            "unavailable: legacy lab combines document-cache lookup/embedding and paired-query embedding in one embeddingMs field",
        }
        : null,
      warmPairedQueryEmbeddingPhase: {
        samples: warmEmbedding.length,
        p50Ms: percentile(warmEmbedding, 0.5),
        p95Ms: percentile(warmEmbedding, 0.95),
        minMs: warmEmbedding.length > 0 ? Math.min(...warmEmbedding) : null,
        maxMs: warmEmbedding.length > 0 ? Math.max(...warmEmbedding) : null,
        scope:
          "legacy sweep embedding phase after this strategy's document warm-up; includes D1 document-cache lookup plus query embedding",
      },
      pairedRawExpandedSingleWorkersAiBatch: {
        verifiedOnWarmRequests: singleBatchEvidence,
        warmRequestCount: warm.length,
        modelBatchSize,
        textsPerFullQueryBatch: ORIGINAL_QUERIES_PER_SWEEP * 2,
        interpretation:
          "raw and expanded views are submitted together; once documents are warm, at most one Workers AI call per strategy/request is observed",
      },
    };
  }
  return {
    totals: {
      strategyRequestRecords: requestMetrics.length,
      aiCalls: requestMetrics.reduce((sum, entry) => sum + entry.aiCalls, 0),
      cacheHits: requestMetrics.reduce((sum, entry) => sum + entry.cacheHits, 0),
      embeddedTexts: requestMetrics.reduce((sum, entry) => sum + entry.embeddedTexts, 0),
    },
    byStrategy,
    raw: requestMetrics,
  };
}

function collectVectorMs(value, output) {
  if (!value || typeof value !== "object") return;
  if (typeof value.vectorMs === "number" && Number.isFinite(value.vectorMs)) {
    output.push(value.vectorMs);
  }
  if (Array.isArray(value)) {
    for (const item of value) collectVectorMs(item, output);
    return;
  }
  for (const child of Object.values(value)) collectVectorMs(child, output);
}

function vectorCriticalPathEstimate() {
  let files = [];
  try {
    files = readdirSync(resolve(evalDir, "out"))
      .filter((name) => name.endsWith("-live.json"))
      .map((name) => resolve(evalDir, "out", name));
  } catch {
    files = [];
  }
  const samples = [];
  for (const file of files) {
    try {
      collectVectorMs(readJson(file), samples);
    } catch {
      // A partial or obsolete local record is ignored, never fatal.
    }
  }
  if (samples.length < 2) {
    return {
      available: false,
      sampleCount: samples.length,
      sourceFileCount: files.length,
      reason: "fewer than two deployed-live vectorMs samples were available locally",
    };
  }

  // Empirical max-of-two distribution. This is a critical-path estimate under
  // an explicit iid-marginal assumption, not a claim about actual correlation.
  const parallelMaxima = [];
  for (const left of samples) for (const right of samples) parallelMaxima.push(Math.max(left, right));
  return {
    available: true,
    sampleCount: samples.length,
    sourceFileCount: files.length,
    singleVectorizeMs: {
      p50: percentile(samples, 0.5),
      p95: percentile(samples, 0.95),
      max: Math.max(...samples),
    },
    twoParallelVectorizeCriticalPathMs: {
      p50: percentile(parallelMaxima, 0.5),
      p95: percentile(parallelMaxima, 0.95),
      max: Math.max(...parallelMaxima),
    },
    method: "empirical max of every pair of deployed-live vectorMs samples",
    assumption: "the two concurrent Vectorize calls have iid latency drawn from the observed marginal distribution",
    caveat: "actual calls may be correlated; this estimate is not a measured paired production trace",
  };
}

function formatPercent(value) {
  return value === null ? "-" : `${(value * 100).toFixed(1)}%`;
}

function formatMetric(metric, withInterval = false) {
  if (!metric || metric.denominator === 0) return "0/0 (-)";
  const base = `${metric.numerator}/${metric.denominator} (${formatPercent(metric.value)})`;
  if (!withInterval || !metric.wilson95) return base;
  return `${base} [${formatPercent(metric.wilson95.low)}, ${formatPercent(metric.wilson95.high)}]`;
}

function formatScore(value) {
  return value === null || value === undefined ? "-" : value.toFixed(3);
}

function markdownTable(headers, rows) {
  const escaped = (value) => String(value ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");
  return [
    `| ${headers.map(escaped).join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.map(escaped).join(" | ")} |`),
  ].join("\n");
}

function reportRows(summary, slice) {
  const rows = [];
  for (const [strategyName, configs] of Object.entries(summary.reports)) {
    for (const [configName, report] of Object.entries(configs)) {
      const metrics = report.slices[slice];
      if (!metrics) continue;
      rows.push([
        strategyName,
        configName,
        formatMetric(metrics.metrics.candidateAt40),
        formatMetric(metrics.metrics.recallAt1),
        formatMetric(metrics.metrics.recallAt3, true),
        `${metrics.mrr.numerator.toFixed(2)}/${metrics.mrr.denominator} (${formatScore(metrics.mrr.value)})`,
        formatMetric(metrics.metrics.lineAt1),
        formatMetric(metrics.metrics.lineAt3, true),
        formatMetric(metrics.metrics.requiredRank),
        formatMetric(metrics.metrics.negativeClean, true),
        formatMetric(metrics.metrics.forbiddenAt1, true),
        formatMetric(metrics.metrics.forbiddenAt3),
        formatMetric(metrics.metrics.forbiddenAt8),
        formatScore(metrics.scoreGaps.globalGap),
        `${metrics.rescue.rescuedPositiveHits}/${metrics.rescue.rescuedRequiredRanks}/` +
          `${metrics.rescue.negativeCleanRegressions}`,
      ]);
    }
  }
  return rows;
}

const REPORT_HEADERS = [
  "strategy",
  "offline replay",
  "target-line C@40",
  "R@1",
  "R@3 (Wilson95)",
  "MRR",
  "line@1",
  "line@3 (Wilson95)",
  "requiredRank",
  "negative-clean (Wilson95)",
  "forbidden@1 (Wilson95)",
  "forbidden@3",
  "forbidden@8",
  "score gap",
  "rescued hit/rank/neg-regress",
];

function buildMarkdownReport(summary) {
  const slices = [
    "all",
    "semantic-only",
    ...unique(summary.queries.sources.map((source) => source.name)),
  ];
  const sections = [
    "# Large semantic-search experiment",
    "",
    `- Complete: **${summary.complete}**`,
    `- Corpus: ${summary.corpus.noteCount} synthetic notes / ${summary.corpus.characters} characters`,
    `- Query rows: ${summary.queries.rowCount}; unique query texts: ${summary.queries.uniqueTextCount}`,
    `- Lab requests: ${summary.requests.actual}/${summary.requests.safetyCeiling} ` +
      `(planned ${summary.requests.planned}; deployed limit ${summary.requests.deployedRateLimit}/5min)`,
    `- Blind-final queries executed: **${summary.blindQueriesExecuted}**`,
    "",
    "## Interpretation boundary",
    "",
    ...summary.reconstruction.caveats.map((item) => `- ${item}`),
    "",
  ];
  for (const slice of slices) {
    const rows = reportRows(summary, slice);
    if (rows.length === 0) continue;
    sections.push(`## Metrics: ${slice}`, "", markdownTable(REPORT_HEADERS, rows), "");
  }
  sections.push(
    "## Latency evidence",
    "",
    "Exact document-only warm-up latency is unavailable because the legacy lab combines document and query work in one embedding phase. Raw per-request aiCalls, cacheHits, embeddedTexts, and timings are retained in summary.json.",
    "",
    `Vectorize critical-path estimate: ${JSON.stringify(summary.vectorizeCriticalPathEstimate)}`,
    "",
  );
  return `${sections.join("\n")}\n`;
}

function pairedQueryTexts(originals, template) {
  return originals.flatMap((query) => [query, renderExpandedQuery(template, query)]);
}

function captureProofSummary(captures) {
  const views = [];
  for (const [strategy, byQuery] of captures) {
    for (const [query, capture] of byQuery) {
      views.push({ strategy, query, view: "raw", ...capture.raw.proof });
      views.push({ strategy, query, view: "expanded", ...capture.expanded.proof });
    }
  }
  const margins = views
    .map((view) => view.excludedNoteBestScoreUpperBound === null
      ? null
      : view.cutoff - view.excludedNoteBestScoreUpperBound)
    .filter((value) => typeof value === "number");
  return {
    complete: views.length > 0 && views.every((view) => view.complete),
    viewCount: views.length,
    exactLocalChunkIdentityProxy: true,
    boundaryTupleToChunkIndexOneToOne: true,
    minimumTop40BoundaryMargin: margins.length > 0 ? Math.min(...margins) : null,
    minimumReconstructedChunks: views.length > 0
      ? Math.min(...views.map((view) => view.reconstructedChunks))
      : null,
  };
}

function sourceCounts(items, field) {
  const counts = new Map();
  for (const item of items) counts.set(item[field], (counts.get(item[field]) ?? 0) + 1);
  return [...counts.entries()].map(([name, count]) => ({ name, count }));
}

function dryRunOutput(plan, vectorEstimate) {
  const lines = [
    "Large semantic-search experiment dry-run (no network)",
    `corpus: ${plan.notes.length} synthetic notes, ${plan.validation.corpusChars} characters`,
    `corpus sources: ${sourceCounts(plan.notes, "corpus").map((item) => `${item.name}=${item.count}`).join(", ")}`,
    `query rows: ${plan.queries.length}; unique texts: ${plan.uniqueOriginalQueries.length}`,
    `query sources: ${sourceCounts(plan.queries, "suite").map((item) => `${item.name}=${item.count}`).join(", ")}`,
    `legacy lexical-regression queries: ${plan.validation.lexicalRegressionQueries.length} ` +
      "(reported separately; not a data-leak hard failure)",
    `suites: ${plan.suiteNames.join(", ")}; subset: ${plan.subset}`,
    `expanded template: ${JSON.stringify(plan.expansionTemplate)}`,
    `strategy groups: ${plan.groups.map((group) => `${group.name}(${group.strategies.length})`).join(", ")}`,
    `query batches: ${plan.queryBatches.length} × up to ${ORIGINAL_QUERIES_PER_SWEEP} originals / 6 texts`,
    `seed batches: ${plan.seedBatches.length} × up to ${MAX_SEED_BATCH} notes; enqueue=false`,
    `planned requests: ${plan.expectedRequests}/${MAX_REQUESTS_PER_RUN} safety ceiling ` +
      `(deployed ${LAB_RATE_LIMIT}/5min)`,
    `blind-final query file loaded: false`,
    `local chunk proof: ${plan.chunkProof.shapeStats.map((item) =>
      `${item.strategy}=max${item.maxChunksPerNote}`).join(", ")}`,
    `Vectorize estimate samples: ${vectorEstimate.sampleCount ?? 0}; available=${vectorEstimate.available}`,
    "status: VALID; --dry-run performed no fetch and wrote no output files",
  ];
  console.log(lines.join("\n"));
}

async function executeExperiment(plan, flags) {
  const runId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${safeLabel(flags.label)}`;
  const outputDir = resolve(outputRoot, runId);
  mkdirSync(outputDir, { recursive: true });
  const rawFile = resolve(outputDir, "raw.ndjson");
  const summaryFile = resolve(outputDir, "summary.json");
  const reportFile = resolve(outputDir, "report.md");
  writeFileSync(rawFile, `${JSON.stringify({
    type: "notesflash-large-experiment-raw-v1",
    createdAt: new Date().toISOString(),
    includeText: true,
    warning: "gitignored synthetic raw responses; contains ephemeral server note IDs and must not be printed",
  })}\n`, "utf8");
  const logRaw = createRawLogger(rawFile);
  const lab = loadLabConfig();
  const timeoutMs = parsePositiveInteger(flags["timeout-ms"], DEFAULT_TIMEOUT_MS, "--timeout-ms");
  let requestCount = 0;
  let activeController = null;
  let interruptedSignal = null;
  let finalCleanupStarted = false;

  const onSignal = (signal) => {
    interruptedSignal = signal;
    if (!finalCleanupStarted) activeController?.abort();
  };
  const onSigint = () => onSignal("SIGINT");
  const onSigterm = () => onSignal("SIGTERM");
  process.once("SIGINT", onSigint);
  process.once("SIGTERM", onSigterm);

  const postLab = async (body, phase, { finalCleanup = false } = {}) => {
    assertSafeLabRequest(body);
    if (requestCount >= MAX_REQUESTS_PER_RUN) {
      throw new Error(`Request safety ceiling ${MAX_REQUESTS_PER_RUN} reached before ${body.action}.`);
    }
    requestCount += 1;
    const controller = new AbortController();
    activeController = controller;
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const started = Date.now();
    try {
      const response = await fetch(`${lab.baseUrl}/api/internal/search-lab`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-lab-token": lab.token,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      const text = await response.text();
      if (!response.ok) {
        // Never echo the protected endpoint body: it may contain diagnostics.
        const failure = new Error(`Protected lab ${body.action} failed with HTTP ${response.status}.`);
        failure.status = response.status;
        throw failure;
      }
      let payload;
      try {
        payload = JSON.parse(text);
      } catch {
        throw new Error(`Protected lab ${body.action} returned invalid JSON.`);
      }
      const elapsedMs = Date.now() - started;
      logRaw(body, payload, elapsedMs, phase);
      return { payload, elapsedMs };
    } catch (error) {
      if (controller.signal.aborted) {
        if (interruptedSignal && !finalCleanup) {
          throw new Error(`Experiment interrupted by ${interruptedSignal}; cleanup will run.`);
        }
        throw new Error(`Protected lab ${body.action} timed out after ${timeoutMs}ms.`);
      }
      throw error;
    } finally {
      clearTimeout(timer);
      if (activeController === controller) activeController = null;
    }
  };

  const postSweep = async (body, phase) => {
    const retryable = new Set([502, 503, 504]);
    let lastError = null;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        return await postLab(body, phase);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        if (!retryable.has(lastError.status) || attempt === 3) throw lastError;
        console.warn(
          `transient sweep HTTP ${lastError.status}; retrying ${attempt + 1}/3`,
        );
        // Workers AI may surface its short-window capacity limit as 503 rather
        // than 429. Give that window time to drain; immediate retries merely
        // repeat the same failure and waste the lab request budget.
        const retryDelayMs = attempt === 1 ? 5_000 : 15_000;
        await new Promise((resolveDelay) => setTimeout(resolveDelay, retryDelayMs));
      }
    }
    throw lastError ?? new Error("Protected lab sweep failed.");
  };

  const captures = new Map();
  const requestMetrics = [];
  let primaryError = null;
  let replayReports = null;
  let initialCleanup = null;
  let finalCleanup = null;
  let insertedNotes = 0;
  const startedAt = Date.now();

  const runSweepCapture = async ({
    strategies,
    originals,
    phase,
    batchIndex,
    groupName,
  }) => {
    const body = {
      action: "sweep",
      corpus: "eval",
      includeText: true,
      maxNotes: MAX_LAB_NOTES,
      queries: pairedQueryTexts(originals, plan.expansionTemplate),
      strategies,
    };
    try {
      const { payload, elapsedMs } = await postSweep(body, phase);
      processSweepPayload({
        payload,
        requestedStrategies: strategies,
        originals,
        plan,
        captures,
        requestMetrics,
        phase,
        elapsedMs,
        batchIndex,
        groupName,
      });
      return;
    } catch (error) {
      const failure = error instanceof Error ? error : new Error(String(error));
      const retryable = new Set([502, 503, 504]);
      if (!retryable.has(failure.status)) throw failure;

      // A legacy Worker may reject a large model/shape or query batch even
      // though each member is valid. Split without changing any text, score,
      // or strategy. A single-strategy, single-original failure remains fatal.
      if (strategies.length > 1) {
        console.warn(`splitting ${strategies.length}-strategy sweep after HTTP ${failure.status}`);
        const midpoint = Math.ceil(strategies.length / 2);
        for (const [index, subset] of [
          strategies.slice(0, midpoint),
          strategies.slice(midpoint),
        ].filter((items) => items.length > 0).entries()) {
          await runSweepCapture({
            strategies: subset,
            originals,
            phase,
            batchIndex,
            groupName: `${groupName}-strategy-split-${index + 1}`,
          });
        }
        return;
      }
      if (originals.length > 1) {
        console.warn(`splitting ${originals.length}-query sweep after HTTP ${failure.status}`);
        for (const [index, original] of originals.entries()) {
          await runSweepCapture({
            strategies,
            originals: [original],
            phase,
            batchIndex: `${batchIndex}.${index + 1}`,
            groupName: `${groupName}-query-split`,
          });
        }
        return;
      }
      throw failure;
    }
  };

  try {
    ({ payload: initialCleanup } = await postLab(
      { action: "cleanup", pruneCache: false },
      "initial-cleanup",
    ));

    for (const batch of plan.seedBatches) {
      const body = {
        action: "seed",
        enqueue: false,
        notes: batch.map((note) => ({ title: note.seededTitle, body: note.body })),
      };
      const { payload } = await postLab(body, "seed");
      if (payload.enqueued !== 0) throw new Error("Legacy lab unexpectedly enqueued synthetic notes.");
      if (payload.inserted !== batch.length) {
        throw new Error(`Legacy lab inserted ${payload.inserted}/${batch.length} notes.`);
      }
      insertedNotes += payload.inserted;
    }
    if (insertedNotes !== plan.notes.length) {
      throw new Error(`Seeded ${insertedNotes}/${plan.notes.length} synthetic notes.`);
    }

    const warmupOriginals = plan.queryBatches[0];
    for (const item of plan.strategies) {
      await runSweepCapture({
        strategies: [item],
        originals: warmupOriginals,
        phase: "document-warmup",
        batchIndex: 0,
        groupName: item.name,
      });
      console.log(`warm-up complete: ${item.name}`);
    }

    for (let batchIndex = 1; batchIndex < plan.queryBatches.length; batchIndex += 1) {
      const originals = plan.queryBatches[batchIndex];
      for (const group of plan.groups) {
        await runSweepCapture({
          strategies: group.strategies,
          originals,
          phase: "warm-query-batch",
          batchIndex,
          groupName: group.name,
        });
      }
      if (batchIndex % 5 === 0 || batchIndex === plan.queryBatches.length - 1) {
        console.log(`query batches complete: ${batchIndex + 1}/${plan.queryBatches.length}`);
      }
    }

    replayReports = replayExperiment(plan, captures);
  } catch (error) {
    primaryError = error instanceof Error ? error : new Error(String(error));
  } finally {
    finalCleanupStarted = true;
    try {
      ({ payload: finalCleanup } = await postLab(
        { action: "cleanup", pruneCache: false },
        "final-cleanup",
        { finalCleanup: true },
      ));
    } catch (error) {
      const cleanupError = error instanceof Error ? error : new Error(String(error));
      primaryError = primaryError
        ? new Error(`${primaryError.message}; final cleanup also failed: ${cleanupError.message}`)
        : cleanupError;
    }
    process.removeListener("SIGINT", onSigint);
    process.removeListener("SIGTERM", onSigterm);
  }

  if (primaryError) {
    writeFileSync(resolve(outputDir, "failure.json"), JSON.stringify({
      complete: false,
      failedAt: new Date().toISOString(),
      error: primaryError.message,
      requestsAttempted: requestCount,
      insertedNotes,
      finalCleanupAttempted: finalCleanupStarted,
      finalCleanupSucceeded: finalCleanup !== null,
      rawResponseFile: relative(outputDir, rawFile),
    }, null, 2));
    throw new Error(`${primaryError.message} Failure record: ${resolve(outputDir, "failure.json")}`);
  }

  const proof = captureProofSummary(captures);
  if (!proof.complete) throw new Error("Top-40 reconstruction proof is incomplete.");
  const vectorEstimate = vectorCriticalPathEstimate();
  const inputArtifacts = [
    ...CORPUS_FILES.map((source) => ({ kind: "corpus", name: source.name, path: source.path })),
    ...plan.suiteNames.flatMap((suiteName) =>
      QUERY_FILES[suiteName].map((source) => ({
        kind: "queries",
        name: source.name,
        path: source.path,
      }))
    ),
  ].map((artifact) => ({
    kind: artifact.kind,
    name: artifact.name,
    file: relative(cloudDir, artifact.path),
    sha256: sha256File(artifact.path),
  }));
  const summary = {
    schemaVersion: 1,
    complete: true,
    createdAt: new Date().toISOString(),
    elapsedMs: Date.now() - startedAt,
    blindQueriesExecuted: false,
    corpus: {
      noteCount: plan.notes.length,
      characters: plan.validation.corpusChars,
      sources: sourceCounts(plan.notes, "corpus"),
      seedTitlePrefix: EVAL_PREFIX,
      metadataKeysEmbedded: false,
      duplicateTitleDisambiguation: "punctuation-only middle-dot suffix",
      insertedNotes,
    },
    queries: {
      suiteKinds: plan.suiteNames,
      subset: plan.subset,
      rowCount: plan.queries.length,
      uniqueTextCount: plan.uniqueOriginalQueries.length,
      sources: sourceCounts(plan.queries, "suite"),
      lexicalRegressionQueries: plan.validation.lexicalRegressionQueries,
      expandedView: {
        template: plan.expansionTemplate,
        defaultTemplate: DEFAULT_EXPANSION_TEMPLATE,
        pairedInSameSweepRequest: true,
        originalQueriesPerRequest: ORIGINAL_QUERIES_PER_SWEEP,
        textsPerFullRequest: ORIGINAL_QUERIES_PER_SWEEP * 2,
      },
    },
    strategies: plan.groups.map((group) => ({
      name: group.name,
      strategies: group.strategies.map((item) => ({
        name: item.name,
        model: item.model,
        instruction: item.instruction ?? null,
        chunking: item.chunking,
      })),
    })),
    oracleAggregation: ORACLE_AGGREGATION,
    replayConfigurations: REPLAY_CONFIGS,
    requests: {
      planned: plan.expectedRequests,
      actual: requestCount,
      safetyCeiling: MAX_REQUESTS_PER_RUN,
      deployedRateLimit: LAB_RATE_LIMIT,
      maxStrategiesPerRequest: MAX_STRATEGIES_PER_SWEEP,
      maxQueryTextsPerRequest: 6,
      initialCleanup,
      finalCleanup,
    },
    localChunkProof: {
      source: "cloud/src/chunking.ts",
      sourceSha256: sha256File(resolve(cloudDir, "src", "chunking.ts")),
      shapes: plan.chunkProof.shapeStats,
    },
    reconstruction: {
      ...proof,
      productionEquivalent: false,
      exactChunkIdentityProxyScope:
        "this seeded corpus and each tested local/server chunk shape after exact count, boundary, text, and Top-40 cutoff proofs",
      caveats: [
        "The common [EVAL] title marker is embedded by title-context strategies; gemma-body-only disables both title context and title chunks as a marker-free control.",
        "The sweep computes brute-force cosine similarity, whereas production candidate retrieval uses approximate Vectorize ANN; ranking results are not production-equivalent.",
        "Exact chunk identity is a proved local proxy only because every returned boundary tuple maps one-to-one to a local chunk index; chunks omitted by the legacy non-negative effective floor are accepted only when the proved Top-40 cutoff is strictly higher.",
        "The deployed overlap=1 shape cannot expose an exact chunk Top-40 through the legacy lab because overlapping windows may share a primary-line anchor; it is excluded from ranking and threshold selection and is not a publishable candidate from this experiment.",
        "If an overlap=0 shape passes every public gate and is selected, production chunking configuration must also move to overlap=0 and the complete chunk index must be rebuilt before release.",
        "The experiment bypasses lexical-first routing, pending-index freshness, span refinement, and real-network Vectorize candidate loss.",
        "Legacy golden/short regression queries that literally occur somewhere in the merged corpus are retained for historical comparison, flagged in metadata, and excluded by the semantic-only report slice.",
      ],
    },
    requestEvidence: summarizeRequestMetrics(requestMetrics),
    vectorizeCriticalPathEstimate: vectorEstimate,
    reports: replayReports,
    artifacts: {
      runner: {
        file: relative(cloudDir, fileURLToPath(import.meta.url)),
        sha256: sha256File(fileURLToPath(import.meta.url)),
      },
      evaluator: {
        file: relative(cloudDir, resolve(evalDir, "metrics.mjs")),
        sha256: sha256File(resolve(evalDir, "metrics.mjs")),
      },
      inputs: inputArtifacts,
      rawResponseFile: relative(outputDir, rawFile),
      summaryFile: relative(outputDir, summaryFile),
      reportFile: relative(outputDir, reportFile),
    },
  };
  writeFileSync(summaryFile, JSON.stringify(summary, null, 2));
  writeFileSync(reportFile, buildMarkdownReport(summary));

  console.log("\nCombined metrics (all selected public queries):");
  console.log(markdownTable(REPORT_HEADERS, reportRows(summary, "all")));
  console.log(`\nraw: ${rawFile}`);
  console.log(`summary: ${summaryFile}`);
  console.log(`report: ${reportFile}`);
  return summary;
}

async function main() {
  const flags = parseArgs(process.argv.slice(2));
  if (flags.help === true) {
    console.log(usage());
    return;
  }
  const plan = buildPlan(flags);
  const vectorEstimate = vectorCriticalPathEstimate();
  if (flags["dry-run"] === true) {
    dryRunOutput(plan, vectorEstimate);
    return;
  }
  await executeExperiment(plan, flags);
}

export {
  buildPlan,
  processSweepPayload,
  replayExperiment,
  REPLAY_CONFIGS,
  summarizeRows,
};

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
