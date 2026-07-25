import { describe, expect, it } from "vitest";

import {
  aggregateChunkHits,
  appendShortQueryConsensus,
  cosineSimilarity,
  DEFAULT_AGGREGATION,
  resolveAggregationOptions,
  type AggregationOptions,
  type ChunkHit,
} from "../src/semantic-core";

function hit(
  noteId: string,
  chunkIndex: number,
  score: number,
  primaryLine: number | null = chunkIndex + 1,
): ChunkHit {
  return {
    noteId,
    chunkId: `${noteId}:${chunkIndex}`,
    chunkIndex,
    kind: primaryLine === null ? "title" : "body",
    primaryLine,
    lineStart: primaryLine,
    lineEnd: primaryLine,
    charStart: primaryLine === null ? null : primaryLine * 10,
    charEnd: primaryLine === null ? null : primaryLine * 10 + 8,
    score,
  };
}

const options: AggregationOptions = {
  ...DEFAULT_AGGREGATION,
  minCosine: 0.4,
  relativeMinRatio: 0.8,
  multiChunkBonus: 0.01,
  maxBonusChunks: 2,
  maxMatchesPerNote: 2,
  topK: 2,
};

describe("cosineSimilarity", () => {
  it("scores identical, orthogonal, and mismatched vectors", () => {
    expect(cosineSimilarity([1, 2, 3], [1, 2, 3])).toBeCloseTo(1, 12);
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0, 12);
    expect(cosineSimilarity([1, 0], [1, 0, 0])).toBe(0);
    expect(cosineSimilarity([0, 0], [1, 1])).toBe(0);
  });
});

describe("aggregateChunkHits", () => {
  it("applies the absolute floor", () => {
    const result = aggregateChunkHits([hit("a", 0, 0.39)], { ...options, relativeMinRatio: 0 });
    expect(result.notes).toHaveLength(0);
    expect(result.topChunkScore).toBeCloseTo(0.39, 12);
    expect(result.effectiveFloor).toBeCloseTo(0.4, 12);
  });

  it("suppresses a weak tail relative to the best chunk", () => {
    const result = aggregateChunkHits(
      [hit("a", 0, 0.9), hit("b", 0, 0.71), hit("c", 0, 0.45)],
      options,
    );

    expect(result.effectiveFloor).toBeCloseTo(0.72, 12);
    expect(result.notes.map((note) => note.noteId)).toEqual(["a"]);
    expect(result.matchedChunkCount).toBe(1);
    expect(result.consideredChunkCount).toBe(3);
  });

  it("keeps a weak best match when nothing better exists", () => {
    const result = aggregateChunkHits([hit("a", 0, 0.52), hit("b", 0, 0.41)], options);
    expect(result.effectiveFloor).toBeCloseTo(0.416, 12);
    // 0.52 clears the absolute floor even though it is a weak score; 0.41 falls
    // below the relative floor derived from it.
    expect(result.notes.map((note) => note.noteId)).toEqual(["a"]);

    const closeRunnerUp = aggregateChunkHits([hit("a", 0, 0.52), hit("b", 0, 0.45)], options);
    expect(closeRunnerUp.notes.map((note) => note.noteId)).toEqual(["a", "b"]);
  });

  it("adds a bounded bonus for several matching chunks in one note", () => {
    const result = aggregateChunkHits(
      [hit("a", 0, 0.9), hit("a", 1, 0.89), hit("a", 2, 0.88), hit("a", 3, 0.87), hit("b", 0, 0.9)],
      options,
    );

    const [first, second] = result.notes;
    expect(first.noteId).toBe("a");
    expect(first.bestScore).toBeCloseTo(0.9, 12);
    // Three extra chunks, capped at maxBonusChunks = 2.
    expect(first.score).toBeCloseTo(0.92, 12);
    expect(first.matchedChunkCount).toBe(4);
    expect(first.matches).toHaveLength(2);
    expect(second.noteId).toBe("b");
    expect(second.score).toBeCloseTo(0.9, 12);
  });

  it("keeps the strongest chunk per anchor line", () => {
    const result = aggregateChunkHits(
      [hit("a", 0, 0.8, 7), hit("a", 1, 0.95, 7), hit("a", 2, 0.9, 9)],
      { ...options, multiChunkBonus: 0 },
    );

    expect(result.notes[0].matchedChunkCount).toBe(2);
    expect(result.notes[0].matches.map((match) => match.primaryLine)).toEqual([7, 9]);
    expect(result.notes[0].matches[0].score).toBeCloseTo(0.95, 12);
  });

  it("treats the title chunk as its own anchor", () => {
    const result = aggregateChunkHits([hit("a", 0, 0.9, null), hit("a", 1, 0.88, 3)], {
      ...options,
      multiChunkBonus: 0,
    });

    expect(result.notes[0].matches.map((match) => match.kind)).toEqual(["title", "body"]);
  });

  it("limits notes to topK with a deterministic tie-break", () => {
    const result = aggregateChunkHits(
      [hit("c", 0, 0.9), hit("b", 0, 0.9), hit("a", 0, 0.9)],
      options,
    );

    expect(result.notes.map((note) => note.noteId)).toEqual(["a", "b"]);
  });

  it("returns an empty result for no hits", () => {
    const result = aggregateChunkHits([], options);
    expect(result.notes).toHaveLength(0);
    expect(result.topChunkScore).toBeNull();
    expect(result.effectiveFloor).toBeCloseTo(0.4, 12);
  });

  it("does not raise a relative floor above a negative best score", () => {
    const result = aggregateChunkHits(
      [hit("best-negative", 0, -0.2), hit("weaker-negative", 0, -0.7)],
      {
        ...options,
        minCosine: -1,
        relativeMinRatio: 0.6,
      },
    );

    expect(result.effectiveFloor).toBe(-1);
    expect(result.notes.map((note) => note.noteId)).toEqual([
      "best-negative",
      "weaker-negative",
    ]);
  });
});

describe("appendShortQueryConsensus", () => {
  const primaryOptions: AggregationOptions = {
    ...DEFAULT_AGGREGATION,
    topK: 8,
  };
  const rescueOptions = {
    rawMinCosine: 0.235,
    expandedMinCosine: 0.3,
    relativeMinRatio: 0.6,
    maxMatchesPerNote: 3,
    topK: 8,
  };

  it("rescues entry-like cross-language chunks only when both views agree", () => {
    const raw = [
      hit("strong", 0, 0.333),
      hit("entrance-zh", 0, 0.252),
      hit("raw-noise", 0, 0.23),
    ];
    const expanded = [
      hit("expanded-noise", 0, 0.35),
      hit("entrance-zh", 0, 0.322),
      hit("raw-noise", 0, 0.34),
    ];
    const primary = aggregateChunkHits(raw, primaryOptions);
    const result = appendShortQueryConsensus(primary, raw, expanded, rescueOptions);

    expect(result.aggregation.notes.map((note) => note.noteId)).toEqual([
      "strong",
      "entrance-zh",
    ]);
    expect(result.aggregation.notes[1].bestScore).toBeCloseTo(0.252, 6);
    expect(result.diagnostics).toMatchObject({
      consensusChunkCount: 1,
      candidateNoteCount: 1,
      addedNoteCount: 1,
    });
    expect(result.diagnostics.rawFloor).toBeCloseTo(0.235, 6);
    expect(result.diagnostics.expandedFloor).toBeCloseTo(0.3, 6);
  });

  it("rejects raw-only, expanded-only, and different-anchor evidence", () => {
    const raw = [
      hit("raw-only", 0, 0.25),
      hit("below-raw-gate", 0, 0.23),
      hit("different-anchor", 0, 0.26),
    ];
    const expanded = [
      hit("expanded-only", 0, 0.9),
      hit("below-raw-gate", 0, 0.9),
      // Same note is insufficient: consensus is deliberately keyed by chunk.
      hit("different-anchor", 1, 0.9),
    ];
    const result = appendShortQueryConsensus(
      aggregateChunkHits(raw, primaryOptions),
      raw,
      expanded,
      rescueOptions,
    );

    expect(result.aggregation.notes).toEqual([]);
    expect(result.diagnostics.consensusChunkCount).toBe(0);
  });

  it("keeps primary note order and score while appending a rescued line", () => {
    const raw = [
      hit("primary-a", 0, 0.42, 1),
      hit("primary-b", 0, 0.38, 1),
      hit("primary-a", 1, 0.27, 2),
      hit("rescued-c", 0, 0.265, 4),
    ];
    const expanded = [
      hit("primary-a", 1, 0.34, 2),
      hit("rescued-c", 0, 0.33, 4),
    ];
    const primary = aggregateChunkHits(raw, primaryOptions);
    const originalOrder = primary.notes.map((note) => note.noteId);
    const originalScore = primary.notes[0].bestScore;
    const result = appendShortQueryConsensus(primary, raw, expanded, rescueOptions);

    expect(result.aggregation.notes.map((note) => note.noteId)).toEqual([
      ...originalOrder,
      "rescued-c",
    ]);
    expect(result.aggregation.notes[0].bestScore).toBe(originalScore);
    expect(result.aggregation.notes[0].matches.map((match) => match.primaryLine)).toEqual([1, 2]);
    expect(result.diagnostics).toMatchObject({ addedNoteCount: 1, enrichedNoteCount: 1 });
  });

  it("keeps the relative floor so a weak tail cannot be rescued behind a strong hit", () => {
    const raw = [hit("strong", 0, 0.8), hit("weak", 0, 0.25)];
    const expanded = [hit("weak", 0, 0.9)];
    const result = appendShortQueryConsensus(
      aggregateChunkHits(raw, primaryOptions),
      raw,
      expanded,
      rescueOptions,
    );

    expect(result.diagnostics.rawFloor).toBeCloseTo(0.48, 6);
    expect(result.aggregation.notes.map((note) => note.noteId)).toEqual(["strong"]);
  });

  it("exposes the raw score of the visible RRF-winning rescued match", () => {
    const raw = [hit("rescued", 0, 0.26, 1), hit("rescued", 1, 0.28, 2)];
    const expanded = [hit("rescued", 0, 0.9, 1), hit("rescued", 1, 0.31, 2)];
    const result = appendShortQueryConsensus(
      aggregateChunkHits(raw, primaryOptions),
      raw,
      expanded,
      { ...rescueOptions, maxMatchesPerNote: 1 },
    );

    const [rescued] = result.aggregation.notes;
    expect(rescued.matches).toHaveLength(1);
    expect(rescued.matches[0].primaryLine).toBe(1);
    expect(rescued.bestScore).toBe(rescued.matches[0].score);
    expect(rescued.bestScore).toBeCloseTo(0.26, 6);
  });

  it("counts all rescued anchors even when visible matches are capped", () => {
    const raw = [
      hit("primary", 0, 0.4, 1),
      hit("primary", 1, 0.27, 2),
      hit("primary", 2, 0.26, 3),
    ];
    const expanded = [hit("primary", 1, 0.34, 2), hit("primary", 2, 0.33, 3)];
    const primary = aggregateChunkHits(raw, { ...primaryOptions, maxMatchesPerNote: 1 });
    const result = appendShortQueryConsensus(primary, raw, expanded, {
      ...rescueOptions,
      maxMatchesPerNote: 1,
    });

    expect(result.aggregation.notes[0].matches).toHaveLength(1);
    expect(result.aggregation.notes[0].matchedChunkCount).toBe(3);
    expect(result.diagnostics.enrichedNoteCount).toBe(1);
  });
});

describe("resolveAggregationOptions", () => {
  it("returns defaults and validates overrides", () => {
    expect(resolveAggregationOptions(undefined)).toEqual(DEFAULT_AGGREGATION);
    expect(() => resolveAggregationOptions({ minCosine: 2 })).toThrow(/minCosine/);
    expect(() => resolveAggregationOptions({ relativeMinRatio: -0.1 })).toThrow(/relativeMinRatio/);
    expect(() => resolveAggregationOptions({ topK: 0 })).toThrow(/topK/);
    expect(() => resolveAggregationOptions({ maxMatchesPerNote: 1.5 })).toThrow(/integer/);
    expect(() => resolveAggregationOptions({ multiChunkBonus: Number.NaN })).toThrow(/finite/);
  });
});
