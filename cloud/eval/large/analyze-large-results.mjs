#!/usr/bin/env node
/**
 * Offline analysis for successful run-large-experiment result directories.
 *
 * This program deliberately has no code path that calls the protected lab or
 * reads blind-final-holdout.json. It rebuilds the public plan from the current
 * hashed inputs, reconstructs exact Top-40 captures from raw.ndjson through
 * run-large-experiment's exported guards, and replays a threshold grid locally.
 * Analysis artifacts are written only below cloud/eval/out, which is ignored.
 */

import {
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { basename, dirname, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  buildPlan,
  processSweepPayload,
  replayExperiment,
  REPLAY_CONFIGS,
} from "./run-large-experiment.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const cloudDir = resolve(here, "..", "..");
const evalDir = resolve(cloudDir, "eval");
const ignoredOutputRoot = resolve(evalDir, "out", "large-analysis");

const RAW_SCHEMA = "notesflash-large-experiment-raw-v1";
const OUTPUT_SCHEMA = "notesflash-large-offline-analysis-v1";
const DEFAULT_SLICE = "semantic-only";
const DEFAULT_TOP = 50;
const DEFAULT_REPLAY_BATCH_SIZE = 100;
const MAX_GRID_CONFIGS = 5_000;

// Fixed before inspecting a replay grid. These are the public calibration
// evidence gates and lexicographic selection order in EXPERIMENT_PROTOCOL.md.
const CALIBRATION_GATE = Object.freeze({
  name: "preregistered-development-calibration-gate-v1",
  candidateAt40Min: 0.96,
  negativeCleanMin: 0.88,
  forbiddenAt1Max: 0.05,
  selectionOrder: [
    "requiredRank:desc",
    "lineAt3:desc",
    "recallAt3:desc",
    "mrr:desc",
    "aiCallsPerRequest:asc",
    "warmEmbeddingP50Ms:asc",
  ],
  interpretation:
    "Failing configurations are discarded; passing configurations are ranked lexicographically by the registered selection order.",
});

const COMPREHENSIVE_GRID = Object.freeze({
  primaryMinCosines: Object.freeze([
    0.22, 0.23, 0.235, 0.24, 0.25, 0.26, 0.27,
    0.28, 0.29, 0.3, 0.31, 0.32, 0.33, 0.34,
  ]),
  consensusPrimaryMinCosines: Object.freeze([0.28, 0.29, 0.3, 0.31, 0.32]),
  relativeMinRatios: Object.freeze([0.5, 0.55, 0.6, 0.65, 0.7]),
  rawMinCosines: Object.freeze([0.21, 0.22, 0.23, 0.235, 0.24, 0.25, 0.26, 0.27, 0.28, 0.29]),
  expandedMinCosines: Object.freeze([0.26, 0.27, 0.28, 0.29, 0.3, 0.31, 0.32, 0.33, 0.34]),
});

const AXIS_FLAGS = Object.freeze({
  "primary-min-cosines": "primaryMinCosines",
  "consensus-primary-min-cosines": "consensusPrimaryMinCosines",
  "relative-ratios": "relativeMinRatios",
  "raw-min-cosines": "rawMinCosines",
  "expanded-min-cosines": "expandedMinCosines",
});

const VALUE_FLAGS = new Set([
  "grid",
  "kinds",
  "slice",
  "top",
  "label",
  "output-dir",
  "replay-batch-size",
  ...Object.keys(AXIS_FLAGS),
]);
const BOOLEAN_FLAGS = new Set(["dry-run", "help"]);

function usage() {
  return `Usage:
  node cloud/eval/large/analyze-large-results.mjs [options] RUN_DIR [RUN_DIR ...]

RUN_DIR must contain a successful summary.json and raw.ndjson from
run-large-experiment.mjs. A direct path to summary.json is also accepted.

Options:
  --grid comprehensive|focused       Threshold grid (default: comprehensive)
  --kinds primary,consensus          Grid families (default: both)
  --primary-min-cosines LIST         Primary absolute-floor axis
  --consensus-primary-min-cosines L  Consensus primary-floor axis
  --relative-ratios LIST             Relative-floor axis
  --raw-min-cosines LIST             Consensus raw-floor axis
  --expanded-min-cosines LIST        Consensus expanded-floor axis
  --slice NAME                       Comparison slice (default: semantic-only)
  --replay-batch-size N              Bound replay memory (default: 100)
  --top N                            Markdown rows per cohort (default: 50)
  --label NAME                       Default output-directory suffix
  --output-dir DIR                   Must remain below cloud/eval/out
  --dry-run                          Analyze fully but write no files
  --help                             Show this help

LIST is a comma-separated list of finite values in [0,1]. The focused grid is
the five registered runner configurations and cannot be combined with custom
axes. This analyzer never loads or accepts a blind-final result.`;
}

function parseArgs(argv) {
  const flags = {};
  const runs = [];
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (!value.startsWith("--")) {
      runs.push(value);
      continue;
    }
    const name = value.slice(2);
    if (BOOLEAN_FLAGS.has(name)) {
      flags[name] = true;
      continue;
    }
    if (!VALUE_FLAGS.has(name)) throw new Error(`Unknown option --${name}.`);
    const next = argv[index + 1];
    if (next === undefined || next.startsWith("--")) {
      throw new Error(`--${name} requires a value.`);
    }
    flags[name] = next;
    index += 1;
  }
  return { flags, runs };
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function sha256Bytes(value) {
  return createHash("sha256").update(value).digest("hex");
}

function sha256File(path) {
  return sha256Bytes(readFileSync(path));
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value).sort().map((key) => [key, stableValue(value[key])]),
    );
  }
  return value;
}

function stableJson(value) {
  return JSON.stringify(stableValue(value));
}

function canonicalHash(value) {
  return sha256Bytes(stableJson(value));
}

function assertInside(root, candidate, label, allowRoot = false) {
  const pathFromRoot = relative(root, candidate);
  if (
    (!allowRoot && pathFromRoot === "") ||
    pathFromRoot === ".." ||
    pathFromRoot.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`) ||
    resolve(root, pathFromRoot) !== candidate
  ) {
    throw new Error(`${label} escapes ${root}: ${candidate}`);
  }
}

function isBlindFinalReference(value) {
  return /(?:^|[\/_-])blind[-_]?final(?:[\/_-]|$)/iu.test(String(value));
}

function resolveSummaryPath(input) {
  const candidate = resolve(process.cwd(), input);
  if (!existsSync(candidate)) throw new Error(`Result path does not exist: ${candidate}`);
  const summaryPath = statSync(candidate).isDirectory()
    ? resolve(candidate, "summary.json")
    : candidate;
  if (basename(summaryPath) !== "summary.json") {
    throw new Error(`Expected a result directory or summary.json: ${candidate}`);
  }
  if (!existsSync(summaryPath)) throw new Error(`Missing successful summary: ${summaryPath}`);
  return summaryPath;
}

function requireFiniteProbability(value, label) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || number > 1) {
    throw new Error(`${label} must contain only finite values in [0,1].`);
  }
  return number;
}

function parseAxis(value, fallback, label) {
  if (value === undefined) return [...fallback];
  const parsed = String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => requireFiniteProbability(item, label));
  if (parsed.length === 0) throw new Error(`${label} cannot be empty.`);
  return [...new Set(parsed)].sort((left, right) => left - right);
}

function parsePositiveInteger(value, fallback, label, maximum = Number.MAX_SAFE_INTEGER) {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > maximum) {
    throw new Error(`${label} must be an integer from 1 to ${maximum}.`);
  }
  return parsed;
}

function safeLabel(value) {
  const normalized = String(value ?? "calibration-grid")
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized.slice(0, 48) || "calibration-grid";
}

function decimalLabel(value) {
  return Number(value.toFixed(6)).toString();
}

function configIdentity(config) {
  return stableJson({
    kind: config.kind,
    minCosine: config.minCosine,
    relativeMinRatio: config.relativeMinRatio,
    rawMinCosine: config.rawMinCosine ?? null,
    expandedMinCosine: config.expandedMinCosine ?? null,
  });
}

function primaryConfig(minCosine, relativeMinRatio) {
  const baseline = minCosine === 0.3 && relativeMinRatio === 0.6;
  return {
    name: baseline
      ? "baseline-0.3-0.6"
      : `primary-a${decimalLabel(minCosine)}-r${decimalLabel(relativeMinRatio)}`,
    kind: "primary",
    minCosine,
    relativeMinRatio,
  };
}

function consensusConfig(minCosine, relativeMinRatio, rawMinCosine, expandedMinCosine) {
  return {
    name:
      `consensus-a${decimalLabel(minCosine)}-r${decimalLabel(relativeMinRatio)}` +
      `-raw${decimalLabel(rawMinCosine)}-expanded${decimalLabel(expandedMinCosine)}`,
    kind: "consensus",
    minCosine,
    relativeMinRatio,
    rawMinCosine,
    expandedMinCosine,
  };
}

function deduplicateConfigs(configs) {
  const byIdentity = new Map();
  for (const config of configs) {
    const identity = configIdentity(config);
    const existing = byIdentity.get(identity);
    if (!existing || config.name === "baseline-0.3-0.6") byIdentity.set(identity, config);
  }
  const values = [...byIdentity.values()];
  const baselineIndex = values.findIndex((config) => config.name === "baseline-0.3-0.6");
  if (baselineIndex > 0) values.unshift(...values.splice(baselineIndex, 1));
  return values;
}

function buildGrid(flags) {
  const gridName = flags.grid === undefined ? "comprehensive" : String(flags.grid);
  if (!new Set(["comprehensive", "focused"]).has(gridName)) {
    throw new Error("--grid must be comprehensive or focused.");
  }
  const kinds = flags.kinds === undefined
    ? new Set(["primary", "consensus"])
    : new Set(String(flags.kinds).split(",").map((item) => item.trim()).filter(Boolean));
  const unknownKinds = [...kinds].filter((kind) => kind !== "primary" && kind !== "consensus");
  if (kinds.size === 0 || unknownKinds.length > 0) {
    throw new Error("--kinds must select primary, consensus, or both.");
  }
  const customAxes = Object.keys(AXIS_FLAGS).filter((name) => flags[name] !== undefined);
  if (gridName === "focused" && customAxes.length > 0) {
    throw new Error("Custom threshold axes require --grid comprehensive.");
  }

  let axes = null;
  let configs;
  if (gridName === "focused") {
    configs = REPLAY_CONFIGS.filter((config) => kinds.has(config.kind)).map((config) => ({ ...config }));
  } else {
    axes = Object.fromEntries(
      Object.entries(AXIS_FLAGS).map(([flag, key]) => [
        key,
        parseAxis(flags[flag], COMPREHENSIVE_GRID[key], `--${flag}`),
      ]),
    );
    configs = [];
    if (kinds.has("primary")) {
      for (const minCosine of axes.primaryMinCosines) {
        for (const relativeMinRatio of axes.relativeMinRatios) {
          configs.push(primaryConfig(minCosine, relativeMinRatio));
        }
      }
    }
    if (kinds.has("consensus")) {
      for (const minCosine of axes.consensusPrimaryMinCosines) {
        for (const rawMinCosine of axes.rawMinCosines) {
          // Production validation requires the rescue raw floor to be below
          // the primary absolute floor; equal/higher combinations are no-ops.
          if (rawMinCosine >= minCosine) continue;
          for (const expandedMinCosine of axes.expandedMinCosines) {
            for (const relativeMinRatio of axes.relativeMinRatios) {
              configs.push(consensusConfig(
                minCosine,
                relativeMinRatio,
                rawMinCosine,
                expandedMinCosine,
              ));
            }
          }
        }
      }
    }
  }

  // replayExperiment uses this exact name as the raw-path reference for
  // rescue deltas, so it is always present even for a consensus-only grid.
  configs = deduplicateConfigs([primaryConfig(0.3, 0.6), ...configs]);
  if (configs.length > MAX_GRID_CONFIGS) {
    throw new Error(`Grid has ${configs.length} configurations; maximum is ${MAX_GRID_CONFIGS}.`);
  }
  return {
    name: gridName,
    kinds: [...kinds],
    customAxes,
    axes,
    referenceBaselineIncluded: true,
    configCount: configs.length,
    primaryConfigCount: configs.filter((config) => config.kind === "primary").length,
    consensusConfigCount: configs.filter((config) => config.kind === "consensus").length,
    configs,
  };
}

function sourceCounts(items, field) {
  const counts = new Map();
  for (const item of items) counts.set(item[field], (counts.get(item[field]) ?? 0) + 1);
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

function validateCompleteSummary(summary, summaryPath) {
  if (summary.schemaVersion !== 1) {
    throw new Error(`${summaryPath}: unsupported summary schema ${summary.schemaVersion}.`);
  }
  if (summary.complete !== true) throw new Error(`${summaryPath}: run is not complete.`);
  if (summary.reconstruction?.complete !== true) {
    throw new Error(`${summaryPath}: Top-40 reconstruction is not complete.`);
  }
  if (summary.blindQueriesExecuted !== false) {
    throw new Error(`${summaryPath}: refusing a result that executed blind-final queries.`);
  }
  if (summary.corpus?.metadataKeysEmbedded !== false) {
    throw new Error(`${summaryPath}: synthetic metadata-key isolation is not proven.`);
  }
  if (!Array.isArray(summary.queries?.suiteKinds) || summary.queries.suiteKinds.length === 0) {
    throw new Error(`${summaryPath}: suiteKinds are unavailable.`);
  }
  if (
    summary.queries.suiteKinds.some(isBlindFinalReference) ||
    (summary.queries.sources ?? []).some((source) => isBlindFinalReference(source.name))
  ) {
    throw new Error(`${summaryPath}: refusing blind-final suite metadata.`);
  }
  if (!Array.isArray(summary.artifacts?.inputs) || summary.artifacts.inputs.length === 0) {
    throw new Error(`${summaryPath}: recorded input hashes are unavailable.`);
  }
  if (!Array.isArray(summary.replayConfigurations) || summary.replayConfigurations.length === 0) {
    throw new Error(`${summaryPath}: recorded replay configurations are unavailable.`);
  }
  if (!summary.reports || typeof summary.reports !== "object") {
    throw new Error(`${summaryPath}: recorded reports are unavailable.`);
  }
}

function expectedInputKeys(summary) {
  return [
    ...(summary.corpus?.sources ?? []).map((source) => `corpus:${source.name}`),
    ...(summary.queries?.sources ?? []).map((source) => `queries:${source.name}`),
  ].sort();
}

function validateInputHashes(summary, summaryPath) {
  const artifacts = summary.artifacts.inputs;
  const actualKeys = artifacts.map((artifact) => `${artifact.kind}:${artifact.name}`).sort();
  const expectedKeys = expectedInputKeys(summary);
  if (stableJson(actualKeys) !== stableJson(expectedKeys)) {
    throw new Error(
      `${summaryPath}: input artifact set does not match recorded corpus/query sources.`,
    );
  }
  if (new Set(actualKeys).size !== actualKeys.length) {
    throw new Error(`${summaryPath}: duplicate input artifact identity.`);
  }

  const validations = [];
  for (const artifact of artifacts) {
    if (
      typeof artifact.file !== "string" ||
      typeof artifact.sha256 !== "string" ||
      isBlindFinalReference(artifact.file) ||
      isBlindFinalReference(artifact.name)
    ) {
      throw new Error(`${summaryPath}: invalid or blind-final input artifact metadata.`);
    }
    const path = resolve(cloudDir, artifact.file);
    assertInside(cloudDir, path, "Input artifact", true);
    if (!existsSync(path)) throw new Error(`${summaryPath}: missing input artifact ${artifact.file}.`);
    const currentSha256 = sha256File(path);
    if (currentSha256 !== artifact.sha256) {
      throw new Error(
        `${summaryPath}: input hash drift for ${artifact.file}; ` +
        `recorded=${artifact.sha256} current=${currentSha256}.`,
      );
    }
    validations.push({
      kind: artifact.kind,
      name: artifact.name,
      file: artifact.file,
      recordedSha256: artifact.sha256,
      currentSha256,
      matches: true,
    });
  }
  return validations;
}

function inspectSourceArtifact(artifact) {
  if (!artifact || typeof artifact.file !== "string" || typeof artifact.sha256 !== "string") {
    return { available: false, matches: false, reason: "recorded artifact metadata unavailable" };
  }
  if (isBlindFinalReference(artifact.file)) {
    throw new Error("Refusing a source artifact with a blind-final path.");
  }
  const path = resolve(cloudDir, artifact.file);
  assertInside(cloudDir, path, "Source artifact", true);
  if (!existsSync(path)) {
    return {
      available: false,
      matches: false,
      file: artifact.file,
      recordedSha256: artifact.sha256,
      reason: "current file is missing",
    };
  }
  const currentSha256 = sha256File(path);
  return {
    available: true,
    matches: currentSha256 === artifact.sha256,
    file: artifact.file,
    recordedSha256: artifact.sha256,
    currentSha256,
  };
}

function summaryStrategyDefinitions(summary) {
  return (summary.strategies ?? []).flatMap((group) => group.strategies ?? []);
}

function planFlagsFromSummary(summary) {
  const strategyNames = summaryStrategyDefinitions(summary).map((strategy) => strategy.name);
  if (strategyNames.length === 0 || new Set(strategyNames).size !== strategyNames.length) {
    throw new Error("Recorded strategy names are missing or duplicated.");
  }
  return {
    suite: summary.queries.suiteKinds.join(","),
    subset: summary.queries.subset,
    "expanded-template": summary.queries.expandedView?.template,
    strategies: strategyNames.join(","),
  };
}

function validatePlanAgainstSummary(plan, summary, summaryPath) {
  const failures = [];
  if (plan.notes.length !== summary.corpus.noteCount) {
    failures.push(`notes ${plan.notes.length}/${summary.corpus.noteCount}`);
  }
  if (plan.validation.corpusChars !== summary.corpus.characters) {
    failures.push(`characters ${plan.validation.corpusChars}/${summary.corpus.characters}`);
  }
  if (plan.queries.length !== summary.queries.rowCount) {
    failures.push(`query rows ${plan.queries.length}/${summary.queries.rowCount}`);
  }
  if (plan.uniqueOriginalQueries.length !== summary.queries.uniqueTextCount) {
    failures.push(
      `unique queries ${plan.uniqueOriginalQueries.length}/${summary.queries.uniqueTextCount}`,
    );
  }
  if (plan.expansionTemplate !== summary.queries.expandedView?.template) {
    failures.push("expanded-view template");
  }
  if (
    stableJson(sourceCounts(plan.notes, "corpus")) !==
    stableJson([...(summary.corpus.sources ?? [])].sort((a, b) => a.name.localeCompare(b.name)))
  ) {
    failures.push("corpus source counts");
  }
  if (
    stableJson(sourceCounts(plan.queries, "suite")) !==
    stableJson([...(summary.queries.sources ?? [])].sort((a, b) => a.name.localeCompare(b.name)))
  ) {
    failures.push("query source counts");
  }

  const currentByName = new Map(plan.strategies.map((strategy) => [strategy.name, strategy]));
  for (const recorded of summaryStrategyDefinitions(summary)) {
    const current = currentByName.get(recorded.name);
    if (!current) {
      failures.push(`strategy ${recorded.name} unavailable`);
      continue;
    }
    const expected = {
      name: recorded.name,
      model: recorded.model,
      instruction: recorded.instruction ?? null,
      chunking: recorded.chunking,
    };
    const actual = {
      name: current.name,
      model: current.model,
      instruction: current.instruction ?? null,
      chunking: current.chunking,
    };
    if (stableJson(actual) !== stableJson(expected)) failures.push(`strategy ${recorded.name} definition`);
  }
  if (currentByName.size !== summaryStrategyDefinitions(summary).length) {
    failures.push("strategy count");
  }

  const currentShapeByName = new Map(
    plan.chunkProof.shapeStats.map((shape) => [shape.strategy, shape]),
  );
  for (const recorded of summary.localChunkProof?.shapes ?? []) {
    if (stableJson(currentShapeByName.get(recorded.strategy)) !== stableJson(recorded)) {
      failures.push(`local chunk proof ${recorded.strategy}`);
    }
  }
  if (failures.length > 0) {
    throw new Error(`${summaryPath}: current buildPlan differs from the recorded plan: ${failures.join(", ")}.`);
  }
}

function resolveRawPath(summary, summaryPath) {
  const runDir = dirname(summaryPath);
  const recorded = summary.artifacts?.rawResponseFile;
  if (typeof recorded !== "string" || recorded.length === 0) {
    throw new Error(`${summaryPath}: raw response path is unavailable.`);
  }
  if (isBlindFinalReference(recorded)) throw new Error(`${summaryPath}: refusing blind-final raw path.`);
  const rawPath = resolve(runDir, recorded);
  assertInside(runDir, rawPath, "Raw response file");
  if (!existsSync(rawPath)) throw new Error(`${summaryPath}: missing ${recorded}.`);
  return rawPath;
}

function parseRawRecords(rawPath) {
  const lines = readFileSync(rawPath, "utf8").split(/\r?\n/u).filter(Boolean);
  if (lines.length < 2) throw new Error(`${rawPath}: raw log is empty or incomplete.`);
  let header;
  try {
    header = JSON.parse(lines[0]);
  } catch {
    throw new Error(`${rawPath}: invalid raw header JSON.`);
  }
  if (header.type !== RAW_SCHEMA || header.includeText !== true) {
    throw new Error(`${rawPath}: unsupported or incomplete raw schema.`);
  }
  const records = lines.slice(1).map((line, index) => {
    try {
      return JSON.parse(line);
    } catch {
      throw new Error(`${rawPath}: invalid JSON at data line ${index + 2}.`);
    }
  });
  records.forEach((record, index) => {
    if (record.sequence !== index + 1) {
      throw new Error(`${rawPath}: non-contiguous sequence at data line ${index + 2}.`);
    }
  });
  if (!records.some((record) => record.phase === "final-cleanup" && record.response?.action === "cleanup")) {
    throw new Error(`${rawPath}: successful final cleanup is absent.`);
  }
  return { header, records };
}

function reconstructCaptures(plan, rawPath) {
  const { header, records } = parseRawRecords(rawPath);
  const strategiesByName = new Map(plan.strategies.map((strategy) => [strategy.name, strategy]));
  const captures = new Map();
  const requestMetrics = [];
  let sweepCount = 0;
  for (const record of records) {
    if (record.request?.action !== "sweep") continue;
    sweepCount += 1;
    const names = record.request.strategyNames;
    if (!Array.isArray(names) || names.length === 0) {
      throw new Error(`${rawPath}: sweep ${record.sequence} lacks requested strategy names.`);
    }
    const requestedStrategies = names.map((name) => {
      const strategy = strategiesByName.get(name);
      if (!strategy) throw new Error(`${rawPath}: sweep requested unknown strategy ${name}.`);
      return strategy;
    });
    const pairedQueries = record.request.queries;
    if (
      !Array.isArray(pairedQueries) ||
      pairedQueries.length < 2 ||
      pairedQueries.length % 2 !== 0 ||
      record.request.queryCount !== pairedQueries.length
    ) {
      throw new Error(`${rawPath}: malformed paired query request at sequence ${record.sequence}.`);
    }
    const originals = pairedQueries.filter((_query, index) => index % 2 === 0);
    processSweepPayload({
      payload: record.response,
      requestedStrategies,
      originals,
      plan,
      captures,
      requestMetrics,
      phase: record.phase,
      elapsedMs: record.elapsedMs,
      batchIndex: record.sequence,
      groupName: names.join("+"),
    });
  }
  if (sweepCount === 0) throw new Error(`${rawPath}: no sweep captures were recorded.`);
  for (const strategy of plan.strategies) {
    const captured = captures.get(strategy.name)?.size ?? 0;
    if (captured !== plan.uniqueOriginalQueries.length) {
      throw new Error(
        `${rawPath}: ${strategy.name} captured ${captured}/${plan.uniqueOriginalQueries.length} queries.`,
      );
    }
  }
  return { header, records, captures, requestMetrics, sweepCount };
}

function assertRecordedReplayCompatibility(plan, captures, summary, summaryPath) {
  const reconstructed = replayExperiment(plan, captures, summary.replayConfigurations);
  const currentHash = canonicalHash(reconstructed);
  const recordedHash = canonicalHash(summary.reports);
  if (currentHash !== recordedHash) {
    throw new Error(
      `${summaryPath}: current replay does not reproduce recorded reports ` +
      `(recorded=${recordedHash} current=${currentHash}).`,
    );
  }
  return { matches: true, recordedHash, currentHash };
}

function chunked(items, size) {
  const batches = [];
  for (let offset = 0; offset < items.length; offset += size) {
    batches.push(items.slice(offset, offset + size));
  }
  return batches;
}

function mergeReplayReports(target, source) {
  for (const [strategy, configs] of Object.entries(source)) {
    const targetConfigs = target[strategy] ?? {};
    for (const [name, report] of Object.entries(configs)) {
      if (targetConfigs[name]) {
        if (stableJson(targetConfigs[name]) !== stableJson(report)) {
          throw new Error(`Replay batch disagrees for ${strategy}/${name}.`);
        }
      } else {
        targetConfigs[name] = report;
      }
    }
    target[strategy] = targetConfigs;
  }
}

function replayGridInBatches(plan, captures, configs, batchSize) {
  const baseline = configs.find((config) => config.name === "baseline-0.3-0.6");
  if (!baseline) throw new Error("Grid is missing baseline-0.3-0.6.");
  const candidates = configs.filter((config) => config !== baseline);
  const batches = candidates.length === 0 ? [[]] : chunked(candidates, batchSize);
  const reports = {};
  for (const batch of batches) {
    mergeReplayReports(reports, replayExperiment(plan, captures, [baseline, ...batch]));
  }
  return { reports, batchCount: batches.length };
}

function validateRun(summaryPath, replayBatchSize, grid) {
  const summary = readJson(summaryPath);
  validateCompleteSummary(summary, summaryPath);
  const inputArtifacts = validateInputHashes(summary, summaryPath);
  const sourceArtifacts = {
    runner: inspectSourceArtifact(summary.artifacts.runner),
    evaluator: inspectSourceArtifact(summary.artifacts.evaluator),
  };
  const plan = buildPlan(planFlagsFromSummary(summary));
  validatePlanAgainstSummary(plan, summary, summaryPath);
  const rawPath = resolveRawPath(summary, summaryPath);
  const reconstructed = reconstructCaptures(plan, rawPath);
  const replayCompatibility = assertRecordedReplayCompatibility(
    plan,
    reconstructed.captures,
    summary,
    summaryPath,
  );
  const replayed = replayGridInBatches(
    plan,
    reconstructed.captures,
    grid.configs,
    replayBatchSize,
  );

  const inputFingerprint = canonicalHash({
    inputs: inputArtifacts.map((artifact) => ({
      kind: artifact.kind,
      name: artifact.name,
      sha256: artifact.recordedSha256,
    })).sort((left, right) => `${left.kind}:${left.name}`.localeCompare(`${right.kind}:${right.name}`)),
    suiteKinds: summary.queries.suiteKinds,
    subset: summary.queries.subset,
    rowCount: summary.queries.rowCount,
    sources: summary.queries.sources,
  });
  const wrapperTemplate = summary.queries.expandedView.template;
  return {
    internal: { plan, summary, reports: replayed.reports },
    public: {
      runId: basename(dirname(summaryPath)),
      summaryFile: relative(resolve(cloudDir, ".."), summaryPath),
      rawResponseFile: relative(resolve(cloudDir, ".."), rawPath),
      complete: true,
      blindQueriesExecuted: false,
      inputFingerprint,
      inputHashes: inputArtifacts,
      sourceArtifacts,
      sourceArtifactDriftAcceptedOnlyBecauseRecordedReplayMatches:
        !sourceArtifacts.runner.matches || !sourceArtifacts.evaluator.matches,
      recordedReplayCompatibility: replayCompatibility,
      wrapper: {
        id: canonicalHash(wrapperTemplate).slice(0, 12),
        template: wrapperTemplate,
      },
      strategyNames: plan.strategies.map((strategy) => strategy.name),
      corpus: {
        noteCount: plan.notes.length,
        characters: plan.validation.corpusChars,
        sources: sourceCounts(plan.notes, "corpus"),
      },
      queries: {
        rowCount: plan.queries.length,
        uniqueTextCount: plan.uniqueOriginalQueries.length,
        suiteKinds: plan.suiteNames,
        subset: plan.subset,
        sources: sourceCounts(plan.queries, "suite"),
      },
      captures: {
        rawRecordCount: reconstructed.records.length,
        sweepRecordCount: reconstructed.sweepCount,
        strategyQueryCaptureCount: plan.strategies.reduce(
          (sum, strategy) => sum + reconstructed.captures.get(strategy.name).size,
          0,
        ),
        expectedStrategyQueryCaptureCount: plan.strategies.length * plan.uniqueOriginalQueries.length,
        viewCount: plan.strategies.length * plan.uniqueOriginalQueries.length * 2,
        top40ProofComplete: true,
      },
      replay: {
        gridConfigCount: grid.configs.length,
        batchSize: replayBatchSize,
        batchCount: replayed.batchCount,
      },
    },
  };
}

function metricValue(metric) {
  return metric && metric.denominator > 0 && typeof metric.value === "number"
    ? metric.value
    : null;
}

function evaluateCalibrationGate(metrics, evidenceComplete) {
  const candidateAt40 = metricValue(metrics.metrics.candidateAt40);
  const negativeClean = metricValue(metrics.metrics.negativeClean);
  const forbiddenAt1 = metricValue(metrics.metrics.forbiddenAt1);
  const criteria = {
    completeCapture: evidenceComplete === true,
    candidateAt40: candidateAt40 !== null && candidateAt40 >= CALIBRATION_GATE.candidateAt40Min,
    negativeClean: negativeClean !== null && negativeClean >= CALIBRATION_GATE.negativeCleanMin,
    forbiddenAt1: forbiddenAt1 !== null && forbiddenAt1 <= CALIBRATION_GATE.forbiddenAt1Max,
  };
  const failed = Object.entries(criteria).filter(([, passed]) => !passed).map(([name]) => name);
  return {
    passed: failed.length === 0,
    criteriaPassed: Object.values(criteria).filter(Boolean).length,
    criteriaTotal: Object.keys(criteria).length,
    criteria,
    failed,
  };
}

function strategyCost(summary, strategyName) {
  const evidence = summary.requestEvidence?.byStrategy?.[strategyName];
  const requests = evidence?.requests;
  const aiCalls = evidence?.aiCalls;
  return {
    aiCalls: typeof aiCalls === "number" ? aiCalls : null,
    requests: typeof requests === "number" ? requests : null,
    aiCallsPerRequest:
      typeof aiCalls === "number" && typeof requests === "number" && requests > 0
        ? aiCalls / requests
        : null,
    warmEmbeddingP50Ms: evidence?.warmPairedQueryEmbeddingPhase?.p50Ms ?? null,
    warmEmbeddingP95Ms: evidence?.warmPairedQueryEmbeddingPhase?.p95Ms ?? null,
    pairedViewsSingleWorkersAiBatch:
      evidence?.pairedRawExpandedSingleWorkersAiBatch?.verifiedOnWarmRequests ?? null,
  };
}

function candidateRows(validatedRuns, slice) {
  const rows = [];
  for (const run of validatedRuns) {
    const { summary, reports } = run.internal;
    for (const [strategyName, configs] of Object.entries(reports)) {
      for (const [configName, report] of Object.entries(configs)) {
        const metrics = report.slices[slice];
        if (!metrics) {
          throw new Error(
            `${run.public.runId}/${strategyName}/${configName}: slice ${slice} is unavailable.`,
          );
        }
        rows.push({
          runId: run.public.runId,
          inputFingerprint: run.public.inputFingerprint,
          wrapper: run.public.wrapper,
          strategy: strategyName,
          configName,
          config: report.config,
          slice,
          gate: evaluateCalibrationGate(metrics, run.public.captures.top40ProofComplete),
          counts: {
            queries: metrics.queryCount,
            positives: metrics.positiveCount,
            negatives: metrics.negativeCount,
          },
          metrics: metrics.metrics,
          mrr: metrics.mrr,
          scoreGaps: metrics.scoreGaps,
          rescue: metrics.rescue,
          cost: strategyCost(summary, strategyName),
        });
      }
    }
  }
  return rows;
}

function descending(left, right) {
  const leftValue = left === null || left === undefined ? Number.NEGATIVE_INFINITY : left;
  const rightValue = right === null || right === undefined ? Number.NEGATIVE_INFINITY : right;
  return rightValue - leftValue;
}

function ascendingNullLast(left, right) {
  const leftValue = left === null || left === undefined ? Number.POSITIVE_INFINITY : left;
  const rightValue = right === null || right === undefined ? Number.POSITIVE_INFINITY : right;
  return leftValue - rightValue;
}

function compareCandidates(left, right) {
  return Number(right.gate.passed) - Number(left.gate.passed) ||
    right.gate.criteriaPassed - left.gate.criteriaPassed ||
    descending(metricValue(left.metrics.requiredRank), metricValue(right.metrics.requiredRank)) ||
    descending(metricValue(left.metrics.lineAt3), metricValue(right.metrics.lineAt3)) ||
    descending(metricValue(left.metrics.recallAt3), metricValue(right.metrics.recallAt3)) ||
    descending(left.mrr.value, right.mrr.value) ||
    ascendingNullLast(left.cost.aiCallsPerRequest, right.cost.aiCallsPerRequest) ||
    ascendingNullLast(left.cost.warmEmbeddingP50Ms, right.cost.warmEmbeddingP50Ms) ||
    left.runId.localeCompare(right.runId) ||
    left.wrapper.id.localeCompare(right.wrapper.id) ||
    left.strategy.localeCompare(right.strategy) ||
    left.configName.localeCompare(right.configName);
}

function buildCohorts(rows, validatedRuns) {
  const byFingerprint = new Map();
  for (const row of rows) {
    const list = byFingerprint.get(row.inputFingerprint) ?? [];
    list.push(row);
    byFingerprint.set(row.inputFingerprint, list);
  }
  return [...byFingerprint.entries()].map(([inputFingerprint, candidates]) => {
    candidates.sort(compareCandidates);
    const runIds = [...new Set(candidates.map((candidate) => candidate.runId))];
    const runs = validatedRuns
      .map((run) => run.public)
      .filter((run) => run.inputFingerprint === inputFingerprint && runIds.includes(run.runId));
    return {
      id: inputFingerprint.slice(0, 12),
      inputFingerprint,
      runIds,
      wrappers: [...new Map(candidates.map((candidate) => [
        candidate.wrapper.id,
        candidate.wrapper,
      ])).values()],
      strategies: [...new Set(candidates.map((candidate) => candidate.strategy))].sort(),
      counts: {
        runs: runIds.length,
        candidates: candidates.length,
        gatePassed: candidates.filter((candidate) => candidate.gate.passed).length,
        gateFailed: candidates.filter((candidate) => !candidate.gate.passed).length,
      },
      dataset: runs[0]
        ? { corpus: runs[0].corpus, queries: runs[0].queries }
        : null,
      candidates,
    };
  }).sort((left, right) => left.id.localeCompare(right.id));
}

function formatPercent(value) {
  return value === null || value === undefined ? "-" : `${(value * 100).toFixed(1)}%`;
}

function formatMetric(metric) {
  if (!metric || metric.denominator === 0) return "0/0 (-)";
  const interval = metric.wilson95
    ? ` [${formatPercent(metric.wilson95.low)}, ${formatPercent(metric.wilson95.high)}]`
    : "";
  return `${metric.numerator}/${metric.denominator} (${formatPercent(metric.value)})${interval}`;
}

function formatMrr(metric) {
  if (!metric || metric.denominator === 0) return "0/0 (-)";
  return `${metric.numerator.toFixed(2)}/${metric.denominator} (${metric.value.toFixed(3)})`;
}

function markdownTable(headers, rows) {
  const escape = (value) => String(value ?? "").replace(/\|/gu, "\\|").replace(/\n/gu, " ");
  return [
    `| ${headers.map(escape).join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.map(escape).join(" | ")} |`),
  ].join("\n");
}

const RESULT_HEADERS = Object.freeze([
  "rank",
  "gate",
  "run / wrapper",
  "strategy",
  "config",
  "C@40 (Wilson95)",
  "R@1 (Wilson95)",
  "R@3 (Wilson95)",
  "R@8 (Wilson95)",
  "MRR",
  "line@1 (Wilson95)",
  "line@3 (Wilson95)",
  "required (Wilson95)",
  "negative-clean (Wilson95)",
  "F@1 (Wilson95)",
  "F@3 (Wilson95)",
  "F@8 (Wilson95)",
]);

function resultTableRows(candidates, limit) {
  return candidates.slice(0, limit).map((candidate, index) => [
    index + 1,
    candidate.gate.passed
      ? "PASS"
      : `FAIL ${candidate.gate.criteriaPassed}/${candidate.gate.criteriaTotal}`,
    `${candidate.runId} / ${candidate.wrapper.id}`,
    candidate.strategy,
    candidate.configName,
    formatMetric(candidate.metrics.candidateAt40),
    formatMetric(candidate.metrics.recallAt1),
    formatMetric(candidate.metrics.recallAt3),
    formatMetric(candidate.metrics.recallAt8),
    formatMrr(candidate.mrr),
    formatMetric(candidate.metrics.lineAt1),
    formatMetric(candidate.metrics.lineAt3),
    formatMetric(candidate.metrics.requiredRank),
    formatMetric(candidate.metrics.negativeClean),
    formatMetric(candidate.metrics.forbiddenAt1),
    formatMetric(candidate.metrics.forbiddenAt3),
    formatMetric(candidate.metrics.forbiddenAt8),
  ]);
}

function buildMarkdown(analysis, top) {
  const lines = [
    "# NotesFlash large-result offline calibration analysis",
    "",
    `- Complete: **${analysis.complete}**`,
    `- Network requests: **${analysis.safety.networkRequests}**`,
    `- Blind-final query file opened: **${analysis.safety.blindFinalOpened}**`,
    `- Successful run directories: ${analysis.counts.runs}`,
    `- Grid configurations per run: ${analysis.grid.configCount} ` +
      `(${analysis.grid.primaryConfigCount} primary, ${analysis.grid.consensusConfigCount} consensus)`,
    `- Total comparable candidates: ${analysis.counts.candidates}`,
    `- Gate-passing candidates: ${analysis.counts.gatePassed}`,
    "",
    "## Registered calibration gate and ordering",
    "",
    `- C@40 >= ${formatPercent(analysis.gate.candidateAt40Min)}`,
    `- negative-clean >= ${formatPercent(analysis.gate.negativeCleanMin)}`,
    `- forbidden@1 <= ${formatPercent(analysis.gate.forbiddenAt1Max)}`,
    `- passing-order: ${analysis.gate.selectionOrder.join(", ")}`,
    "- Every binomial result below includes numerator/denominator and Wilson 95% interval.",
    "",
    "## Validated runs",
    "",
    markdownTable(
      ["run", "wrapper", "strategies", "notes", "queries", "input hashes", "recorded replay", "source drift"],
      analysis.runs.map((run) => [
        run.runId,
        `${run.wrapper.id}: ${run.wrapper.template}`,
        run.strategyNames.join(", "),
        run.corpus.noteCount,
        run.queries.rowCount,
        run.inputHashes.every((artifact) => artifact.matches) ? "PASS" : "FAIL",
        run.recordedReplayCompatibility.matches ? "PASS" : "FAIL",
        run.sourceArtifactDriftAcceptedOnlyBecauseRecordedReplayMatches ? "reported" : "none",
      ]),
    ),
    "",
  ];

  for (const cohort of analysis.cohorts) {
    lines.push(
      `## Cohort ${cohort.id}: ${analysis.slice}`,
      "",
      `- Runs: ${cohort.counts.runs}; wrappers: ${cohort.wrappers.length}; ` +
        `strategies: ${cohort.strategies.length}`,
      `- Candidates: ${cohort.counts.candidates}; gate pass: ${cohort.counts.gatePassed}; ` +
        `gate fail: ${cohort.counts.gateFailed}`,
      "",
      markdownTable(RESULT_HEADERS, resultTableRows(cohort.candidates, top)),
      "",
    );
    if (cohort.candidates.length > top) {
      lines.push(
        `_Markdown shows the first ${top}/${cohort.candidates.length} pre-registered-order rows; ` +
          "analysis.json contains every configuration._",
        "",
      );
    }
  }
  lines.push(
    "## Interpretation boundary",
    "",
    "- This is deterministic replay of already captured brute-force Top-40 cosine evidence; it sends no network request.",
    "- Input hashes, successful completion, exact capture proof, and compatibility with each run's recorded replay are hard requirements.",
    "- A current runner/evaluator source hash drift is disclosed and accepted only when the recorded replay reports reproduce exactly.",
    "- No blind-final query result or query file is accepted by this analyzer.",
    "- Grid selection is calibration evidence only; it is not permission to open final blind data, deploy, commit, or push.",
    "",
  );
  return `${lines.join("\n")}\n`;
}

function outputDirectory(flags) {
  if (flags["output-dir"] !== undefined) {
    const path = resolve(process.cwd(), flags["output-dir"]);
    assertInside(resolve(evalDir, "out"), path, "Analysis output directory");
    return path;
  }
  const timestamp = new Date().toISOString().replace(/[:.]/gu, "-");
  return resolve(ignoredOutputRoot, `${timestamp}-${safeLabel(flags.label)}`);
}

function consoleSummary(analysis, top = 10) {
  const lines = [
    "NotesFlash offline calibration analysis",
    `runs=${analysis.counts.runs} cohorts=${analysis.counts.cohorts} ` +
      `grid=${analysis.grid.configCount} candidates=${analysis.counts.candidates} ` +
      `gatePass=${analysis.counts.gatePassed}`,
    "networkRequests=0 blindFinalOpened=false inputHashes=PASS recordedReplay=PASS",
  ];
  for (const cohort of analysis.cohorts) {
    lines.push(
      `cohort=${cohort.id} candidates=${cohort.counts.candidates} gatePass=${cohort.counts.gatePassed}`,
      markdownTable(RESULT_HEADERS, resultTableRows(cohort.candidates, Math.min(top, cohort.candidates.length))),
    );
  }
  console.log(lines.join("\n"));
}

async function main() {
  const { flags, runs } = parseArgs(process.argv.slice(2));
  if (flags.help === true) {
    console.log(usage());
    return;
  }
  if (runs.length === 0) throw new Error("Provide at least one successful run directory.");

  // A belt-and-suspenders offline guard. The imported runner exports used
  // below do not fetch, and any accidental future fetch becomes a hard error.
  globalThis.fetch = () => {
    throw new Error("Network access is disabled in analyze-large-results.mjs.");
  };

  const grid = buildGrid(flags);
  const replayBatchSize = parsePositiveInteger(
    flags["replay-batch-size"],
    DEFAULT_REPLAY_BATCH_SIZE,
    "--replay-batch-size",
    500,
  );
  const top = parsePositiveInteger(flags.top, DEFAULT_TOP, "--top", 500);
  const slice = flags.slice === undefined ? DEFAULT_SLICE : String(flags.slice).trim();
  if (!slice || isBlindFinalReference(slice)) throw new Error("Invalid or blind-final --slice value.");

  const summaryPaths = [...new Set(runs.map(resolveSummaryPath))];
  const validatedRuns = [];
  for (const summaryPath of summaryPaths) {
    console.error(`offline replay: ${dirname(summaryPath)}`);
    validatedRuns.push(validateRun(summaryPath, replayBatchSize, grid));
  }

  const rows = candidateRows(validatedRuns, slice);
  const cohorts = buildCohorts(rows, validatedRuns);
  const analysis = {
    schemaVersion: 1,
    type: OUTPUT_SCHEMA,
    complete: true,
    createdAt: new Date().toISOString(),
    slice,
    safety: {
      offline: true,
      networkRequests: 0,
      fetchDisabled: true,
      blindFinalOpened: false,
      blindFinalResultsAccepted: false,
      writesRestrictedToGitignoredEvalOut: flags["dry-run"] !== true,
    },
    gate: CALIBRATION_GATE,
    grid: {
      name: grid.name,
      kinds: grid.kinds,
      customAxes: grid.customAxes,
      axes: grid.axes,
      referenceBaselineIncluded: grid.referenceBaselineIncluded,
      configCount: grid.configCount,
      primaryConfigCount: grid.primaryConfigCount,
      consensusConfigCount: grid.consensusConfigCount,
      replayBatchSize,
      configs: grid.configs,
    },
    counts: {
      runs: validatedRuns.length,
      cohorts: cohorts.length,
      candidates: rows.length,
      gatePassed: rows.filter((row) => row.gate.passed).length,
      gateFailed: rows.filter((row) => !row.gate.passed).length,
    },
    runs: validatedRuns.map((run) => run.public),
    cohorts,
  };

  consoleSummary(analysis);
  if (flags["dry-run"] === true) {
    console.log("dry-run: full analysis completed; no files written");
    return;
  }

  const outputDir = outputDirectory(flags);
  const jsonFile = resolve(outputDir, "analysis.json");
  const markdownFile = resolve(outputDir, "report.md");
  if (existsSync(jsonFile) || existsSync(markdownFile)) {
    throw new Error(`Refusing to overwrite an existing analysis in ${outputDir}.`);
  }
  mkdirSync(outputDir, { recursive: true });
  writeFileSync(jsonFile, `${JSON.stringify(analysis, null, 2)}\n`, "utf8");
  writeFileSync(markdownFile, buildMarkdown(analysis, top), "utf8");
  console.log(`analysis JSON: ${jsonFile}`);
  console.log(`analysis Markdown: ${markdownFile}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
