import { AppError } from "./http";
import type { Env } from "./types";

const QUERY_CACHE_TTL_MS = 5 * 60 * 1000;
const QUERY_CACHE_MAX_ENTRIES = 64;

interface CachedQueryEmbedding {
  expiresAt: number;
  vector: Promise<number[]>;
}

// Workers are reused between requests. Keeping a very small, short-lived cache
// avoids paying the Workers AI inference latency again when someone returns to
// a recent query (or types, erases, and re-enters it). This is deliberately an
// isolate-local cache rather than Cache API storage: search text and vectors
// must not be persisted in a shared HTTP cache.
const queryEmbeddingCache = new Map<string, CachedQueryEmbedding>();

function findVector(value: unknown): number[] | null {
  if (Array.isArray(value) && value.length > 0 && value.every((item) => typeof item === "number")) {
    return value as number[];
  }
  if (Array.isArray(value) && value.length > 0) {
    for (const item of value) {
      const nested = findVector(item);
      if (nested) return nested;
    }
  }
  if (value && typeof value === "object") {
    for (const key of ["data", "embedding", "embeddings", "result", "response"]) {
      const nested = findVector((value as Record<string, unknown>)[key]);
      if (nested) return nested;
    }
  }
  return null;
}

export async function embedText(env: Env, text: string): Promise<number[]> {
  const model = env.EMBEDDING_MODEL ?? "@cf/baai/bge-m3";
  let response: unknown;
  try {
    response = await env.AI.run(model, { text: [text], truncate_inputs: true });
  } catch (error) {
    console.error("Workers AI embedding request failed", error);
    throw new AppError(
      503,
      "EMBEDDING_UNAVAILABLE",
      "Workers AI could not generate an embedding for this request.",
    );
  }
  const vector = findVector(response);
  if (!vector) {
    throw new AppError(502, "INVALID_EMBEDDING_RESPONSE", "Workers AI returned no embedding vector.");
  }

  const expectedDimensions = Number.parseInt(env.EMBEDDING_DIMENSIONS ?? "1024", 10);
  if (Number.isFinite(expectedDimensions) && expectedDimensions > 0 && vector.length !== expectedDimensions) {
    throw new AppError(
      502,
      "EMBEDDING_DIMENSION_MISMATCH",
      `Expected ${expectedDimensions} dimensions but received ${vector.length}.`,
    );
  }
  return vector;
}

export async function embedQuery(env: Env, query: string): Promise<number[]> {
  const model = env.EMBEDDING_MODEL ?? "@cf/baai/bge-m3";
  const dimensions = env.EMBEDDING_DIMENSIONS ?? "1024";
  const key = `${model}\u0000${dimensions}\u0000${query}`;
  const now = Date.now();
  const cached = queryEmbeddingCache.get(key);
  if (cached && cached.expiresAt > now) {
    // Refresh insertion order so frequently reused queries survive eviction.
    queryEmbeddingCache.delete(key);
    queryEmbeddingCache.set(key, cached);
    return cached.vector;
  }
  if (cached) queryEmbeddingCache.delete(key);

  const vector = embedText(env, documentText(query, ""));
  const entry: CachedQueryEmbedding = {
    expiresAt: now + QUERY_CACHE_TTL_MS,
    vector,
  };
  queryEmbeddingCache.set(key, entry);
  while (queryEmbeddingCache.size > QUERY_CACHE_MAX_ENTRIES) {
    const oldest = queryEmbeddingCache.keys().next().value as string | undefined;
    if (oldest === undefined) break;
    queryEmbeddingCache.delete(oldest);
  }

  try {
    return await vector;
  } catch (error) {
    // Never cache a transient Workers AI failure.
    if (queryEmbeddingCache.get(key) === entry) queryEmbeddingCache.delete(key);
    throw error;
  }
}

export function documentText(title: string, body: string): string {
  const combined = `${title.trim()}\n\n${body.trim()}`.trim();
  // Cloudflare documents a 60,000-token context for BGE-M3. A character count
  // is not a token count, so cap the payload conservatively and also request
  // model-side truncation. Lexical search still indexes the complete body.
  return combined.slice(0, 60_000);
}
