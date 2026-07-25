/**
 * Environment-driven semantic search configuration.
 *
 * The indexer, the query path, and the search lab all resolve their behaviour
 * here, so a value calibrated in the lab can be promoted by changing one
 * variable in `wrangler.jsonc` without touching code.
 *
 * Defaults are calibrated against the evaluation corpus in `cloud/eval`:
 * `@cf/google/embeddinggemma-300m` with line-window chunks reached R@1 93% /
 * R@3 100% with 100% line accuracy, and left a real score gap between the best
 * negative-query chunk (0.231) and the weakest true positive (0.345).
 */
import { DEFAULT_CHUNKING, resolveChunkingOptions, type ChunkingOptions } from "./chunking";
import {
  DEFAULT_EMBEDDING_MODEL,
  embeddingModelSpec,
  type EmbeddingModelSpec,
} from "./embedding-models";
import { AppError } from "./http";
import {
  DEFAULT_AGGREGATION,
  resolveAggregationOptions,
  type AggregationOptions,
} from "./semantic-core";
import { DEFAULT_SPAN_REFINE, type SpanRefineOptions } from "./span-refine";
import type { Env } from "./types";

export const DEFAULT_CHUNK_TOP_K = 40;
/** Vectorize caps topK at 100 when a query asks for neither values nor metadata. */
const MAX_CHUNK_TOP_K = 100;
const MAX_NOTE_TOP_K = 20;

export interface SemanticConfig {
  spec: EmbeddingModelSpec;
  instruction?: string;
  chunking: ChunkingOptions;
  aggregation: AggregationOptions;
  /** Chunk candidates pulled from Vectorize before aggregation. */
  chunkTopK: number;
  spanRefine: SpanRefineOptions;
}

function configurationError(message: string): AppError {
  return new AppError(500, "INVALID_SEMANTIC_CONFIGURATION", message);
}

function integerVar(value: string | undefined, name: string): number | undefined {
  if (value === undefined || value.trim() === "") return undefined;
  const parsed = Number(value.trim());
  if (!Number.isInteger(parsed)) throw configurationError(`${name} must be an integer.`);
  return parsed;
}

function numberVar(value: string | undefined, name: string): number | undefined {
  if (value === undefined || value.trim() === "") return undefined;
  const parsed = Number(value.trim());
  if (!Number.isFinite(parsed)) throw configurationError(`${name} must be a finite number.`);
  return parsed;
}

function booleanVar(value: string | undefined, name: string): boolean | undefined {
  if (value === undefined || value.trim() === "") return undefined;
  const normalized = value.trim().toLowerCase();
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  throw configurationError(`${name} must be "true" or "false".`);
}

export function semanticConfig(env: Env): SemanticConfig {
  const spec = embeddingModelSpec(env.EMBEDDING_MODEL ?? DEFAULT_EMBEDDING_MODEL);
  const instruction = env.EMBEDDING_INSTRUCTION?.trim();

  let chunking: ChunkingOptions;
  let aggregation: AggregationOptions;
  try {
    chunking = resolveChunkingOptions(
      {
        targetChars: integerVar(env.SEMANTIC_CHUNK_TARGET_CHARS, "SEMANTIC_CHUNK_TARGET_CHARS"),
        maxChars: integerVar(env.SEMANTIC_CHUNK_MAX_CHARS, "SEMANTIC_CHUNK_MAX_CHARS"),
        minChars: integerVar(env.SEMANTIC_CHUNK_MIN_CHARS, "SEMANTIC_CHUNK_MIN_CHARS"),
        maxLines: integerVar(env.SEMANTIC_CHUNK_MAX_LINES, "SEMANTIC_CHUNK_MAX_LINES"),
        overlapLines: integerVar(env.SEMANTIC_CHUNK_OVERLAP_LINES, "SEMANTIC_CHUNK_OVERLAP_LINES"),
        titleContext: booleanVar(env.SEMANTIC_CHUNK_TITLE_CONTEXT, "SEMANTIC_CHUNK_TITLE_CONTEXT"),
      },
      DEFAULT_CHUNKING,
    );
    aggregation = resolveAggregationOptions(
      {
        minCosine: numberVar(env.SEMANTIC_MIN_COSINE, "SEMANTIC_MIN_COSINE"),
        relativeMinRatio: numberVar(
          env.SEMANTIC_RELATIVE_MIN_RATIO,
          "SEMANTIC_RELATIVE_MIN_RATIO",
        ),
        multiChunkBonus: numberVar(env.SEMANTIC_MULTI_CHUNK_BONUS, "SEMANTIC_MULTI_CHUNK_BONUS"),
        maxBonusChunks: integerVar(env.SEMANTIC_MAX_BONUS_CHUNKS, "SEMANTIC_MAX_BONUS_CHUNKS"),
        maxMatchesPerNote: integerVar(
          env.SEMANTIC_MAX_MATCHES_PER_NOTE,
          "SEMANTIC_MAX_MATCHES_PER_NOTE",
        ),
        topK: integerVar(env.SEMANTIC_TOP_K, "SEMANTIC_TOP_K"),
      },
      DEFAULT_AGGREGATION,
    );
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw configurationError(error instanceof Error ? error.message : "Invalid configuration.");
  }

  if (aggregation.topK > MAX_NOTE_TOP_K) {
    throw configurationError(`SEMANTIC_TOP_K must be at most ${MAX_NOTE_TOP_K}.`);
  }

  const chunkTopK = integerVar(env.SEMANTIC_CHUNK_TOP_K, "SEMANTIC_CHUNK_TOP_K")
    ?? DEFAULT_CHUNK_TOP_K;
  if (chunkTopK < 1 || chunkTopK > MAX_CHUNK_TOP_K) {
    throw configurationError(`SEMANTIC_CHUNK_TOP_K must be between 1 and ${MAX_CHUNK_TOP_K}.`);
  }

  const spanRefine: SpanRefineOptions = {
    enabled: booleanVar(env.SEMANTIC_SPAN_REFINE, "SEMANTIC_SPAN_REFINE")
      ?? DEFAULT_SPAN_REFINE.enabled,
    minChunkChars: integerVar(env.SEMANTIC_SPAN_MIN_CHARS, "SEMANTIC_SPAN_MIN_CHARS")
      ?? DEFAULT_SPAN_REFINE.minChunkChars,
    maxCandidates: integerVar(env.SEMANTIC_SPAN_MAX_CANDIDATES, "SEMANTIC_SPAN_MAX_CANDIDATES")
      ?? DEFAULT_SPAN_REFINE.maxCandidates,
    maxNotes: integerVar(env.SEMANTIC_SPAN_MAX_NOTES, "SEMANTIC_SPAN_MAX_NOTES")
      ?? DEFAULT_SPAN_REFINE.maxNotes,
    minRatio: numberVar(env.SEMANTIC_SPAN_MIN_RATIO, "SEMANTIC_SPAN_MIN_RATIO")
      ?? DEFAULT_SPAN_REFINE.minRatio,
  };
  if (spanRefine.minChunkChars < 1 || spanRefine.maxCandidates < 1 || spanRefine.maxCandidates > 64) {
    throw configurationError("SEMANTIC_SPAN_* values are out of range.");
  }
  if (spanRefine.maxNotes < 1 || spanRefine.maxNotes > 20) {
    throw configurationError("SEMANTIC_SPAN_MAX_NOTES must be between 1 and 20.");
  }
  if (spanRefine.minRatio <= 0 || spanRefine.minRatio > 1) {
    throw configurationError("SEMANTIC_SPAN_MIN_RATIO must be between 0 and 1.");
  }

  return {
    spec,
    instruction: instruction && instruction.length > 0 ? instruction : undefined,
    chunking,
    aggregation,
    chunkTopK,
    spanRefine,
  };
}
