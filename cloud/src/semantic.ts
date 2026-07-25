/**
 * Chunk-level semantic retrieval.
 *
 * The query is embedded once and matched against line-anchored chunk vectors in
 * Vectorize, so a result carries the specific line (and character range) that
 * matched instead of a whole-note verdict. Cross-language recall comes from the
 * multilingual embedding space itself: no translation step, no query rewriting.
 *
 * Freshly saved notes are not in the index yet, so their chunks are scored in
 * request as a bounded fallback. That keeps "save then immediately search" from
 * silently returning nothing while the queue catches up.
 */
import { buildNoteChunks } from "./chunking";
import { embedSingle, embedTexts } from "./embedding-models";
import { AppError } from "./http";
import type { SemanticConfig } from "./semantic-config";
import { aggregateChunkHits, cosineSimilarity, type ChunkHit } from "./semantic-core";
import type { Env, NoteChunkRow, SearchMatch } from "./types";

const QUERY_CACHE_TTL_MS = 5 * 60 * 1000;
const QUERY_CACHE_MAX_ENTRIES = 64;
/** Notes still waiting for the indexer that may be scored inside a request. */
const MAX_PENDING_NOTES_INLINE = 12;
const D1_PARAMETER_BATCH = 80;

interface CachedQueryVector {
  expiresAt: number;
  vector: Promise<number[]>;
}

// Workers reuse isolates between requests, so a very small in-memory cache
// removes the embedding round trip when someone retypes or refines a query.
// Deliberately not the Cache API: query text must not reach shared storage.
const queryVectorCache = new Map<string, CachedQueryVector>();

export async function embedSearchQuery(
  env: Env,
  config: SemanticConfig,
  query: string,
): Promise<number[]> {
  const key = `${config.spec.id}\u0000${config.instruction ?? ""}\u0000${query}`;
  const now = Date.now();
  const cached = queryVectorCache.get(key);
  if (cached && cached.expiresAt > now) {
    queryVectorCache.delete(key);
    queryVectorCache.set(key, cached);
    return cached.vector;
  }
  if (cached) queryVectorCache.delete(key);

  const vector = embedSingle(env, config.spec, query, "query", config.instruction);
  const entry: CachedQueryVector = { expiresAt: now + QUERY_CACHE_TTL_MS, vector };
  queryVectorCache.set(key, entry);
  while (queryVectorCache.size > QUERY_CACHE_MAX_ENTRIES) {
    const oldest = queryVectorCache.keys().next().value as string | undefined;
    if (oldest === undefined) break;
    queryVectorCache.delete(oldest);
  }

  try {
    return await vector;
  } catch (error) {
    // Never cache a transient Workers AI failure.
    if (queryVectorCache.get(key) === entry) queryVectorCache.delete(key);
    throw error;
  }
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
    response = await env.CHUNK_INDEX.query(queryVector, {
      topK: config.chunkTopK,
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
  queryVector: number[],
): Promise<{ hits: ChunkHit[]; pendingNoteCount: number; scoredNoteCount: number }> {
  const backlog = await env.DB.prepare(
    `SELECT COUNT(*) AS count FROM notes
     WHERE deleted_at IS NULL AND embedding_status != 'ready'`,
  ).first<{ count: number }>();
  const pendingNoteCount = backlog?.count ?? 0;
  if (pendingNoteCount === 0) {
    return { hits: [], pendingNoteCount: 0, scoredNoteCount: 0 };
  }

  const rows = (await env.DB.prepare(
    `SELECT id, title, body, content_hash FROM notes
     WHERE deleted_at IS NULL AND embedding_status != 'ready'
     ORDER BY updated_at DESC
     LIMIT ?`,
  )
    .bind(MAX_PENDING_NOTES_INLINE)
    .all<PendingNoteRow>()).results;
  if (rows.length === 0) {
    return { hits: [], pendingNoteCount, scoredNoteCount: 0 };
  }

  const chunks = rows.flatMap((row) =>
    buildNoteChunks({ title: row.title, body: row.body }, config.chunking).map((chunk) => ({
      row,
      chunk,
    }))
  );
  if (chunks.length === 0) {
    return { hits: [], pendingNoteCount, scoredNoteCount: rows.length };
  }

  const { vectors } = await embedTexts(
    env,
    config.spec,
    chunks.map((entry) => entry.chunk.embedText),
    "document",
    config.instruction,
  );

  return {
    hits: chunks.map((entry, index) => ({
      noteId: entry.row.id,
      chunkId: `pending:${entry.row.id}:${entry.chunk.chunkIndex}`,
      chunkIndex: entry.chunk.chunkIndex,
      kind: entry.chunk.kind,
      primaryLine: entry.chunk.primaryLine,
      lineStart: entry.chunk.lineStart,
      lineEnd: entry.chunk.lineEnd,
      charStart: entry.chunk.charStart,
      charEnd: entry.chunk.charEnd,
      score: cosineSimilarity(queryVector, vectors[index]),
      text: entry.chunk.text,
    })),
    pendingNoteCount,
    scoredNoteCount: rows.length,
  };
}

export interface SemanticRetrieval {
  queryVector: number[];
  hits: ChunkHit[];
  aggregation: ReturnType<typeof aggregateChunkHits>;
  indexedCandidateCount: number;
  resolvedCandidateCount: number;
  pendingNoteCount: number;
  pendingNotesScored: number;
  timings: {
    embeddingMs: number;
    vectorMs: number;
    resolveMs: number;
    pendingMs: number;
  };
}

/** Full retrieval pass: embed, recall chunks, resolve anchors, aggregate. */
export async function retrieveSemanticMatches(
  env: Env,
  config: SemanticConfig,
  query: string,
): Promise<SemanticRetrieval> {
  const embeddingStartedAt = performance.now();
  const queryVector = await embedSearchQuery(env, config, query);
  const embeddingMs = performance.now() - embeddingStartedAt;

  // Index recall and the freshness fallback are independent once the query is
  // embedded, so they run together instead of adding their latencies.
  const vectorStartedAt = performance.now();
  const [indexed, pending] = await Promise.all([
    (async () => {
      const matches = await queryChunkIndex(env, config, queryVector);
      const vectorMs = performance.now() - vectorStartedAt;
      const resolveStartedAt = performance.now();
      const rows = await loadChunkRows(env, matches.map((match) => match.id));
      const rowById = new Map(rows.map((row) => [row.chunk_id, row]));
      const hits: ChunkHit[] = [];
      for (const match of matches) {
        const row = rowById.get(match.id);
        if (!row) continue;
        hits.push(hitFromChunkRow(row, match.score));
      }
      return { matches, hits, vectorMs, resolveMs: performance.now() - resolveStartedAt };
    })(),
    scorePendingNotes(env, config, queryVector),
  ]);
  const pendingMs = performance.now() - vectorStartedAt;
  const hits = indexed.hits;

  // A note can appear in both sources during re-indexing; keep the stronger hit
  // per chunk anchor so the same line is never counted twice.
  const indexedNoteIds = new Set(hits.map((hit) => hit.noteId));
  const combined = [
    ...hits,
    ...pending.hits.filter((hit) => !indexedNoteIds.has(hit.noteId)),
  ];

  return {
    queryVector,
    hits: combined,
    aggregation: aggregateChunkHits(combined, config.aggregation),
    indexedCandidateCount: indexed.matches.length,
    resolvedCandidateCount: hits.length,
    pendingNoteCount: pending.pendingNoteCount,
    pendingNotesScored: pending.scoredNoteCount,
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
