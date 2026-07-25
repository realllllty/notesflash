import { describe, expect, it } from "vitest";

import { DEFAULT_CHUNKING } from "../src/chunking";
import {
  DEFAULT_CHUNK_TOP_K,
  DEFAULT_SHORT_QUERY_RESCUE,
  semanticConfig,
} from "../src/semantic-config";
import { DEFAULT_AGGREGATION } from "../src/semantic-core";
import type { Env } from "../src/types";

function env(vars: Record<string, string> = {}): Env {
  return vars as unknown as Env;
}

describe("semanticConfig", () => {
  it("uses the calibrated defaults when nothing is configured", () => {
    const config = semanticConfig(env());

    expect(config.spec.id).toBe("@cf/google/embeddinggemma-300m");
    expect(config.spec.dimensions).toBe(768);
    expect(config.chunking).toEqual(DEFAULT_CHUNKING);
    expect(config.aggregation).toEqual(DEFAULT_AGGREGATION);
    expect(config.chunkTopK).toBe(DEFAULT_CHUNK_TOP_K);
    expect(config.shortQueryRescue).toEqual(DEFAULT_SHORT_QUERY_RESCUE);
    expect(config.instruction).toBeUndefined();
  });

  it("applies configured overrides", () => {
    const config = semanticConfig(env({
      EMBEDDING_MODEL: "@cf/qwen/qwen3-embedding-0.6b",
      EMBEDDING_INSTRUCTION: "Retrieve matching note lines in any language",
      SEMANTIC_MIN_COSINE: "0.42",
      SEMANTIC_RELATIVE_MIN_RATIO: "0.75",
      SEMANTIC_SHORT_QUERY_RESCUE: "false",
      SEMANTIC_SHORT_QUERY_MAX_CODEPOINTS: "18",
      SEMANTIC_SHORT_QUERY_MAX_TOKENS: "2",
      SEMANTIC_SHORT_QUERY_RAW_MIN_COSINE: "0.22",
      SEMANTIC_SHORT_QUERY_EXPANDED_MIN_COSINE: "0.34",
      SEMANTIC_MULTI_CHUNK_BONUS: "0.02",
      SEMANTIC_MAX_BONUS_CHUNKS: "2",
      SEMANTIC_MAX_MATCHES_PER_NOTE: "4",
      SEMANTIC_TOP_K: "12",
      SEMANTIC_CHUNK_TOP_K: "60",
      SEMANTIC_CHUNK_TARGET_CHARS: "160",
      SEMANTIC_CHUNK_MAX_CHARS: "320",
      SEMANTIC_CHUNK_MIN_CHARS: "10",
      SEMANTIC_CHUNK_MAX_LINES: "2",
      SEMANTIC_CHUNK_OVERLAP_LINES: "1",
      SEMANTIC_CHUNK_TITLE_CONTEXT: "false",
    }));

    expect(config.spec.id).toBe("@cf/qwen/qwen3-embedding-0.6b");
    expect(config.instruction).toBe("Retrieve matching note lines in any language");
    expect(config.aggregation).toEqual({
      minCosine: 0.42,
      relativeMinRatio: 0.75,
      multiChunkBonus: 0.02,
      maxBonusChunks: 2,
      maxMatchesPerNote: 4,
      topK: 12,
    });
    expect(config.chunking).toEqual({
      targetChars: 160,
      maxChars: 320,
      minChars: 10,
      maxLines: 2,
      overlapLines: 1,
      titleContext: false,
      includeTitleChunk: true,
    });
    expect(config.shortQueryRescue).toEqual({
      enabled: false,
      maxCodePoints: 18,
      maxTokens: 2,
      rawMinCosine: 0.22,
      expandedMinCosine: 0.34,
    });
    expect(config.chunkTopK).toBe(60);
  });

  it("treats empty strings as unset", () => {
    const config = semanticConfig(env({
      SEMANTIC_MIN_COSINE: "",
      SEMANTIC_CHUNK_MAX_LINES: "",
      EMBEDDING_INSTRUCTION: "  ",
    }));

    expect(config.aggregation.minCosine).toBe(DEFAULT_AGGREGATION.minCosine);
    expect(config.chunking.maxLines).toBe(DEFAULT_CHUNKING.maxLines);
    expect(config.instruction).toBeUndefined();
  });

  it.each([
    ["SEMANTIC_MIN_COSINE", "abc"],
    ["SEMANTIC_MIN_COSINE", "2"],
    ["SEMANTIC_RELATIVE_MIN_RATIO", "-1"],
    ["SEMANTIC_CHUNK_MAX_LINES", "0"],
    ["SEMANTIC_CHUNK_MAX_LINES", "1.5"],
    ["SEMANTIC_CHUNK_TITLE_CONTEXT", "yes"],
    ["SEMANTIC_SHORT_QUERY_RESCUE", "yes"],
    ["SEMANTIC_SHORT_QUERY_MAX_CODEPOINTS", "0"],
    ["SEMANTIC_SHORT_QUERY_MAX_TOKENS", "101"],
    ["SEMANTIC_SHORT_QUERY_RAW_MIN_COSINE", "2"],
    ["SEMANTIC_SHORT_QUERY_RAW_MIN_COSINE", "0.3"],
    ["SEMANTIC_SHORT_QUERY_EXPANDED_MIN_COSINE", "-2"],
    ["SEMANTIC_CHUNK_TOP_K", "500"],
    ["SEMANTIC_TOP_K", "50"],
  ])("rejects invalid %s=%s", (name, value) => {
    expect(() => semanticConfig(env({ [name]: value }))).toThrow();
    try {
      semanticConfig(env({ [name]: value }));
    } catch (error) {
      expect(error).toMatchObject({ status: 500 });
    }
  });

  it("rejects a chunk window smaller than the overlap", () => {
    expect(() =>
      semanticConfig(env({ SEMANTIC_CHUNK_MAX_LINES: "1", SEMANTIC_CHUNK_OVERLAP_LINES: "1" }))
    ).toThrow(/overlapLines/);
  });

  it("rejects an unsupported model with a client error", () => {
    try {
      semanticConfig(env({ EMBEDDING_MODEL: "@cf/openai/not-real" }));
      throw new Error("expected a failure");
    } catch (error) {
      expect(error).toMatchObject({ status: 400, code: "UNSUPPORTED_EMBEDDING_MODEL" });
    }
  });

  it("does not apply Gemma-calibrated rescue floors to another model", () => {
    const config = semanticConfig(env({
      EMBEDDING_MODEL: "@cf/baai/bge-m3",
      SEMANTIC_SHORT_QUERY_RESCUE: "true",
    }));
    expect(config.shortQueryRescue.enabled).toBe(false);
  });

  it("rejects a primary floor that leaves no rescue interval", () => {
    expect(() => semanticConfig(env({ SEMANTIC_MIN_COSINE: "0.2" }))).toThrow(
      /RAW_MIN_COSINE must be below SEMANTIC_MIN_COSINE/,
    );
  });
});
