/**
 * Chunk-level semantic retrieval.
 *
 * Queries are matched against line-anchored chunk vectors in Vectorize, so a
 * result carries the specific line (and character range) that matched instead
 * of a whole-note verdict. Eligible short queries add one generic contextual
 * view in the same embedding batch and require both views to retrieve the same
 * chunk before a weak result can be rescued. Cross-language recall still comes
 * from the multilingual embedding space itself; there is no translation or
 * language-specific dictionary.
 *
 * Freshly saved notes are not in the index yet, so their chunks are scored in
 * request as a bounded fallback. That keeps "save then immediately search" from
 * silently returning nothing while the queue catches up.
 */
import { buildIdentifiedNoteChunks } from "./chunking";
import { embedTexts } from "./embedding-models";
import { AppError } from "./http";
import type { SemanticConfig, ShortQueryRescueOptions } from "./semantic-config";
import {
  aggregateChunkHits,
  appendShortQueryConsensus,
  cosineSimilarity,
  type ChunkHit,
  type ShortQueryConsensusDiagnostics,
} from "./semantic-core";
import type { Env, NoteChunkRow, SearchMatch } from "./types";

const QUERY_CACHE_TTL_MS = 5 * 60 * 1000;
const QUERY_CACHE_MAX_ENTRIES = 64;
/** Notes still waiting for the indexer that may be scored inside a request. */
const MAX_PENDING_NOTES_INLINE = 12;
const D1_PARAMETER_BATCH = 80;
/** Vectorize's maximum metadata-free query depth. */
const MAX_VECTOR_CANDIDATES = 100;
/** A bounded reserve lets current D1 rows replace stale Vectorize IDs. */
const VECTOR_OVERFETCH_FACTOR = 2;

interface QueryVectorViews {
  raw: number[];
  expanded: number[] | null;
}

interface CachedQueryVectors {
  expiresAt: number;
  vectors: Promise<QueryVectorViews>;
}

// Workers reuse isolates between requests, so a very small in-memory cache
// removes the embedding round trip when someone retypes or refines a query.
// Deliberately not the Cache API: query text must not reach shared storage.
const queryVectorCache = new Map<string, CachedQueryVectors>();

export const SHORT_QUERY_EXPANSION_PREFIX = "notes related to ";

export function isShortQueryRescueEligible(
  query: string,
  options: ShortQueryRescueOptions,
): boolean {
  const value = query.trim();
  if (!options.enabled || value.length === 0) return false;
  if ([...value].length > options.maxCodePoints) return false;
  return value.split(/\s+/u).length <= options.maxTokens;
}

function expandedQueryView(query: string): string {
  return `${SHORT_QUERY_EXPANSION_PREFIX}${query}`;
}

async function embedSearchQueryViews(
  env: Env,
  config: SemanticConfig,
  query: string,
): Promise<QueryVectorViews> {
  const expandedText = isShortQueryRescueEligible(query, config.shortQueryRescue)
    ? expandedQueryView(query)
    : null;
  const key = [
    config.spec.id,
    config.instruction ?? "",
    query,
    expandedText ?? "raw-only",
  ].join("\u0000");
  const now = Date.now();
  const cached = queryVectorCache.get(key);
  if (cached && cached.expiresAt > now) {
    queryVectorCache.delete(key);
    queryVectorCache.set(key, cached);
    return cached.vectors;
  }
  if (cached) queryVectorCache.delete(key);

  // Both short-query views fit in one Workers AI batch. This preserves one AI
  // network round trip while the two Vectorize lookups can run concurrently.
  const texts = expandedText === null ? [query] : [query, expandedText];
  const vectors = embedTexts(env, config.spec, texts, "query", config.instruction).then(
    (result): QueryVectorViews => ({
      raw: result.vectors[0],
      expanded: expandedText === null ? null : result.vectors[1],
    }),
  );
  const entry: CachedQueryVectors = {
    expiresAt: now + QUERY_CACHE_TTL_MS,
    vectors,
  };
  queryVectorCache.set(key, entry);
  while (queryVectorCache.size > QUERY_CACHE_MAX_ENTRIES) {
    const oldest = queryVectorCache.keys().next().value as string | undefined;
    if (oldest === undefined) break;
    queryVectorCache.delete(oldest);
  }

  try {
    return await vectors;
  } catch (error) {
    // Never cache a transient Workers AI failure.
    if (queryVectorCache.get(key) === entry) queryVectorCache.delete(key);
    throw error;
  }
}

export async function embedSearchQuery(
  env: Env,
  config: SemanticConfig,
  query: string,
): Promise<number[]> {
  return (await embedSearchQueryViews(env, config, query)).raw;
}

interface VectorizeMatchLike {
  id: string;
  score: number;
}

async function queryChunkIndex(
  env: Env,
  config: SemanticConfig,
  queryVector: number[],
): Promise<VectorizeMatchLike[]> {
  let response: Awaited<ReturnType<VectorizeIndex["query"]>>;
  try {
    const candidateDepth = Math.min(
      MAX_VECTOR_CANDIDATES,
      config.chunkTopK * VECTOR_OVERFETCH_FACTOR,
    );
    response = await env.CHUNK_INDEX.query(queryVector, {
      topK: candidateDepth,
      returnValues: false,
      returnMetadata: "none",
    });
  } catch (error) {
    console.error("Vectorize chunk query failed", error);
    throw new AppError(
      503,
      "VECTOR_SEARCH_UNAVAILABLE",
      "The semantic index could not be queried right now.",
    );
  }
  return (response.matches ?? [])
    .filter((match) => typeof match.id === "string" && typeof match.score === "number")
    .map((match) => ({ id: match.id, score: match.score }));
}

/**
 * Resolve chunk IDs to their line anchors, dropping anything that no longer
 * reflects a live note: deleted notes and chunks whose content hash has moved
 * on both disappear here, so a stale vector can never produce a phantom line.
 * Only the stored chunk slice is transferred, never whole note bodies.
 */
async function loadChunkRows(env: Env, chunkIds: string[]): Promise<NoteChunkRow[]> {
  const rows: NoteChunkRow[] = [];
  for (let offset = 0; offset < chunkIds.length; offset += D1_PARAMETER_BATCH) {
    const batch = chunkIds.slice(offset, offset + D1_PARAMETER_BATCH);
    const result = await env.DB.prepare(
      `SELECT c.chunk_id, c.note_id, c.content_hash, c.chunk_index, c.kind,
              c.primary_line, c.line_start, c.line_end, c.char_start, c.char_end,
              c.text, c.created_at
       FROM note_chunks c
       JOIN notes n ON n.id = c.note_id
       WHERE c.chunk_id IN (${batch.map(() => "?").join(",")})
         AND n.deleted_at IS NULL
         AND n.content_hash = c.content_hash`,
    )
      .bind(...batch)
      .all<NoteChunkRow>();
    rows.push(...result.results);
  }
  return rows;
}

function hitFromChunkRow(row: NoteChunkRow, score: number): ChunkHit {
  return {
    noteId: row.note_id,
    chunkId: row.chunk_id,
    chunkIndex: row.chunk_index,
    kind: row.kind,
    primaryLine: row.primary_line,
    lineStart: row.line_start,
    lineEnd: row.line_end,
    charStart: row.char_start,
    charEnd: row.char_end,
    score,
    text: row.text,
  };
}

interface PendingNoteRow {
  id: string;
  title: string;
  body: string;
  content_hash: string;
}

/**
 * Score notes the indexer has not reached yet. Bounded on purpose: this is a
 * freshness patch for a handful of just-saved notes, not a second search path.
 *
 * The backlog check comes first and only reads a count from an indexed column,
 * so the common "everything is indexed" case never pays for note bodies.
 */
async function scorePendingNotes(
  env: Env,
  config: SemanticConfig,
  queryVectors: QueryVectorViews,
): Promise<{
  rawHits: ChunkHit[];
  expandedHits: ChunkHit[];
  pendingNoteCount: number;
  scoredNoteCount: number;
  attempted: boolean;
  degraded: boolean;
}> {
  const backlog = await env.DB.prepare(
    `SELECT COUNT(*) AS count FROM notes
     WHERE deleted_at IS NULL
       AND embedding_status IN ('pending', 'processing')`,
  ).first<{ count: number }>();
  const pendingNoteCount = backlog?.count ?? 0;
  if (pendingNoteCount === 0) {
    return {
      rawHits: [],
      expandedHits: [],
      pendingNoteCount: 0,
      scoredNoteCount: 0,
      attempted: false,
      degraded: false,
    };
  }

  const rows = (await env.DB.prepare(
    `SELECT id, title, body, content_hash FROM notes
     WHERE deleted_at IS NULL
       AND embedding_status IN ('pending', 'processing')
     ORDER BY updated_at DESC
     LIMIT ?`,
  )
    .bind(MAX_PENDING_NOTES_INLINE)
    .all<PendingNoteRow>()).results;
  if (rows.length === 0) {
    return {
      rawHits: [],
      expandedHits: [],
      pendingNoteCount,
      scoredNoteCount: 0,
      attempted: false,
      degraded: false,
    };
  }

  const chunks = rows.flatMap((row) =>
    buildIdentifiedNoteChunks(
      {
        noteId: row.id,
        title: row.title,
        body: row.body,
        contentHash: row.content_hash,
      },
      config.chunking,
    ).map((chunk) => ({ row, chunk }))
  );
  if (chunks.length === 0) {
    return {
      rawHits: [],
      expandedHits: [],
      pendingNoteCount,
      scoredNoteCount: rows.length,
      attempted: false,
      degraded: false,
    };
  }

  let vectors: number[][];
  try {
    ({ vectors } = await embedTexts(
      env,
      config.spec,
      chunks.map((entry) => entry.chunk.embedText),
      "document",
      config.instruction,
    ));
  } catch (error) {
    // Freshness scoring is best-effort. A malformed or temporarily unavailable
    // pending embedding must not suppress healthy results already in Vectorize.
    console.warn("Inline semantic freshness scoring failed; using indexed candidates only", error);
    return {
      rawHits: [],
      expandedHits: [],
      pendingNoteCount,
      scoredNoteCount: 0,
      attempted: true,
      degraded: true,
    };
  }

  const hitsFor = (queryVector: number[]): ChunkHit[] => chunks.map((entry, index) => ({
    noteId: entry.row.id,
    chunkId: entry.chunk.chunkId,
    chunkIndex: entry.chunk.chunkIndex,
    kind: entry.chunk.kind,
    primaryLine: entry.chunk.primaryLine,
    lineStart: entry.chunk.lineStart,
    lineEnd: entry.chunk.lineEnd,
    charStart: entry.chunk.charStart,
    charEnd: entry.chunk.charEnd,
    score: cosineSimilarity(queryVector, vectors[index]),
    text: entry.chunk.text,
  }));

  return {
    rawHits: hitsFor(queryVectors.raw),
    expandedHits: queryVectors.expanded === null ? [] : hitsFor(queryVectors.expanded),
    pendingNoteCount,
    scoredNoteCount: rows.length,
    attempted: true,
    degraded: false,
  };
}

export interface SemanticRetrieval {
  queryVector: number[];
  hits: ChunkHit[];
  aggregation: ReturnType<typeof aggregateChunkHits>;
  indexedCandidateCount: number;
  resolvedCandidateCount: number;
  indexedUsedCandidateCount: number;
  usedCandidateCount: number;
  expandedIndexedCandidateCount: number;
  expandedResolvedCandidateCount: number;
  expandedIndexedUsedCandidateCount: number;
  expandedUsedCandidateCount: number;
  pendingNoteCount: number;
  pendingNotesScored: number;
  pendingFallback: {
    attempted: boolean;
    degraded: boolean;
  };
  shortQueryRescue: ShortQueryConsensusDiagnostics & {
    eligible: boolean;
    attempted: boolean;
    applied: boolean;
    expandedIndexAvailable: boolean;
    expandedVectorizeFailed: boolean;
  };
  timings: {
    embeddingMs: number;
    vectorMs: number;
    resolveMs: number;
    pendingMs: number;
  };
}

/** Deduplicate current-hash hits, restore score order, and enforce one shared budget. */
function selectTopChunkHits(
  limit: number,
  ...sources: ReadonlyArray<readonly ChunkHit[]>
): ChunkHit[] {
  const byChunk = new Map<string, ChunkHit>();
  for (const source of sources) {
    for (const hit of source) {
      const existing = byChunk.get(hit.chunkId);
      if (!existing || hit.score > existing.score) byChunk.set(hit.chunkId, hit);
    }
  }
  return [...byChunk.values()]
    .sort((left, right) => right.score - left.score || left.chunkId.localeCompare(right.chunkId))
    .slice(0, limit);
}

/** Full retrieval pass: embed, recall chunks, resolve anchors, aggregate. */
export async function retrieveSemanticMatches(
  env: Env,
  config: SemanticConfig,
  query: string,
): Promise<SemanticRetrieval> {
  const embeddingStartedAt = performance.now();
  const queryVectors = await embedSearchQueryViews(env, config, query);
  const embeddingMs = performance.now() - embeddingStartedAt;

  // Index recall and the freshness fallback are independent once the query is
  // embedded, so they run together instead of adding their latencies.
  const vectorStartedAt = performance.now();
  const [indexed, pending] = await Promise.all([
    (async () => {
      const expandedPromise = queryVectors.expanded === null
        ? Promise.resolve({ matches: [] as VectorizeMatchLike[], failed: false })
        : queryChunkIndex(env, config, queryVectors.expanded).then(
          (matches) => ({ matches, failed: false }),
          () => ({ matches: [] as VectorizeMatchLike[], failed: true }),
        );
      const [rawMatches, expandedOutcome] = await Promise.all([
        queryChunkIndex(env, config, queryVectors.raw),
        expandedPromise,
      ]);
      const vectorMs = performance.now() - vectorStartedAt;
      const resolveStartedAt = performance.now();
      const chunkIds = [...new Set([
        ...rawMatches.map((match) => match.id),
        ...expandedOutcome.matches.map((match) => match.id),
      ])];
      const rows = await loadChunkRows(env, chunkIds);
      const rowById = new Map(rows.map((row) => [row.chunk_id, row]));
      const hitsFor = (matches: VectorizeMatchLike[]): ChunkHit[] => selectTopChunkHits(
        MAX_VECTOR_CANDIDATES,
        matches.flatMap((match) => {
          const row = rowById.get(match.id);
          return row ? [hitFromChunkRow(row, match.score)] : [];
        }),
      );
      return {
        rawMatches,
        expandedMatches: expandedOutcome.matches,
        rawHits: hitsFor(rawMatches),
        expandedHits: hitsFor(expandedOutcome.matches),
        expandedVectorizeFailed: expandedOutcome.failed,
        vectorMs,
        resolveMs: performance.now() - resolveStartedAt,
      };
    })(),
    scorePendingNotes(env, config, queryVectors),
  ]);
  const pendingMs = performance.now() - vectorStartedAt;

  // During re-indexing either query view may see only part of a note in
  // Vectorize. Inline chunks use the same deterministic current-hash IDs. Rank
  // the two sources together, deduplicate those IDs, then apply the exact same
  // logical candidate budget used after the note becomes fully indexed.
  const rawIndexedUsed = selectTopChunkHits(config.chunkTopK, indexed.rawHits);
  const expandedIndexedUsed = selectTopChunkHits(config.chunkTopK, indexed.expandedHits);
  const rawCombined = selectTopChunkHits(config.chunkTopK, indexed.rawHits, pending.rawHits);
  const expandedCombined = selectTopChunkHits(
    config.chunkTopK,
    indexed.expandedHits,
    pending.expandedHits,
  );
  const primary = aggregateChunkHits(rawCombined, config.aggregation);
  const consensus = queryVectors.expanded === null
    ? null
    : appendShortQueryConsensus(primary, rawCombined, expandedCombined, {
      rawMinCosine: config.shortQueryRescue.rawMinCosine,
      expandedMinCosine: config.shortQueryRescue.expandedMinCosine,
      relativeMinRatio: config.aggregation.relativeMinRatio,
      maxMatchesPerNote: config.aggregation.maxMatchesPerNote,
      topK: config.aggregation.topK,
    });
  const aggregation = consensus?.aggregation ?? primary;
  const emptyDiagnostics: ShortQueryConsensusDiagnostics = {
    rawFloor: config.shortQueryRescue.rawMinCosine,
    expandedFloor: config.shortQueryRescue.expandedMinCosine,
    consensusChunkCount: 0,
    candidateNoteCount: 0,
    addedNoteCount: 0,
    enrichedNoteCount: 0,
  };

  return {
    queryVector: queryVectors.raw,
    hits: rawCombined,
    aggregation,
    indexedCandidateCount: indexed.rawMatches.length,
    resolvedCandidateCount: indexed.rawHits.length,
    indexedUsedCandidateCount: rawIndexedUsed.length,
    usedCandidateCount: rawCombined.length,
    expandedIndexedCandidateCount: indexed.expandedMatches.length,
    expandedResolvedCandidateCount: indexed.expandedHits.length,
    expandedIndexedUsedCandidateCount: expandedIndexedUsed.length,
    expandedUsedCandidateCount: expandedCombined.length,
    pendingNoteCount: pending.pendingNoteCount,
    pendingNotesScored: pending.scoredNoteCount,
    pendingFallback: {
      attempted: pending.attempted,
      degraded: pending.degraded,
    },
    shortQueryRescue: {
      eligible: queryVectors.expanded !== null,
      attempted: queryVectors.expanded !== null,
      applied: queryVectors.expanded !== null &&
        (!indexed.expandedVectorizeFailed || pending.expandedHits.length > 0),
      expandedIndexAvailable: queryVectors.expanded !== null &&
        !indexed.expandedVectorizeFailed,
      expandedVectorizeFailed: indexed.expandedVectorizeFailed,
      ...(consensus?.diagnostics ?? emptyDiagnostics),
    },
    timings: {
      embeddingMs,
      vectorMs: indexed.vectorMs,
      resolveMs: indexed.resolveMs,
      pendingMs,
    },
  };
}

export function toSearchMatch(hit: ChunkHit): SearchMatch {
  return {
    kind: hit.kind,
    lineNumber: hit.primaryLine,
    rawLineIndex: hit.primaryLine === null ? null : hit.primaryLine - 1,
    lineStart: hit.lineStart,
    lineEnd: hit.lineEnd,
    charStart: hit.charStart,
    charEnd: hit.charEnd,
    score: hit.score,
    text: hit.text ?? "",
  };
}
