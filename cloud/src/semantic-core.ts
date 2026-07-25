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
 * Stable primary defaults. The 0.3 floor is deliberately not lowered to fix a
 * short-query miss; weaker chunks need independent same-anchor corroboration
 * through `appendShortQueryConsensus`. The relative rule trims weak tails.
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
  /** Primary ordering score; rescued-note RRF ordering is applied before this shape. */
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

export interface ShortQueryConsensusOptions {
  /** Lower raw-view floor used only when the expanded view corroborates it. */
  rawMinCosine: number;
  /** Independent floor for the contextual query view. */
  expandedMinCosine: number;
  /** Apply the same weak-tail rule to both views. */
  relativeMinRatio: number;
  maxMatchesPerNote: number;
  topK: number;
}

export interface ShortQueryConsensusDiagnostics {
  rawFloor: number;
  expandedFloor: number;
  /** Weak chunks accepted by both views at the exact same chunk ID. */
  consensusChunkCount: number;
  /** Notes represented by those chunks, including already-primary notes. */
  candidateNoteCount: number;
  /** New notes actually appended after the primary raw ranking. */
  addedNoteCount: number;
  /** Primary notes that gained at least one additional line match. */
  enrichedNoteCount: number;
}

export interface ShortQueryConsensusResult {
  aggregation: AggregationResult;
  diagnostics: ShortQueryConsensusDiagnostics;
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

interface RankedConsensusHit {
  hit: ChunkHit;
  expandedScore: number;
  rawRank: number;
  expandedRank: number;
  rrfScore: number;
}

function anchorKey(hit: ChunkHit): string {
  return hit.kind === "title" ? "title" : `line:${hit.primaryLine}`;
}

/** Vectorize should not duplicate IDs, but the pending-index merge is defensive. */
function rankUniqueChunks(hits: readonly ChunkHit[]): ChunkHit[] {
  const strongest = new Map<string, ChunkHit>();
  for (const hit of hits) {
    const existing = strongest.get(hit.chunkId);
    if (!existing || hit.score > existing.score) strongest.set(hit.chunkId, hit);
  }
  return [...strongest.values()].sort(
    (left, right) => right.score - left.score || left.chunkId.localeCompare(right.chunkId),
  );
}

function compareConsensus(left: RankedConsensusHit, right: RankedConsensusHit): number {
  return right.rrfScore - left.rrfScore ||
    right.expandedScore - left.expandedScore ||
    right.hit.score - left.hit.score ||
    left.hit.chunkId.localeCompare(right.hit.chunkId);
}

/** Keep the best two-view candidate for each visible title/body line anchor. */
function dedupeConsensusAnchors(hits: RankedConsensusHit[]): RankedConsensusHit[] {
  const byAnchor = new Map<string, RankedConsensusHit>();
  for (const hit of hits) {
    const key = anchorKey(hit.hit);
    const existing = byAnchor.get(key);
    if (!existing || compareConsensus(hit, existing) < 0) byAnchor.set(key, hit);
  }
  return [...byAnchor.values()].sort(compareConsensus);
}

/**
 * A positive best score supports a proportional weak-tail floor. Multiplying a
 * negative best score by a ratio below one makes the result less negative and
 * therefore higher than the best candidate, which would incorrectly remove
 * every hit. In that case only the configured absolute floor is meaningful.
 */
function effectiveScoreFloor(
  absoluteFloor: number,
  topScore: number | null,
  relativeMinRatio: number,
): number {
  if (topScore === null || topScore <= 0) return absoluteFloor;
  return Math.max(absoluteFloor, topScore * relativeMinRatio);
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
  const effectiveFloor = effectiveScoreFloor(
    options.minCosine,
    topChunkScore,
    options.relativeMinRatio,
  );

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

/**
 * Append-only rescue for ambiguous short queries.
 *
 * The ordinary raw-query aggregation stays authoritative. A below-primary
 * chunk is admitted only when a contextual query view independently retrieves
 * the exact same chunk ID. Existing note order, note scores, and existing match
 * order never change. Newly admitted notes are appended and ordered internally
 * with reciprocal-rank fusion; their public score remains the raw cosine.
 */
export function appendShortQueryConsensus(
  primary: AggregationResult,
  rawHits: readonly ChunkHit[],
  expandedHits: readonly ChunkHit[],
  options: ShortQueryConsensusOptions,
): ShortQueryConsensusResult {
  const rawRanked = rankUniqueChunks(rawHits);
  const expandedRanked = rankUniqueChunks(expandedHits);
  const rawTop = rawRanked[0]?.score ?? null;
  const expandedTop = expandedRanked[0]?.score ?? null;
  const rawFloor = effectiveScoreFloor(
    options.rawMinCosine,
    rawTop,
    options.relativeMinRatio,
  );
  const expandedFloor = effectiveScoreFloor(
    options.expandedMinCosine,
    expandedTop,
    options.relativeMinRatio,
  );

  const expandedById = new Map(
    expandedRanked.map((hit, index) => [hit.chunkId, { hit, rank: index + 1 }]),
  );
  const consensus: RankedConsensusHit[] = [];
  rawRanked.forEach((raw, rawIndex) => {
    // A strong raw chunk is already represented by primary aggregation. The
    // second view is intentionally not allowed to rewrite that ranking.
    if (raw.score >= primary.effectiveFloor || raw.score < rawFloor) return;
    const expanded = expandedById.get(raw.chunkId);
    if (!expanded || expanded.hit.score < expandedFloor) return;
    const rawRank = rawIndex + 1;
    const expandedRank = expanded.rank;
    consensus.push({
      hit: raw,
      expandedScore: expanded.hit.score,
      rawRank,
      expandedRank,
      rrfScore: 1 / (60 + rawRank) + 1 / (60 + expandedRank),
    });
  });
  consensus.sort(compareConsensus);

  const candidatesByNote = new Map<string, RankedConsensusHit[]>();
  for (const candidate of consensus) {
    const list = candidatesByNote.get(candidate.hit.noteId) ?? [];
    list.push(candidate);
    candidatesByNote.set(candidate.hit.noteId, list);
  }

  const primaryNotes = primary.notes.map((note) => ({ ...note, matches: [...note.matches] }));
  const primaryById = new Map(primaryNotes.map((note) => [note.noteId, note]));
  const primaryAnchorsByNote = new Map<string, Set<string>>();
  for (const hit of rawRanked.filter((candidate) => candidate.score >= primary.effectiveFloor)) {
    const anchors = primaryAnchorsByNote.get(hit.noteId) ?? new Set<string>();
    anchors.add(anchorKey(hit));
    primaryAnchorsByNote.set(hit.noteId, anchors);
  }
  let enrichedNoteCount = 0;
  for (const [noteId, candidates] of candidatesByNote) {
    const note = primaryById.get(noteId);
    if (!note) continue;
    const existingAnchors = primaryAnchorsByNote.get(noteId) ?? new Set(note.matches.map(anchorKey));
    const additional = dedupeConsensusAnchors(candidates).filter(
      (candidate) => !existingAnchors.has(anchorKey(candidate.hit)),
    );
    note.matchedChunkCount += additional.length;
    for (const candidate of additional) {
      if (note.matches.length >= options.maxMatchesPerNote) break;
      const anchor = anchorKey(candidate.hit);
      existingAnchors.add(anchor);
      note.matches.push(candidate.hit);
    }
    if (additional.length > 0) enrichedNoteCount += 1;
  }

  const rescuedNotes = [...candidatesByNote.entries()]
    .filter(([noteId]) => !primaryById.has(noteId))
    .map(([noteId, candidates]) => {
      const ranked = dedupeConsensusAnchors(candidates);
      const best = ranked[0];
      const bestScore = best.hit.score;
      return {
        note: {
          noteId,
          // RRF controls only the order of rescued notes. Exposed scores remain
          // comparable with every other result because they are raw cosines.
          score: bestScore,
          bestScore,
          matchedChunkCount: ranked.length,
          matches: ranked.slice(0, options.maxMatchesPerNote).map((candidate) => candidate.hit),
        } satisfies AggregatedNote,
        rrfScore: best.rrfScore,
        expandedScore: best.expandedScore,
        rawScore: best.hit.score,
      };
    })
    .sort((left, right) =>
      right.rrfScore - left.rrfScore ||
      right.expandedScore - left.expandedScore ||
      right.rawScore - left.rawScore ||
      left.note.noteId.localeCompare(right.note.noteId)
    );

  const available = Math.max(0, options.topK - primaryNotes.length);
  const appended = rescuedNotes.slice(0, available).map((entry) => entry.note);
  const rawKeptIds = new Set(
    rawRanked.filter((hit) => hit.score >= primary.effectiveFloor).map((hit) => hit.chunkId),
  );
  const newlyMatched = consensus.reduce(
    (count, candidate) => count + (rawKeptIds.has(candidate.hit.chunkId) ? 0 : 1),
    0,
  );

  return {
    aggregation: {
      ...primary,
      notes: [...primaryNotes, ...appended],
      matchedChunkCount: primary.matchedChunkCount + newlyMatched,
    },
    diagnostics: {
      rawFloor,
      expandedFloor,
      consensusChunkCount: consensus.length,
      candidateNoteCount: candidatesByNote.size,
      addedNoteCount: appended.length,
      enrichedNoteCount,
    },
  };
}
