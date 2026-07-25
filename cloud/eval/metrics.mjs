/**
 * Retrieval metrics for the search lab evaluation harness.
 *
 * Aggregation is imported from the Worker source, so an offline threshold sweep
 * uses exactly the ranking rules production uses; only the candidate source
 * differs (a recorded sweep instead of a live index).
 */
import { aggregateChunkHits, resolveAggregationOptions } from "../src/semantic-core.ts";

export const EVAL_TITLE_PATTERN = /^\[EVAL:([a-z0-9-]+)\]/;

export function keyFromTitle(title) {
  return typeof title === "string" ? (title.match(EVAL_TITLE_PATTERN)?.[1] ?? null) : null;
}

export function corpusIndex(corpus) {
  const byKey = new Map();
  for (const note of corpus.notes) {
    byKey.set(note.key, { ...note, lines: note.body.split("\n") });
  }
  return byKey;
}

/** 1-based body line number of the first line containing `lineIncludes`. */
export function expectedLineNumber(note, lineIncludes) {
  if (!note) return null;
  const index = note.lines.findIndex((line) => line.includes(lineIncludes));
  return index < 0 ? null : index + 1;
}

function matchCoversLine(match, lineNumber) {
  if (lineNumber === null) return false;
  if (typeof match.lineStart === "number" && typeof match.lineEnd === "number") {
    return lineNumber >= match.lineStart && lineNumber <= match.lineEnd;
  }
  return match.lineNumber === lineNumber;
}

/**
 * Re-rank a recorded unfiltered chunk list with different thresholds. Mirrors
 * the live path by delegating to the Worker's aggregation implementation.
 */
export function rescore(rankedChunks, overrides) {
  const options = resolveAggregationOptions(overrides);
  const hits = rankedChunks.map((chunk, index) => ({
    noteId: chunk.noteId ?? chunk.noteRef,
    chunkId: `${chunk.noteRef}:${index}`,
    chunkIndex: index,
    kind: chunk.kind,
    primaryLine: chunk.lineNumber,
    lineStart: chunk.lineStart,
    lineEnd: chunk.lineEnd,
    charStart: chunk.charStart,
    charEnd: chunk.charEnd,
    score: chunk.score,
    text: chunk.text,
  }));
  const titleByNote = new Map(
    rankedChunks.map((chunk) => [chunk.noteId ?? chunk.noteRef, chunk.title]),
  );
  const aggregated = aggregateChunkHits(hits, options);
  return aggregated.notes.map((note, rank) => ({
    rank: rank + 1,
    noteId: note.noteId,
    noteRef: note.noteId,
    title: titleByNote.get(note.noteId),
    score: note.score,
    bestScore: note.bestScore,
    matchedChunkCount: note.matchedChunkCount,
    matches: note.matches.map((match) => ({
      kind: match.kind,
      lineNumber: match.primaryLine,
      lineStart: match.lineStart,
      lineEnd: match.lineEnd,
      charStart: match.charStart,
      charEnd: match.charEnd,
      score: match.score,
      text: match.text,
    })),
  }));
}

/**
 * Score one golden query against one strategy's result list.
 *
 * `expect` holds acceptable answers; any of them counts, because several notes
 * can legitimately answer the same question.
 */
export function evaluateQuery({ golden, results, rankedChunks = [], corpus }) {
  const expectations = (golden.expect ?? []).map((expectation) => ({
    ...expectation,
    lineNumber: expectedLineNumber(corpus.get(expectation.key), expectation.lineIncludes),
  }));
  const missingLine = expectations.find((expectation) => expectation.lineNumber === null);
  const ranked = results.map((result) => ({
    ...result,
    key: keyFromTitle(result.title) ?? result.noteRef,
  }));

  const isNegative = expectations.length === 0;
  const firstHitIndex = ranked.findIndex((result) =>
    expectations.some((expectation) => expectation.key === result.key)
  );
  const hit = firstHitIndex < 0 ? null : ranked[firstHitIndex];
  const hitExpectation = hit
    ? expectations.find((expectation) => expectation.key === hit.key)
    : null;
  const forbidden = golden.forbid ?? [];
  const forbiddenIndex = ranked.findIndex((result) => forbidden.includes(result.key));

  return {
    query: golden.query,
    scenario: golden.scenario,
    negative: isNegative,
    expectedKeys: expectations.map((expectation) => expectation.key),
    corpusLineMissing: missingLine ? missingLine.lineIncludes : null,
    returnedCount: ranked.length,
    rank: firstHitIndex < 0 ? null : firstHitIndex + 1,
    reciprocalRank: firstHitIndex < 0 ? 0 : 1 / (firstHitIndex + 1),
    lineHit: hit && hitExpectation
      ? hit.matches.some((match) => matchCoversLine(match, hitExpectation.lineNumber))
      : null,
    expectedLine: hitExpectation?.lineNumber ?? null,
    matchedLines: hit ? hit.matches.map((match) => match.lineNumber) : [],
    topScore: ranked[0]?.bestScore ?? null,
    expectedScore: hit?.bestScore ?? null,
    falsePositive: isNegative && ranked.length > 0,
    forbiddenAboveExpected: forbiddenIndex >= 0 &&
      (firstHitIndex < 0 || forbiddenIndex < firstHitIndex),
    // Best score any non-expected note reached; drives threshold calibration.
    bestNegativeScore: ranked
      .filter((result) => !expectations.some((expectation) => expectation.key === result.key))
      .reduce((best, result) => (best === null || result.bestScore > best ? result.bestScore : best), null),
    unfilteredTopScore: rankedChunks[0]?.score ?? null,
  };
}

function ratio(count, total) {
  return total === 0 ? null : count / total;
}

export function summarize(rows) {
  const positives = rows.filter((row) => !row.negative);
  const negatives = rows.filter((row) => row.negative);
  const withLine = positives.filter((row) => row.lineHit !== null);
  const positiveScores = positives
    .map((row) => row.expectedScore)
    .filter((score) => typeof score === "number");
  const negativeScores = [
    ...negatives.map((row) => row.unfilteredTopScore),
    ...positives.map((row) => row.bestNegativeScore),
  ].filter((score) => typeof score === "number");

  return {
    queries: rows.length,
    positives: positives.length,
    negatives: negatives.length,
    recall1: ratio(positives.filter((row) => row.rank !== null && row.rank <= 1).length, positives.length),
    recall3: ratio(positives.filter((row) => row.rank !== null && row.rank <= 3).length, positives.length),
    recall8: ratio(positives.filter((row) => row.rank !== null && row.rank <= 8).length, positives.length),
    mrr: positives.length === 0
      ? null
      : positives.reduce((sum, row) => sum + row.reciprocalRank, 0) / positives.length,
    lineAccuracy: ratio(withLine.filter((row) => row.lineHit).length, withLine.length),
    negativeClean: ratio(negatives.filter((row) => !row.falsePositive).length, negatives.length),
    forbiddenViolations: rows.filter((row) => row.forbiddenAboveExpected).length,
    minPositiveScore: positiveScores.length === 0 ? null : Math.min(...positiveScores),
    medianPositiveScore: median(positiveScores),
    maxNegativeScore: negativeScores.length === 0 ? null : Math.max(...negativeScores),
    medianNegativeScore: median(negativeScores),
  };
}

export function median(values) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

export function byScenario(rows) {
  const groups = new Map();
  for (const row of rows) {
    const list = groups.get(row.scenario) ?? [];
    list.push(row);
    groups.set(row.scenario, list);
  }
  return [...groups.entries()].map(([scenario, group]) => ({
    scenario,
    ...summarize(group),
  }));
}

export function formatRatio(value) {
  if (value === null || value === undefined) return "-";
  return `${(value * 100).toFixed(0)}%`;
}

export function formatScore(value) {
  if (value === null || value === undefined) return "-";
  return value.toFixed(3);
}

export function markdownTable(headers, rows) {
  const widths = headers.map((header, index) =>
    Math.max(String(header).length, ...rows.map((row) => String(row[index] ?? "").length))
  );
  const line = (cells) =>
    `| ${cells.map((cell, index) => String(cell ?? "").padEnd(widths[index])).join(" | ")} |`;
  return [
    line(headers),
    `| ${widths.map((width) => "-".repeat(width)).join(" | ")} |`,
    ...rows.map((row) => line(row)),
  ].join("\n");
}
