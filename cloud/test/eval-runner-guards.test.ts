import { describe, expect, it } from "vitest";

// @ts-expect-error - the evaluation CLI is plain ESM JavaScript.
import {
  assertRecordHashes,
  assertThresholdReplaySafe,
  bucketUsesConsensusRescue,
  suiteName,
} from "../eval/run-eval.mjs";

describe("evaluation report guards", () => {
  it("blocks filtering and threshold tuning on frozen or protected suites", () => {
    expect(() => suiteName({ flags: { suite: "general-holdout", query: "hidden" } })).toThrow(
      /frozen/i,
    );
    expect(() => suiteName({ flags: { suite: "tech-holdout", scenario: "short" } })).toThrow(
      /frozen/i,
    );
    expect(() => suiteName({ flags: { suite: "all", thresholds: true } })).toThrow(
      /cannot be used for threshold/i,
    );
    expect(() => suiteName({ flags: { suite: "blind-final" } })).toThrow(/protected/i);
    expect(suiteName({ flags: { suite: "short-regression", query: "entry" } })).toBe(
      "short-regression",
    );
  });

  it("hard-fails missing or drifted suite/corpus hashes", () => {
    const golden = { name: "suite", hash: "suite-current", corpusSet: "full" };
    const corpus = { hash: "corpus-current" };

    expect(() => assertRecordHashes({}, golden, corpus)).toThrow(/no suite\/corpus hashes/i);
    expect(() => assertRecordHashes(
      { suiteHash: "suite-old", corpusHash: "corpus-current" },
      golden,
      corpus,
    )).toThrow(/suite hash drift/i);
    expect(() => assertRecordHashes(
      { suiteHash: "suite-current", corpusHash: "corpus-old" },
      golden,
      corpus,
    )).toThrow(/corpus hash drift/i);
    expect(() => assertRecordHashes(
      { suiteHash: "suite-current", corpusHash: "corpus-current" },
      golden,
      corpus,
    )).not.toThrow();
  });

  it("refuses raw-only threshold replay for consensus or live records", () => {
    const consensus = {
      corpus: "eval",
      strategies: {
        gemma: {
          name: "gemma",
          shortQueryRescue: { enabled: true },
          queries: {},
        },
      },
    };
    expect(bucketUsesConsensusRescue(consensus.strategies.gemma)).toBe(true);
    expect(() => assertThresholdReplaySafe(consensus)).toThrow(/cannot reproduce/i);
    expect(() => assertThresholdReplaySafe({ corpus: "live", strategies: {} })).toThrow(
      /live retrieval records/i,
    );
    expect(() => assertThresholdReplaySafe({
      corpus: "eval",
      strategies: { raw: { name: "raw", shortQueryRescue: { enabled: false }, queries: {} } },
    })).not.toThrow();
  });
});
