#!/usr/bin/env node
/**
 * Offline structural audit for NotesFlash semantic-search datasets.
 *
 * This script never performs network or Workers AI calls. By default it reads
 * every corpus (including blind distractor notes) but only query suites that
 * are already visible during development. The final blind query file is read
 * only when a release operator explicitly passes `--include-blind-final`.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  corpusFilesForSet,
  QUERY_FILES,
  QUERY_FILE_POLICIES,
  VISIBLE_QUERY_FILES,
} from "./dataset-manifest.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const NOTE_KEY_PATTERN = /^[a-z0-9-]+$/;
const EMBEDDED_MARKER_PATTERN = /\[(?:[a-z-]*eval[a-z-]*):/iu;

function normalized(value) {
  return String(value).normalize("NFKC").trim().toLocaleLowerCase();
}

function readJson(root, relativePath) {
  try {
    return JSON.parse(readFileSync(resolve(root, relativePath), "utf8"));
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`${relativePath}: could not read valid JSON (${reason})`);
  }
}

function issue(code, location, detail) {
  return { code, location, detail };
}

function queryLocation(file, index) {
  return `${file}#queries[${index}]`;
}

function noteLocation(file, index, key) {
  return `${file}#notes[${index}](${key || "missing-key"})`;
}

function ensureUnique(index, value, location, kind, errors) {
  const canonical = normalized(value);
  if (!canonical) return;
  const previous = index.get(canonical);
  if (previous) {
    errors.push(issue(`duplicate-${kind}`, location, `duplicates ${previous}`));
  } else {
    index.set(canonical, location);
  }
}

/**
 * Audit already-loaded artifacts. Exported for focused unit tests; callers
 * should normally use `auditDatasets` so the canonical manifest is honored.
 */
export function auditData({ corpusArtifacts, queryArtifacts }) {
  const errors = [];
  const warnings = [];
  const notesByKey = new Map();
  const noteTexts = [];
  const titleIndex = new Map();
  let noteCount = 0;

  for (const artifact of corpusArtifacts) {
    const notes = artifact.data?.notes;
    if (!Array.isArray(notes)) {
      errors.push(issue("invalid-corpus", artifact.file, "notes must be an array"));
      continue;
    }
    for (const [index, note] of notes.entries()) {
      noteCount += 1;
      const key = typeof note?.key === "string" ? note.key.trim() : "";
      const location = noteLocation(artifact.file, index, key);
      const title = typeof note?.title === "string" ? note.title.trim() : "";
      const body = typeof note?.body === "string" ? note.body : "";

      if (!NOTE_KEY_PATTERN.test(key)) {
        errors.push(issue("invalid-note-key", location, "key must match [a-z0-9-]+"));
      } else if (notesByKey.has(key)) {
        errors.push(issue("duplicate-note-key", location, `duplicates ${notesByKey.get(key).location}`));
      } else {
        notesByKey.set(key, { note, location });
      }
      if (!title) errors.push(issue("empty-note-title", location, "title must be non-empty"));
      if (typeof note?.body !== "string") {
        errors.push(issue("invalid-note-body", location, "body must be a string"));
      }
      ensureUnique(titleIndex, title, location, "note-title", errors);

      const searchable = normalized(`${title}\n${body}`);
      if (key && searchable.includes(normalized(key))) {
        errors.push(issue("metadata-key-leak", location, "its metadata key occurs in searchable text"));
      }
      if (EMBEDDED_MARKER_PATTERN.test(`${title}\n${body}`)) {
        errors.push(issue("metadata-marker-leak", location, "an evaluation marker occurs in searchable text"));
      }
      noteTexts.push({ key, location, searchable });
    }
  }

  const queryIndex = new Map();
  let queryCount = 0;
  let positiveCount = 0;
  let negativeCount = 0;
  let forbiddenCaseCount = 0;
  let literalCollisionCount = 0;
  let allowedLiteralCollisionCount = 0;

  for (const artifact of queryArtifacts) {
    const queries = artifact.data?.queries;
    if (!Array.isArray(queries)) {
      errors.push(issue("invalid-query-suite", artifact.file, "queries must be an array"));
      continue;
    }
    for (const [index, entry] of queries.entries()) {
      queryCount += 1;
      const location = queryLocation(artifact.file, index);
      const query = typeof entry?.query === "string" ? entry.query.trim() : "";
      const scenario = typeof entry?.scenario === "string" ? entry.scenario.trim() : "";
      const expectations = entry?.expect;
      const forbidden = entry?.forbid;

      if (!query) errors.push(issue("empty-query", location, "query must be non-empty"));
      if (!scenario) errors.push(issue("empty-scenario", location, "scenario must be non-empty"));
      ensureUnique(queryIndex, query, location, "query", errors);
      if (!Array.isArray(expectations)) {
        errors.push(issue("invalid-expect", location, "expect must be an array"));
        continue;
      }

      const positive = expectations.length > 0;
      if (positive) {
        positiveCount += 1;
        if (!Number.isInteger(entry.requiredRank) || entry.requiredRank < 1) {
          errors.push(issue("invalid-required-rank", location, "positive queries need requiredRank >= 1"));
        }
      } else {
        negativeCount += 1;
        if (Object.hasOwn(entry, "requiredRank")) {
          errors.push(issue("negative-required-rank", location, "negative queries must omit requiredRank"));
        }
      }

      const expectedKeys = new Set();
      for (const [expectationIndex, expectation] of expectations.entries()) {
        const expectationLocation = `${location}.expect[${expectationIndex}]`;
        const key = typeof expectation?.key === "string" ? expectation.key : "";
        const lineIncludes = typeof expectation?.lineIncludes === "string"
          ? expectation.lineIncludes
          : "";
        if (!key || expectedKeys.has(key)) {
          errors.push(issue("duplicate-or-empty-expect-key", expectationLocation, "expected note keys must be unique and non-empty"));
        }
        expectedKeys.add(key);
        const target = notesByKey.get(key);
        if (!target) {
          errors.push(issue("unknown-expect-key", expectationLocation, `unknown note key ${key || "<empty>"}`));
          continue;
        }
        if (!lineIncludes || /[\r\n]/u.test(lineIncludes)) {
          errors.push(issue("invalid-line-includes", expectationLocation, "lineIncludes must be a non-empty single-line string"));
          continue;
        }
        const logicalLines = String(target.note.body).replace(/\r\n?/gu, "\n").split("\n");
        const matchingLines = logicalLines.filter((line) => line.includes(lineIncludes));
        if (matchingLines.length !== 1) {
          errors.push(issue("line-includes-cardinality", expectationLocation, `matched ${matchingLines.length} logical lines in ${key}; expected exactly 1`));
        }
      }

      if (forbidden !== undefined && !Array.isArray(forbidden)) {
        errors.push(issue("invalid-forbid", location, "forbid must be an array when present"));
      } else if (Array.isArray(forbidden)) {
        if (forbidden.length > 0) forbiddenCaseCount += 1;
        const seenForbidden = new Set();
        for (const [forbidIndex, key] of forbidden.entries()) {
          const forbidLocation = `${location}.forbid[${forbidIndex}]`;
          if (typeof key !== "string" || !key || seenForbidden.has(key)) {
            errors.push(issue("duplicate-or-empty-forbid-key", forbidLocation, "forbidden note keys must be unique and non-empty"));
            continue;
          }
          seenForbidden.add(key);
          if (!notesByKey.has(key)) {
            errors.push(issue("unknown-forbid-key", forbidLocation, `unknown note key ${key}`));
          }
          if (expectedKeys.has(key)) {
            errors.push(issue("expect-forbid-overlap", forbidLocation, `${key} is also expected`));
          }
        }
      }

      const queryNeedle = normalized(query);
      if (queryNeedle) {
        for (const note of noteTexts) {
          if (!note.searchable.includes(queryNeedle)) continue;
          literalCollisionCount += 1;
          const collision = issue(
            "literal-query-collision",
            location,
            `literal phrase occurs in note ${note.key}`,
          );
          if (artifact.policy?.allowLiteralCollisions === true) {
            allowedLiteralCollisionCount += 1;
            warnings.push(collision);
          } else {
            errors.push(collision);
          }
        }
      }
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    summary: {
      corpusFiles: corpusArtifacts.length,
      queryFiles: queryArtifacts.length,
      notes: noteCount,
      queries: queryCount,
      positives: positiveCount,
      negatives: negativeCount,
      forbiddenCases: forbiddenCaseCount,
      literalCollisions: literalCollisionCount,
      allowedLiteralCollisions: allowedLiteralCollisionCount,
    },
  };
}

export function auditDatasets({ root = here, includeBlindFinal = false } = {}) {
  const corpusFiles = corpusFilesForSet("full");
  const queryFiles = includeBlindFinal
    ? [...VISIBLE_QUERY_FILES, QUERY_FILES.blindFinal]
    : [...VISIBLE_QUERY_FILES];
  return auditData({
    corpusArtifacts: corpusFiles.map((file) => ({ file, data: readJson(root, file) })),
    queryArtifacts: queryFiles.map((file) => ({
      file,
      data: readJson(root, file),
      policy: QUERY_FILE_POLICIES[file],
    })),
  });
}

export function formatAudit(result, { includeBlindFinal = false } = {}) {
  const lines = [
    `dataset audit: ${result.ok ? "PASS" : "FAIL"}`,
    `scope: ${includeBlindFinal ? "visible suites + blind final" : "visible suites only (blind final not opened)"}`,
    `corpora=${result.summary.corpusFiles} notes=${result.summary.notes} ` +
      `queryFiles=${result.summary.queryFiles} queries=${result.summary.queries}`,
    `positives=${result.summary.positives} negatives=${result.summary.negatives} ` +
      `forbiddenCases=${result.summary.forbiddenCases} literalCollisions=${result.summary.literalCollisions} ` +
      `(allowedRegression=${result.summary.allowedLiteralCollisions})`,
  ];
  if (result.errors.length > 0) {
    lines.push("errors:");
    for (const error of result.errors) {
      // Locations use array indexes rather than query text, so even an
      // authorized final audit does not echo blind prompts into logs.
      lines.push(`  [${error.code}] ${error.location}: ${error.detail}`);
    }
  }
  if (result.warnings.length > 0) {
    lines.push("warnings:");
    for (const warning of result.warnings) {
      lines.push(`  [${warning.code}] ${warning.location}: ${warning.detail}`);
    }
  }
  return lines.join("\n");
}

async function main() {
  const includeBlindFinal = process.argv.slice(2).includes("--include-blind-final");
  const result = auditDatasets({ includeBlindFinal });
  console.log(formatAudit(result, { includeBlindFinal }));
  if (!result.ok) process.exitCode = 1;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
