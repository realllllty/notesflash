import { describe, expect, it } from "vitest";

import {
  aggregateChunkHits,
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
