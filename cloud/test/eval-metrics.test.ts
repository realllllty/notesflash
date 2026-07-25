import { describe, expect, it } from "vitest";

// @ts-expect-error - the harness is plain ESM JavaScript shared with Node scripts.
import {
  byScenario,
  corpusIndex,
  evaluateQuery,
  expectedLineNumber,
  keyFromTitle,
  rescore,
  summarize,
} from "../eval/metrics.mjs";

const corpus = corpusIndex({
  notes: [
    {
      key: "migrate-en",
      title: "Legacy data migration runbook",
      body: "Owner: platform team\nStatus: in review\nWe migrate the legacy notes into the new schema.",
    },
    { key: "lunch", title: "午餐记录", body: "今天吃了牛肉面" },
    { key: "desk-move", title: "工位迁移安排", body: "下周五整层工位迁移到北楼。" },
  ],
});

function result(key: string, rank: number, score: number, lines: number[]) {
  return {
    rank,
    noteId: `id-${key}`,
    noteRef: `ref-${key}`,
    title: `[EVAL:${key}] title`,
    score,
    bestScore: score,
    matchedChunkCount: lines.length,
    matches: lines.map((line) => ({
      kind: "body",
      lineNumber: line,
      lineStart: line,
      lineEnd: line,
      charStart: line * 10,
      charEnd: line * 10 + 5,
      score,
    })),
  };
}

describe("corpus helpers", () => {
  it("parses eval keys from titles", () => {
    expect(keyFromTitle("[EVAL:migrate-en] Legacy data migration runbook")).toBe("migrate-en");
    expect(keyFromTitle("真实笔记")).toBeNull();
    expect(keyFromTitle(undefined)).toBeNull();
  });

  it("resolves expected line numbers from the corpus body", () => {
    expect(expectedLineNumber(corpus.get("migrate-en"), "migrate the legacy notes")).toBe(3);
    expect(expectedLineNumber(corpus.get("migrate-en"), "not present")).toBeNull();
    expect(expectedLineNumber(undefined, "anything")).toBeNull();
  });
});

describe("evaluateQuery", () => {
  const golden = {
    query: "迁移",
    scenario: "cross-language-zh-to-en",
    expect: [{ key: "migrate-en", lineIncludes: "migrate the legacy notes" }],
    forbid: ["desk-move"],
  };

  it("scores a correct line-level hit", () => {
    const row = evaluateQuery({
      golden,
      results: [result("migrate-en", 1, 0.72, [3])],
      rankedChunks: [{ score: 0.72 }],
      corpus,
    });

    expect(row).toMatchObject({
      rank: 1,
      reciprocalRank: 1,
      lineHit: true,
      expectedLine: 3,
      negative: false,
      falsePositive: false,
      forbiddenAboveExpected: false,
    });
  });

  it("detects a note hit with the wrong line", () => {
    const row = evaluateQuery({
      golden,
      results: [result("migrate-en", 1, 0.6, [1])],
      corpus,
    });

    expect(row.rank).toBe(1);
    expect(row.lineHit).toBe(false);
    expect(row.matchedLines).toEqual([1]);
  });

  it("accepts a multi-line chunk that covers the expected line", () => {
    const wide = result("migrate-en", 1, 0.6, [2]);
    wide.matches[0].lineStart = 2;
    wide.matches[0].lineEnd = 3;
    const row = evaluateQuery({ golden, results: [wide], corpus });
    expect(row.lineHit).toBe(true);
  });

  it("reports a miss and the strongest wrong note", () => {
    const row = evaluateQuery({
      golden,
      results: [result("lunch", 1, 0.55, [1])],
      corpus,
    });

    expect(row.rank).toBeNull();
    expect(row.reciprocalRank).toBe(0);
    expect(row.lineHit).toBeNull();
    expect(row.bestNegativeScore).toBeCloseTo(0.55, 12);
  });

  it("flags a forbidden note ranked above the expected note", () => {
    const row = evaluateQuery({
      golden,
      results: [result("desk-move", 1, 0.7, [1]), result("migrate-en", 2, 0.65, [3])],
      corpus,
    });

    expect(row.rank).toBe(2);
    expect(row.forbiddenAboveExpected).toBe(true);
  });

  it("treats any result for a negative query as a false positive", () => {
    const negative = { query: "螺旋星系", scenario: "negative", expect: [] };
    expect(evaluateQuery({ golden: negative, results: [], corpus }).falsePositive).toBe(false);
    expect(
      evaluateQuery({ golden: negative, results: [result("lunch", 1, 0.4, [1])], corpus })
        .falsePositive,
    ).toBe(true);
  });

  it("surfaces golden expectations that no longer exist in the corpus", () => {
    const row = evaluateQuery({
      golden: { query: "q", scenario: "s", expect: [{ key: "migrate-en", lineIncludes: "gone" }] },
      results: [],
      corpus,
    });
    expect(row.corpusLineMissing).toBe("gone");
  });
});

describe("summarize", () => {
  const rows = [
    { negative: false, scenario: "a", rank: 1, reciprocalRank: 1, lineHit: true, expectedScore: 0.7, bestNegativeScore: 0.4, unfilteredTopScore: 0.7 },
    { negative: false, scenario: "a", rank: 4, reciprocalRank: 0.25, lineHit: false, expectedScore: 0.55, bestNegativeScore: 0.6, unfilteredTopScore: 0.6 },
    { negative: false, scenario: "b", rank: null, reciprocalRank: 0, lineHit: null, expectedScore: null, bestNegativeScore: 0.5, unfilteredTopScore: 0.5 },
    { negative: true, scenario: "negative", rank: null, reciprocalRank: 0, lineHit: null, falsePositive: true, unfilteredTopScore: 0.45, bestNegativeScore: null },
    { negative: true, scenario: "negative", rank: null, reciprocalRank: 0, lineHit: null, falsePositive: false, unfilteredTopScore: 0.3, bestNegativeScore: null },
  ];

  it("aggregates recall, MRR, line accuracy, and score separation", () => {
    const summary = summarize(rows);

    expect(summary).toMatchObject({ queries: 5, positives: 3, negatives: 2 });
    expect(summary.recall1).toBeCloseTo(1 / 3, 12);
    expect(summary.recall8).toBeCloseTo(2 / 3, 12);
    expect(summary.mrr).toBeCloseTo((1 + 0.25 + 0) / 3, 12);
    expect(summary.lineAccuracy).toBeCloseTo(0.5, 12);
    expect(summary.negativeClean).toBeCloseTo(0.5, 12);
    expect(summary.minPositiveScore).toBeCloseTo(0.55, 12);
    expect(summary.maxNegativeScore).toBeCloseTo(0.6, 12);
  });

  it("groups rows by scenario", () => {
    expect(byScenario(rows).map((row: { scenario: string }) => row.scenario)).toEqual([
      "a",
      "b",
      "negative",
    ]);
  });
});

describe("rescore", () => {
  const rankedChunks = [
    { noteRef: "ref-a", noteId: "id-a", title: "[EVAL:a] A", kind: "body", lineNumber: 3, lineStart: 3, lineEnd: 3, charStart: 0, charEnd: 9, score: 0.8 },
    { noteRef: "ref-a", noteId: "id-a", title: "[EVAL:a] A", kind: "body", lineNumber: 5, lineStart: 5, lineEnd: 5, charStart: 20, charEnd: 29, score: 0.75 },
    { noteRef: "ref-b", noteId: "id-b", title: "[EVAL:b] B", kind: "body", lineNumber: 1, lineStart: 1, lineEnd: 1, charStart: 0, charEnd: 4, score: 0.5 },
  ];

  it("applies stricter thresholds offline", () => {
    const strict = rescore(rankedChunks, { minCosine: 0.6, relativeMinRatio: 0.9, topK: 8 });
    expect(strict.map((item: { title: string }) => item.title)).toEqual(["[EVAL:a] A"]);
    // Floor is max(0.6, 0.8 * 0.9) = 0.72, so the 0.75 line survives too.
    expect(strict[0].matches).toHaveLength(2);

    const veryStrict = rescore(rankedChunks, { minCosine: 0.6, relativeMinRatio: 0.99, topK: 8 });
    expect(veryStrict[0].matches.map((match: { lineNumber: number }) => match.lineNumber)).toEqual([3]);

    const loose = rescore(rankedChunks, { minCosine: 0.4, relativeMinRatio: 0.5, topK: 8 });
    expect(loose.map((item: { title: string }) => item.title)).toEqual(["[EVAL:a] A", "[EVAL:b] B"]);
    expect(loose[0].matches.map((match: { lineNumber: number }) => match.lineNumber)).toEqual([3, 5]);
  });
});
