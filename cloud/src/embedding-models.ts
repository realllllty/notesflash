/**
 * Multilingual embedding models available on Workers AI.
 *
 * Cross-language recall is handled entirely by the embedding space: query
 * views are embedded in one batch and compared against line-level chunks.
 * Workers AI ships exactly one reranker (`@cf/baai/bge-reranker-base`) whose cross-lingual
 * scores collapse into the noise band, so it is never the primary ranker here.
 *
 * Each model wants a slightly different input shape, and Workers AI responses
 * are not uniformly shaped either, so both directions are normalized in one
 * place and shared by the indexer, the query path, and the search lab.
 */
import { AppError } from "./http";
import type { Env } from "./types";

export type EmbeddingMode = "query" | "document";

export interface EmbeddingModelSpec {
  id: string;
  dimensions: number;
  /**
   * `symmetric`   — one text list, no query/document distinction.
   * `instructed`  — separate `queries` / `documents` inputs plus an instruction.
   * `prefixed`    — one text list where each side needs its own text prefix.
   */
  style: "symmetric" | "instructed" | "prefixed";
  defaultInstruction?: string;
  queryPrefix?: string;
  documentPrefix?: string;
  /** Conservative per-text character cap; long chunks are truncated first. */
  maxCharsPerText: number;
  /** Texts per Workers AI request. */
  batchSize: number;
  /** `truncate_inputs` is only documented for BGE models. */
  supportsTruncateInputs: boolean;
}

export const EMBEDDING_MODELS: Record<string, EmbeddingModelSpec> = {
  "@cf/baai/bge-m3": {
    id: "@cf/baai/bge-m3",
    dimensions: 1024,
    style: "symmetric",
    maxCharsPerText: 4_000,
    batchSize: 48,
    supportsTruncateInputs: true,
  },
  "@cf/qwen/qwen3-embedding-0.6b": {
    id: "@cf/qwen/qwen3-embedding-0.6b",
    dimensions: 1024,
    style: "instructed",
    defaultInstruction:
      "Given a search query, retrieve note lines that answer or relate to it, in any language",
    maxCharsPerText: 4_000,
    batchSize: 32,
    supportsTruncateInputs: false,
  },
  "@cf/google/embeddinggemma-300m": {
    id: "@cf/google/embeddinggemma-300m",
    dimensions: 768,
    style: "prefixed",
    queryPrefix: "task: search result | query: ",
    documentPrefix: "title: none | text: ",
    maxCharsPerText: 2_000,
    batchSize: 48,
    supportsTruncateInputs: false,
  },
};

/** Current deployed default; model changes require a fresh, leakage-free eval. */
export const DEFAULT_EMBEDDING_MODEL = "@cf/google/embeddinggemma-300m";

export function embeddingModelSpec(id: string | undefined): EmbeddingModelSpec {
  const spec = EMBEDDING_MODELS[id ?? DEFAULT_EMBEDDING_MODEL];
  if (!spec) {
    throw new AppError(
      400,
      "UNSUPPORTED_EMBEDDING_MODEL",
      `Unsupported embedding model. Available: ${Object.keys(EMBEDDING_MODELS).join(", ")}.`,
    );
  }
  return spec;
}

function isNumberArray(value: unknown): value is number[] {
  return Array.isArray(value) && value.length > 0 && value.every((item) => typeof item === "number");
}

function reshape(flat: number[], count: number, dimensions: number): number[][] | null {
  if (flat.length !== count * dimensions) return null;
  const vectors: number[][] = [];
  for (let index = 0; index < count; index += 1) {
    vectors.push(flat.slice(index * dimensions, (index + 1) * dimensions));
  }
  return vectors;
}

/**
 * Pull `count` vectors out of a Workers AI embedding response. Accepts nested
 * `data`, flat `data` with a `shape`, and the `result`/`response` wrappers used
 * by different model families.
 */
export function extractVectors(response: unknown, count: number, dimensions: number): number[][] {
  const candidates: unknown[] = [response];
  while (candidates.length > 0) {
    const current = candidates.shift();
    if (!current) continue;

    if (Array.isArray(current)) {
      const nested = current.filter(isNumberArray);
      if (nested.length === count) return nested as number[][];
      if (isNumberArray(current)) {
        if (count === 1 && current.length === dimensions) return [current];
        const reshaped = reshape(current, count, dimensions);
        if (reshaped) return reshaped;
      }
      continue;
    }

    if (typeof current === "object") {
      const record = current as Record<string, unknown>;
      const shape = record.shape;
      const data = record.data;
      if (Array.isArray(shape) && isNumberArray(data) && shape.length === 2) {
        const reshaped = reshape(data, Number(shape[0]), Number(shape[1]));
        if (reshaped && reshaped.length === count) return reshaped;
      }
      for (const key of ["data", "embeddings", "embedding", "result", "response", "vectors"]) {
        if (record[key] !== undefined) candidates.push(record[key]);
      }
    }
  }

  throw new AppError(
    502,
    "INVALID_EMBEDDING_RESPONSE",
    `Workers AI returned no usable embedding vectors (expected ${count}).`,
  );
}

function prepareTexts(spec: EmbeddingModelSpec, texts: string[], mode: EmbeddingMode): string[] {
  const prefix = mode === "query" ? spec.queryPrefix : spec.documentPrefix;
  return texts.map((text) => {
    const truncated = text.length > spec.maxCharsPerText ? text.slice(0, spec.maxCharsPerText) : text;
    return spec.style === "prefixed" && prefix ? `${prefix}${truncated}` : truncated;
  });
}

function requestFor(
  spec: EmbeddingModelSpec,
  texts: string[],
  mode: EmbeddingMode,
  instruction: string | undefined,
): Record<string, unknown> {
  if (spec.style === "instructed") {
    return mode === "query"
      ? {
        queries: texts,
        instruction: instruction ?? spec.defaultInstruction,
      }
      : { documents: texts };
  }
  const request: Record<string, unknown> = { text: texts };
  if (spec.supportsTruncateInputs) request.truncate_inputs = true;
  return request;
}

export interface EmbedBatchResult {
  vectors: number[][];
  aiCalls: number;
}

/**
 * Embed texts with a single model, batching Workers AI requests. Vectors come
 * back in input order so callers can zip them with their chunk metadata.
 */
export async function embedTexts(
  env: Env,
  spec: EmbeddingModelSpec,
  texts: string[],
  mode: EmbeddingMode,
  instruction?: string,
): Promise<EmbedBatchResult> {
  if (texts.length === 0) return { vectors: [], aiCalls: 0 };

  const prepared = prepareTexts(spec, texts, mode);
  const vectors: number[][] = [];
  let aiCalls = 0;

  for (let offset = 0; offset < prepared.length; offset += spec.batchSize) {
    const batch = prepared.slice(offset, offset + spec.batchSize);
    let response: unknown;
    try {
      response = await env.AI.run(spec.id, requestFor(spec, batch, mode, instruction));
      aiCalls += 1;
    } catch (error) {
      console.error("Workers AI embedding request failed", spec.id, mode, error);
      throw new AppError(
        503,
        "EMBEDDING_UNAVAILABLE",
        `Workers AI could not embed text with ${spec.id}.`,
      );
    }
    const batchVectors = extractVectors(response, batch.length, spec.dimensions);
    for (const vector of batchVectors) {
      if (vector.length !== spec.dimensions) {
        throw new AppError(
          502,
          "EMBEDDING_DIMENSION_MISMATCH",
          `${spec.id} returned ${vector.length} dimensions but ${spec.dimensions} were expected.`,
        );
      }
      vectors.push(vector);
    }
  }

  if (vectors.length !== texts.length) {
    throw new AppError(
      502,
      "INVALID_EMBEDDING_RESPONSE",
      `Workers AI returned ${vectors.length} vectors for ${texts.length} inputs.`,
    );
  }
  return { vectors, aiCalls };
}

export async function embedSingle(
  env: Env,
  spec: EmbeddingModelSpec,
  text: string,
  mode: EmbeddingMode,
  instruction?: string,
): Promise<number[]> {
  const { vectors } = await embedTexts(env, spec, [text], mode, instruction);
  return vectors[0];
}
