/**
 * Environment-driven semantic search configuration.
 *
 * The indexer, the query path, and the search lab all resolve their behaviour
 * here, so a value calibrated in the lab can be promoted by changing one
 * variable in `wrangler.jsonc` without touching code.
 *
 * The deployed defaults remain stable while `cloud/eval` separates calibration
 * from a frozen short cross-language holdout. Synthetic `[EVAL:key]` title
 * markers are stripped before embedding so future tuning cannot leak answers.
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

export interface ShortQueryRescueOptions {
  /** Compare a second, contextual query view against the same chunk index. */
  enabled: boolean;
  /** Unicode code-point ceiling; avoids treating a long CJK query as "short". */
  maxCodePoints: number;
  /** Whitespace-delimited token ceiling for short natural-language phrases. */
  maxTokens: number;
  /** Raw-view floor below which the expanded view may never rescue a chunk. */
  rawMinCosine: number;
  /** Expanded-view floor; the expanded view is corroboration, never a union. */
  expandedMinCosine: number;
}

/**
 * Selected from production-safe score probes; the frozen short cross-language
 * holdout is the release gate. The primary 0.3 floor remains unchanged. A lower
 * raw score is admitted only when the contextual view finds the same chunk.
 */
export const DEFAULT_SHORT_QUERY_RESCUE: ShortQueryRescueOptions = {
  enabled: true,
  maxCodePoints: 24,
  maxTokens: 3,
  rawMinCosine: 0.235,
  expandedMinCosine: 0.3,
};

export interface SemanticConfig {
  spec: EmbeddingModelSpec;
  instruction?: string;
  chunking: ChunkingOptions;
  aggregation: AggregationOptions;
  /** Chunk candidates pulled from Vectorize before aggregation. */
  chunkTopK: number;
  shortQueryRescue: ShortQueryRescueOptions;
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

  const rescueRequested = booleanVar(
    env.SEMANTIC_SHORT_QUERY_RESCUE,
    "SEMANTIC_SHORT_QUERY_RESCUE",
  ) ?? DEFAULT_SHORT_QUERY_RESCUE.enabled;
  const shortQueryRescue: ShortQueryRescueOptions = {
    // The score distribution was measured for EmbeddingGemma only. Other
    // models stay on their primary path until they receive separate calibration.
    enabled: spec.id === DEFAULT_EMBEDDING_MODEL && rescueRequested,
    maxCodePoints: integerVar(
      env.SEMANTIC_SHORT_QUERY_MAX_CODEPOINTS,
      "SEMANTIC_SHORT_QUERY_MAX_CODEPOINTS",
    ) ?? DEFAULT_SHORT_QUERY_RESCUE.maxCodePoints,
    maxTokens: integerVar(
      env.SEMANTIC_SHORT_QUERY_MAX_TOKENS,
      "SEMANTIC_SHORT_QUERY_MAX_TOKENS",
    ) ?? DEFAULT_SHORT_QUERY_RESCUE.maxTokens,
    rawMinCosine: numberVar(
      env.SEMANTIC_SHORT_QUERY_RAW_MIN_COSINE,
      "SEMANTIC_SHORT_QUERY_RAW_MIN_COSINE",
    ) ?? DEFAULT_SHORT_QUERY_RESCUE.rawMinCosine,
    expandedMinCosine: numberVar(
      env.SEMANTIC_SHORT_QUERY_EXPANDED_MIN_COSINE,
      "SEMANTIC_SHORT_QUERY_EXPANDED_MIN_COSINE",
    ) ?? DEFAULT_SHORT_QUERY_RESCUE.expandedMinCosine,
  };
  if (shortQueryRescue.maxCodePoints < 1 || shortQueryRescue.maxCodePoints > 2_000) {
    throw configurationError("SEMANTIC_SHORT_QUERY_MAX_CODEPOINTS must be between 1 and 2000.");
  }
  if (shortQueryRescue.maxTokens < 1 || shortQueryRescue.maxTokens > 100) {
    throw configurationError("SEMANTIC_SHORT_QUERY_MAX_TOKENS must be between 1 and 100.");
  }
  if (shortQueryRescue.rawMinCosine < -1 || shortQueryRescue.rawMinCosine > 1) {
    throw configurationError("SEMANTIC_SHORT_QUERY_RAW_MIN_COSINE must be between -1 and 1.");
  }
  if (shortQueryRescue.expandedMinCosine < -1 || shortQueryRescue.expandedMinCosine > 1) {
    throw configurationError("SEMANTIC_SHORT_QUERY_EXPANDED_MIN_COSINE must be between -1 and 1.");
  }
  if (
    shortQueryRescue.enabled &&
    shortQueryRescue.rawMinCosine >= aggregation.minCosine
  ) {
    throw configurationError(
      "SEMANTIC_SHORT_QUERY_RAW_MIN_COSINE must be below SEMANTIC_MIN_COSINE when rescue is enabled.",
    );
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
    shortQueryRescue,
    spanRefine,
  };
}
