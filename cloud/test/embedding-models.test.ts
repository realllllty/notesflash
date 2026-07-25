import { describe, expect, it, vi } from "vitest";

import {
  embedTexts,
  embeddingModelSpec,
  extractVectors,
  EMBEDDING_MODELS,
} from "../src/embedding-models";
import type { Env } from "../src/types";

function env(run: (model: string, input: Record<string, unknown>) => Promise<unknown>): Env {
  return { AI: { run } } as unknown as Env;
}

function vector(dimensions: number, seed: number): number[] {
  return new Array(dimensions).fill(0).map((_, index) => (index === 0 ? seed : 0));
}

describe("embeddingModelSpec", () => {
  it("returns the default model and rejects unknown models", () => {
    expect(embeddingModelSpec(undefined).id).toBe("@cf/baai/bge-m3");
    expect(embeddingModelSpec("@cf/qwen/qwen3-embedding-0.6b").dimensions).toBe(1024);
    expect(() => embeddingModelSpec("@cf/unknown/model")).toThrow(
      /Unsupported embedding model/,
    );
  });

  it("keeps every registered model within the Vectorize dimension limit", () => {
    for (const spec of Object.values(EMBEDDING_MODELS)) {
      expect(spec.dimensions).toBeLessThanOrEqual(1536);
      expect(spec.batchSize).toBeGreaterThan(0);
    }
  });
});

describe("extractVectors", () => {
  it("reads nested data arrays", () => {
    const response = { data: [vector(4, 1), vector(4, 2)] };
    expect(extractVectors(response, 2, 4)).toEqual(response.data);
  });

  it("reshapes a flat array using shape", () => {
    const response = { shape: [2, 3], data: [1, 0, 0, 2, 0, 0] };
    expect(extractVectors(response, 2, 3)).toEqual([[1, 0, 0], [2, 0, 0]]);
  });

  it("unwraps result and response envelopes", () => {
    expect(extractVectors({ result: { data: [vector(2, 5)] } }, 1, 2)).toEqual([vector(2, 5)]);
    expect(extractVectors({ response: [vector(2, 6)] }, 1, 2)).toEqual([vector(2, 6)]);
  });

  it("accepts a single flat vector", () => {
    expect(extractVectors([1, 2, 3], 1, 3)).toEqual([[1, 2, 3]]);
  });

  it("throws when no usable vectors exist", () => {
    expect(() => extractVectors({ nothing: true }, 1, 3)).toThrow(/no usable embedding vectors/);
  });
});

describe("embedTexts", () => {
  it("batches requests and preserves input order", async () => {
    const spec = { ...embeddingModelSpec("@cf/baai/bge-m3"), batchSize: 2 };
    const seen: string[][] = [];
    const run = vi.fn(async (_model: string, input: Record<string, unknown>) => {
      const texts = input.text as string[];
      seen.push(texts);
      return { data: texts.map((text) => vector(spec.dimensions, Number(text))) };
    });

    const result = await embedTexts(env(run), spec, ["1", "2", "3"], "document");

    expect(seen).toEqual([["1", "2"], ["3"]]);
    expect(result.aiCalls).toBe(2);
    expect(result.vectors.map((item) => item[0])).toEqual([1, 2, 3]);
  });

  it("requests truncate_inputs only for models that document it", async () => {
    const inputs: Array<Record<string, unknown>> = [];
    const run = vi.fn(async (_model: string, input: Record<string, unknown>) => {
      inputs.push(input);
      const texts = (input.text ?? input.queries ?? input.documents) as string[];
      return { data: texts.map(() => vector(1024, 1)) };
    });

    await embedTexts(env(run), embeddingModelSpec("@cf/baai/bge-m3"), ["a"], "document");
    await embedTexts(
      env(run),
      embeddingModelSpec("@cf/qwen/qwen3-embedding-0.6b"),
      ["a"],
      "document",
    );

    expect(inputs[0]).toMatchObject({ text: ["a"], truncate_inputs: true });
    expect(inputs[1]).toEqual({ documents: ["a"] });
  });

  it("sends an instruction only for query-side asymmetric embedding", async () => {
    const inputs: Array<Record<string, unknown>> = [];
    const run = vi.fn(async (_model: string, input: Record<string, unknown>) => {
      inputs.push(input);
      const texts = (input.queries ?? input.documents) as string[];
      return { data: texts.map(() => vector(1024, 1)) };
    });
    const spec = embeddingModelSpec("@cf/qwen/qwen3-embedding-0.6b");

    await embedTexts(env(run), spec, ["迁移"], "query");
    await embedTexts(env(run), spec, ["迁移"], "query", "custom instruction");

    expect(inputs[0]).toEqual({ queries: ["迁移"], instruction: spec.defaultInstruction });
    expect(inputs[1]).toEqual({ queries: ["迁移"], instruction: "custom instruction" });
  });

  it("adds the documented prefixes for prefix-style models", async () => {
    const inputs: Array<Record<string, unknown>> = [];
    const run = vi.fn(async (_model: string, input: Record<string, unknown>) => {
      inputs.push(input);
      return { data: (input.text as string[]).map(() => vector(768, 1)) };
    });
    const spec = embeddingModelSpec("@cf/google/embeddinggemma-300m");

    await embedTexts(env(run), spec, ["迁移"], "query");
    await embedTexts(env(run), spec, ["数据迁移说明"], "document");

    expect(inputs[0].text).toEqual(["task: search result | query: 迁移"]);
    expect(inputs[1].text).toEqual(["title: none | text: 数据迁移说明"]);
  });

  it("truncates over-long text before the request", async () => {
    let sent = "";
    const run = vi.fn(async (_model: string, input: Record<string, unknown>) => {
      sent = (input.text as string[])[0];
      return { data: [vector(1024, 1)] };
    });
    const spec = { ...embeddingModelSpec("@cf/baai/bge-m3"), maxCharsPerText: 10 };

    await embedTexts(env(run), spec, ["0123456789ABCDEF"], "document");
    expect(sent).toBe("0123456789");
  });

  it("reports an unavailable model as a service error", async () => {
    const run = vi.fn(async () => {
      throw new Error("Workers AI down");
    });

    await expect(
      embedTexts(env(run), embeddingModelSpec("@cf/baai/bge-m3"), ["a"], "document"),
    ).rejects.toMatchObject({ status: 503, code: "EMBEDDING_UNAVAILABLE" });
  });

  it("rejects a dimension mismatch", async () => {
    const run = vi.fn(async () => ({ data: [vector(16, 1)] }));

    await expect(
      embedTexts(env(run), embeddingModelSpec("@cf/baai/bge-m3"), ["a"], "document"),
    ).rejects.toMatchObject({ status: 502 });
  });

  it("returns nothing for an empty input list without calling Workers AI", async () => {
    const run = vi.fn(async () => ({ data: [] }));
    const result = await embedTexts(env(run), embeddingModelSpec("@cf/baai/bge-m3"), [], "document");

    expect(result).toEqual({ vectors: [], aiCalls: 0 });
    expect(run).not.toHaveBeenCalled();
  });
});
