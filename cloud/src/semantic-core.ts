/**
 * Chunk-to-note scoring shared by the production semantic path and the search
 * lab. Keeping one implementation is what makes a lab sweep a valid prediction
 * of production behaviour: the lab only swaps how candidate chunks are found
 * (in-request embedding vs Vectorize recall), never how they are ranked.
 */
import type { ChunkKind } from "./chunking";

export interface ChunkHit {
  noteId: string;
  chunkId: string;
  chunkIndex: number;
  kind: ChunkKind;
  /** 1-based body line to scroll to; null for a title chunk. */
  primaryLine: number | null;
  lineStart: number | null;
  lineEnd: number | null;
  /** Character offsets into the note body; null for a title chunk. */
  charStart: number | null;
  charEnd: number | null;
  /** Cosine similarity between the query and this chunk. */
  score: number;
  text?: string;
}

export interface AggregationOptions {
  /** Absolute cosine floor; below this a chunk is never a match. */
  minCosine: number;
  /** Keep chunks scoring at least this ratio of the best chunk in the result set. */
  relativeMinRatio: number;
  /** Score bonus per additional matching chunk inside the same note. */
  multiChunkBonus: number;
  /** Maximum number of bonus-eligible extra chunks. */
  maxBonusChunks: number;
  /** Matched lines returned per note. */
  maxMatchesPerNote: number;
  /** Notes returned. */
  topK: number;
}

/**
 * Calibrated on the evaluation corpus with EmbeddingGemma line-window chunks:
 * negative-only queries peaked at 0.231 while the weakest true positive scored
 * 0.345, so a 0.3 floor rejects "nothing matches" without dropping real hits.
 * The relative rule then trims the weak tail behind a clearly better chunk.
 */
export const DEFAULT_AGGREGATION: AggregationOptions = {
  minCosine: 0.3,
  relativeMinRatio: 0.6,
  multiChunkBonus: 0.01,
  maxBonusChunks: 3,
  maxMatchesPerNote: 3,
  topK: 8,
};

const LIMITS = {
  minCosine: { min: -1, max: 1 },
  relativeMinRatio: { min: 0, max: 1 },
  multiChunkBonus: { min: 0, max: 0.5 },
  maxBonusChunks: { min: 0, max: 20 },
  maxMatchesPerNote: { min: 1, max: 20 },
  topK: { min: 1, max: 50 },
} as const;

function numberOption(
  value: unknown,
  fallback: number,
  bounds: { min: number; max: number },
  name: string,
  integer = false,
): number {
  if (value === undefined) return fallback;
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${name} must be a finite number.`);
  }
  if (integer && !Number.isInteger(value)) throw new Error(`${name} must be an integer.`);
  if (value < bounds.min || value > bounds.max) {
    throw new Error(`${name} must be between ${bounds.min} and ${bounds.max}.`);
  }
  return value;
}

export function resolveAggregationOptions(
  partial: Partial<AggregationOptions> | undefined,
  base: AggregationOptions = DEFAULT_AGGREGATION,
): AggregationOptions {
  return {
    minCosine: numberOption(partial?.minCosine, base.minCosine, LIMITS.minCosine, "minCosine"),
    relativeMinRatio: numberOption(
      partial?.relativeMinRatio,
      base.relativeMinRatio,
      LIMITS.relativeMinRatio,
      "relativeMinRatio",
    ),
    multiChunkBonus: numberOption(
      partial?.multiChunkBonus,
      base.multiChunkBonus,
      LIMITS.multiChunkBonus,
      "multiChunkBonus",
    ),
    maxBonusChunks: numberOption(
      partial?.maxBonusChunks,
      base.maxBonusChunks,
      LIMITS.maxBonusChunks,
      "maxBonusChunks",
      true,
    ),
    maxMatchesPerNote: numberOption(
      partial?.maxMatchesPerNote,
      base.maxMatchesPerNote,
      LIMITS.maxMatchesPerNote,
      "maxMatchesPerNote",
      true,
    ),
    topK: numberOption(partial?.topK, base.topK, LIMITS.topK, "topK", true),
  };
}

export function dotProduct(left: number[], right: number[]): number {
  let sum = 0;
  for (let index = 0; index < left.length; index += 1) sum += left[index] * right[index];
  return sum;
}

export function magnitude(vector: number[]): number {
  return Math.sqrt(dotProduct(vector, vector));
}

export function cosineSimilarity(left: number[], right: number[]): number {
  if (left.length !== right.length || left.length === 0) return 0;
  const denominator = magnitude(left) * magnitude(right);
  if (denominator === 0) return 0;
  return dotProduct(left, right) / denominator;
}

export interface AggregatedNote {
  noteId: string;
  /** Best chunk score plus the multi-chunk bonus; drives note ordering. */
  score: number;
  /** Best raw cosine score, unaffected by the bonus. */
  bestScore: number;
  matchedChunkCount: number;
  matches: ChunkHit[];
}

export interface AggregationResult {
  notes: AggregatedNote[];
  /** Highest chunk score seen before filtering; useful for calibration. */
  topChunkScore: number | null;
  /** The floor actually applied, after the relative rule. */
  effectiveFloor: number;
  consideredChunkCount: number;
  matchedChunkCount: number;
}

/** Prefer the strongest chunk per anchor line so one line is never repeated. */
function dedupeByAnchor(hits: ChunkHit[]): ChunkHit[] {
  const byAnchor = new Map<string, ChunkHit>();
  for (const hit of hits) {
    const anchor = hit.kind === "title" ? "title" : `line:${hit.primaryLine}`;
    const existing = byAnchor.get(anchor);
    if (!existing || hit.score > existing.score) byAnchor.set(anchor, hit);
  }
  return [...byAnchor.values()].sort(
    (left, right) => right.score - left.score || left.chunkIndex - right.chunkIndex,
  );
}

/**
 * Group scored chunks into note-level results.
 *
 * The threshold is deliberately two-sided. An absolute cosine floor removes
 * "nothing in the corpus is relevant" noise, while the relative rule suppresses
 * a weak tail whenever a clearly better chunk exists — a single absolute number
 * cannot do both, which is what made the previous reranker threshold unusable.
 */
export function aggregateChunkHits(
  hits: readonly ChunkHit[],
  options: AggregationOptions,
): AggregationResult {
  const topChunkScore = hits.reduce<number | null>(
    (best, hit) => (best === null || hit.score > best ? hit.score : best),
    null,
  );
  const effectiveFloor = topChunkScore === null
    ? options.minCosine
    : Math.max(options.minCosine, topChunkScore * options.relativeMinRatio);

  const kept = hits.filter((hit) => hit.score >= effectiveFloor);
  const byNote = new Map<string, ChunkHit[]>();
  for (const hit of kept) {
    const list = byNote.get(hit.noteId) ?? [];
    list.push(hit);
    byNote.set(hit.noteId, list);
  }

  const notes: AggregatedNote[] = [...byNote.entries()].map(([noteId, noteHits]) => {
    const ranked = dedupeByAnchor(noteHits);
    const bestScore = ranked[0].score;
    const extras = Math.min(Math.max(ranked.length - 1, 0), options.maxBonusChunks);
    return {
      noteId,
      bestScore,
      score: bestScore + extras * options.multiChunkBonus,
      matchedChunkCount: ranked.length,
      matches: ranked.slice(0, options.maxMatchesPerNote),
    };
  });

  notes.sort((left, right) => right.score - left.score || left.noteId.localeCompare(right.noteId));

  return {
    notes: notes.slice(0, options.topK),
    topChunkScore,
    effectiveFloor,
    consideredChunkCount: hits.length,
    matchedChunkCount: kept.length,
  };
}
