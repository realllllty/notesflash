import { describe, expect, it } from "vitest";

// @ts-expect-error - the dataset auditor is plain ESM JavaScript shared with Node scripts.
import { auditData, auditDatasets } from "../eval/audit-datasets.mjs";

describe("evaluation dataset audit", () => {
  it("passes every visible suite against the full merged corpus without opening blind-final", () => {
    const result = auditDatasets();

    expect(result.ok).toBe(true);
    expect(result.summary).toMatchObject({
      corpusFiles: 4,
      queryFiles: 6,
      notes: 352,
      queries: 255,
    });
    expect(result.errors).toEqual([]);
    // Historical regression collisions stay visible, while strict large-suite
    // collisions would appear in errors and fail this test.
    expect(result.summary.literalCollisions).toBe(result.summary.allowedLiteralCollisions);
  });

  it("detects metadata, uniqueness, reference, line, and literal-search failures", () => {
    const result = auditData({
      corpusArtifacts: [
        {
          file: "one.json",
          data: {
            notes: [
              { key: "note-a", title: "Visible note-a marker", body: "same title\nanswer line" },
              { key: "note-b", title: "Duplicate", body: "needle appears here" },
            ],
          },
        },
        {
          file: "two.json",
          data: {
            notes: [
              { key: "note-c", title: "Duplicate", body: "answer line\nanother answer line" },
            ],
          },
        },
      ],
      queryArtifacts: [
        {
          file: "queries-a.json",
          data: {
            queries: [
              {
                query: "needle",
                scenario: "positive",
                requiredRank: 1,
                expect: [{ key: "note-c", lineIncludes: "answer line" }],
                forbid: ["missing-note"],
              },
            ],
          },
        },
        {
          file: "queries-b.json",
          data: {
            queries: [{ query: "needle", scenario: "negative", expect: [] }],
          },
        },
      ],
    });

    expect(result.ok).toBe(false);
    expect(new Set(result.errors.map((error: { code: string }) => error.code))).toEqual(
      new Set([
        "metadata-key-leak",
        "duplicate-note-title",
        "unknown-forbid-key",
        "line-includes-cardinality",
        "duplicate-query",
        "literal-query-collision",
      ]),
    );
  });
});
