import { AppError } from "./http";
import type { Env } from "./types";

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
  const response = await env.AI.run(model, { text: [text], truncate_inputs: true });
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

export function documentText(title: string, body: string): string {
  const combined = `${title.trim()}\n\n${body.trim()}`.trim();
  // Cloudflare documents a 60,000-token context for BGE-M3. A character count
  // is not a token count, so cap the payload conservatively and also request
  // model-side truncation. Lexical search still indexes the complete body.
  return combined.slice(0, 60_000);
}
