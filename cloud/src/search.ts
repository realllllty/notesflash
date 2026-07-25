import { hydrateNotes } from "./db";
import {
  aiSearchConfig,
  aiSearchInstance,
  searchAiSearchNotes,
  type AiSearchRuntimeConfig,
} from "./ai-search";
import { AppError, json, readJson, requirePrincipal, requireString } from "./http";
import { retrieveSemanticMatches, toSearchMatch, type SemanticRetrieval } from "./semantic";
import { semanticConfig, type SemanticConfig } from "./semantic-config";
import { refineSpans } from "./span-refine";
import type { NoteRow, RequestContext, SearchResult } from "./types";

function searchLimit(value: string | null, fallback = 30): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) ? Math.min(Math.max(parsed, 1), 100) : fallback;
}

function ftsPhrase(query: string): string {
  return `"${query.replace(/"/g, '""')}"`;
}

export async function lexicalSearch(context: RequestContext): Promise<Response> {
  requirePrincipal(context);
  const query = requireString(context.url.searchParams.get("q") ?? "", "q", {
    min: 1,
    max: 500,
  }).trim();
  const limit = searchLimit(context.url.searchParams.get("limit"));
  let rows: NoteRow[];
  let engine: "fts5-trigram" | "instr-fallback" = "instr-fallback";

  if ([...query].length >= 3) {
    try {
      const result = await context.env.DB.prepare(
        `SELECT n.*
         FROM notes_fts f
         JOIN notes n ON n.rowid = f.rowid
         WHERE notes_fts MATCH ? AND n.deleted_at IS NULL
         ORDER BY n.pinned DESC, bm25(notes_fts) ASC, n.updated_at DESC
         LIMIT ?`,
      )
        .bind(ftsPhrase(query), limit)
        .all<NoteRow>();
      rows = result.results;
      engine = "fts5-trigram";
    } catch (error) {
      console.warn("FTS search failed; using instr fallback", context.requestId, error);
      rows = await fallbackCharacterSearch(context, query, limit);
    }
  } else {
    rows = await fallbackCharacterSearch(context, query, limit);
  }

  const notes = await hydrateNotes(context.env, rows);
  const results: SearchResult[] = notes.map((note, index) => ({
    ...note,
    matchType: "lexical",
    score: 1 / (index + 1),
  }));
  return json({ query, engine, results });
}

async function fallbackCharacterSearch(
  context: RequestContext,
  query: string,
  limit: number,
): Promise<NoteRow[]> {
  const result = await context.env.DB.prepare(
    `SELECT * FROM notes
     WHERE deleted_at IS NULL
       AND (instr(lower(title), lower(?)) > 0 OR instr(lower(body), lower(?)) > 0)
     ORDER BY
       pinned DESC,
       CASE
         WHEN lower(title) = lower(?) THEN 0
         WHEN instr(lower(title), lower(?)) = 1 THEN 1
         WHEN instr(lower(title), lower(?)) > 0 THEN 2
         ELSE 3
       END,
       updated_at DESC
     LIMIT ?`,
  )
    .bind(query, query, query, query, query, limit)
    .all<NoteRow>();
  return result.results;
}

interface SemanticBody {
  query?: unknown;
  limit?: unknown;
  fallbackOnly?: unknown;
}

async function hasLiteralMatch(context: RequestContext, query: string): Promise<boolean> {
  if ([...query].length >= 3) {
    try {
      const row = await context.env.DB.prepare(
        `SELECT 1 AS found
         FROM notes_fts f
         JOIN notes n ON n.rowid = f.rowid
         WHERE notes_fts MATCH ? AND n.deleted_at IS NULL
         LIMIT 1`,
      )
        .bind(ftsPhrase(query))
        .first<{ found: number }>();
      return row !== null;
    } catch (error) {
      console.warn("FTS semantic fallback preflight failed; using instr", context.requestId, error);
    }
  }

  const row = await context.env.DB.prepare(
    `SELECT 1 AS found FROM notes
     WHERE deleted_at IS NULL
       AND (instr(lower(title), lower(?)) > 0 OR instr(lower(body), lower(?)) > 0)
     LIMIT 1`,
  )
    .bind(query, query)
    .first<{ found: number }>();
  return row !== null;
}

function requestedNoteLimit(requested: unknown, configured: number): number {
  if (requested === undefined) return configured;
  if (typeof requested !== "number" || !Number.isInteger(requested) || requested < 1) {
    throw new AppError(400, "INVALID_INPUT", "limit must be a positive integer.");
  }
  // SEMANTIC_TOP_K is the instance owner's response-size ceiling. Older clients
  // request 30 results unconditionally, so keep the hard maximum.
  return Math.min(requested, configured);
}

export async function semanticSearch(context: RequestContext): Promise<Response> {
  requirePrincipal(context);
  const body = await readJson<SemanticBody>(context.request);
  const query = requireString(body.query, "query", { min: 1, max: 2000 }).trim();
  if (body.fallbackOnly !== undefined && typeof body.fallbackOnly !== "boolean") {
    throw new AppError(400, "INVALID_INPUT", "fallbackOnly must be a boolean.");
  }
  const backendConfig = aiSearchConfig(context.env);
  const baseConfig = backendConfig.backend === "vectorize"
    ? semanticConfig(context.env)
    : null;
  const configuredTopK = baseConfig?.aggregation.topK ?? backendConfig.topK;
  const topK = requestedNoteLimit(body.limit, configuredTopK);
  const startedAt = performance.now();

  // Literal matches are faster, deterministic, and easier to explain. This
  // guard also protects old clients that still start lexical and semantic
  // requests concurrently: Workers AI is never called when exact recall is
  // already sufficient.
  // `fallbackOnly` is retained as a deprecated wire-compatibility field. Both
  // boolean values now obey the same hard lexical-first invariant: no caller
  // may use the public semantic endpoint to bypass literal recall.
  if (await hasLiteralMatch(context, query)) {
    return json(
      {
        query,
        strategy: "lexical-first",
        backend: backendConfig.backend === "ai-search"
          ? "cloudflare-ai-search"
          : "legacy-vectorize",
        semanticBackend: backendConfig.backend === "ai-search"
          ? "ai-search"
          : "legacy-vectorize",
        semanticSkipped: true,
        reason: "literal-match-exists",
        topK,
        results: [],
      },
      200,
      { "server-timing": `total;dur=${(performance.now() - startedAt).toFixed(1)}` },
    );
  }

  if (backendConfig.backend === "ai-search") {
    const retrieval = await searchAiSearchNotes(context.env, query, topK);
    const normalizeQuery = (value: string) => value.normalize("NFKC").trim().toLocaleLowerCase();
    const providerQueryAdjusted = retrieval.providerSearchQuery.length > 0 &&
      normalizeQuery(retrieval.providerSearchQuery) !== normalizeQuery(retrieval.effectiveQuery);

    return json({
      query,
      strategy: "semantic-fallback",
      backend: "cloudflare-ai-search",
      semanticBackend: "ai-search",
      rankingStrategy: "cloudflare-ai-search-hybrid-rrf",
      rankingSource: "provider-order",
      comparisonScope: "logical-line-items",
      retrieval: {
        type: "hybrid",
        fusionMethod: "rrf",
        keywordMatchMode: "or",
        reranking: backendConfig.reranking,
      },
      translation: {
        enabled: backendConfig.queryTranslation,
        attempted: retrieval.translationAttempted,
        applied: retrieval.translatedQuery !== null,
        failed: retrieval.translationFailed,
      },
      queryRewrite: {
        configured: backendConfig.queryRewrite,
        enabled: false,
        applied: false,
        reason: "independent-query-not-rewritten",
        providerQueryAdjusted,
      },
      topK,
      providerResultLimit: backendConfig.maxResults,
      candidateItemCount: retrieval.responseChunkCount,
      validatedCandidateItemCount: retrieval.providerCandidateCount,
      providerCandidateDiagnostics: retrieval.providerCandidateDiagnostics,
      resolvedItemCount: retrieval.validItemCount,
      matchedNoteCount: retrieval.matchedNoteCount,
      results: retrieval.results,
    }, 200, {
      "server-timing": aiSearchServerTiming(retrieval.timings, performance.now() - startedAt),
    });
  }

  // The legacy path remains available as an explicit rollback while AI Search
  // is evaluated against the frozen quality suites.
  if (!baseConfig) {
    throw new AppError(500, "INVALID_SEMANTIC_CONFIGURATION", "Semantic search is not configured.");
  }
  const config: SemanticConfig = {
    ...baseConfig,
    aggregation: { ...baseConfig.aggregation, topK },
  };

  const retrieval = await retrieveSemanticMatches(context.env, config, query);
  const selected = retrieval.aggregation.notes;

  // Re-read and hydrate only notes that survived aggregation. A concurrent
  // deletion naturally removes the note from the response. Span refinement is
  // independent of hydration, so the two run together.
  const hydrationStartedAt = performance.now();
  const selectedIds = selected.map((note) => note.noteId);
  const [selectedRows, refinement] = await Promise.all([
    selectedIds.length === 0
      ? Promise.resolve([])
      : context.env.DB.prepare(
        `SELECT * FROM notes
         WHERE deleted_at IS NULL
           AND id IN (${selectedIds.map(() => "?").join(",")})`,
      )
        .bind(...selectedIds)
        .all<NoteRow>()
        .then((result) => result.results),
    refineSpans(context.env, config, retrieval.queryVector, selected, config.spanRefine),
  ]);
  const selectedRowsById = new Map(selectedRows.map((row) => [row.id, row]));
  const notes = await hydrateNotes(
    context.env,
    selectedIds
      .map((id) => selectedRowsById.get(id))
      .filter((row): row is NoteRow => row !== undefined),
  );
  const hydrationMs = performance.now() - hydrationStartedAt;

  const matchesByNote = new Map(selected.map((note) => [note.noteId, note]));
  const results: SearchResult[] = notes.map((note) => {
    const aggregated = matchesByNote.get(note.id);
    return {
      ...note,
      matchType: "semantic",
      score: aggregated?.bestScore ?? null,
      matches: (aggregated?.matches ?? []).map(toSearchMatch),
    };
  });

  return json({
    query,
    strategy: "semantic-fallback",
    backend: "legacy-vectorize",
    semanticBackend: "legacy-vectorize",
    rankingStrategy: "chunk-vector-recall",
    comparisonScope: "line-level-chunks",
    embeddingModel: config.spec.id,
    embeddingDimensions: config.spec.dimensions,
    chunking: config.chunking,
    minCosine: config.aggregation.minCosine,
    relativeMinRatio: config.aggregation.relativeMinRatio,
    effectiveFloor: retrieval.aggregation.effectiveFloor,
    topK,
    chunkTopK: config.chunkTopK,
    candidateChunkCount: retrieval.indexedCandidateCount,
    resolvedChunkCount: retrieval.resolvedCandidateCount,
    indexedUsedChunkCount: retrieval.indexedUsedCandidateCount,
    usedChunkCount: retrieval.usedCandidateCount,
    expandedCandidateChunkCount: retrieval.expandedIndexedCandidateCount,
    expandedResolvedChunkCount: retrieval.expandedResolvedCandidateCount,
    expandedIndexedUsedChunkCount: retrieval.expandedIndexedUsedCandidateCount,
    expandedUsedChunkCount: retrieval.expandedUsedCandidateCount,
    matchedChunkCount: retrieval.aggregation.matchedChunkCount,
    matchedNoteCount: selected.length,
    topChunkScore: retrieval.aggregation.topChunkScore,
    shortQueryRescue: {
      mode: "same-chunk-consensus",
      enabled: config.shortQueryRescue.enabled,
      ...retrieval.shortQueryRescue,
    },
    pendingIndexCount: retrieval.pendingNoteCount,
    pendingNotesScored: retrieval.pendingNotesScored,
    pendingFallback: retrieval.pendingFallback,
    spanRefinement: config.spanRefine.enabled
      ? {
        refinedMatchCount: refinement.refinedCount,
        candidateCount: refinement.candidateCount,
        aiCalls: refinement.aiCalls,
      }
      : null,
    results,
  }, 200, {
    "server-timing": semanticServerTiming(
      retrieval,
      hydrationMs,
      refinement.durationMs,
      performance.now() - startedAt,
    ),
  });
}

function aiSearchServerTiming(
  timings: {
    translationMs: number;
    searchMs: number;
    resolveMs: number;
    hydrateMs: number;
    totalMs: number;
  },
  total: number,
): string {
  return [
    `translation;dur=${timings.translationMs.toFixed(1)}`,
    `ai-search;dur=${timings.searchMs.toFixed(1)}`,
    `resolve;dur=${timings.resolveMs.toFixed(1)}`,
    `hydrate;dur=${timings.hydrateMs.toFixed(1)}`,
    `adapter;dur=${timings.totalMs.toFixed(1)}`,
    `total;dur=${total.toFixed(1)}`,
  ].join(", ");
}

function semanticServerTiming(
  retrieval: SemanticRetrieval,
  hydrate: number,
  refine: number,
  total: number,
): string {
  return [
    `embedding;dur=${retrieval.timings.embeddingMs.toFixed(1)}`,
    `vector;dur=${retrieval.timings.vectorMs.toFixed(1)}`,
    `resolve;dur=${retrieval.timings.resolveMs.toFixed(1)}`,
    `pending;dur=${retrieval.timings.pendingMs.toFixed(1)}`,
    `refine;dur=${refine.toFixed(1)}`,
    `hydrate;dur=${hydrate.toFixed(1)}`,
    `total;dur=${total.toFixed(1)}`,
  ].join(", ");
}

export async function searchIndexStatus(context: RequestContext): Promise<Response> {
  requirePrincipal(context);
  const backendConfig = aiSearchConfig(context.env);
  if (backendConfig.backend === "ai-search") {
    return aiSearchIndexStatus(context, backendConfig);
  }

  const config = semanticConfig(context.env);
  const noteCounts = await context.env.DB.prepare(
    `SELECT
       COUNT(*) AS notes,
       SUM(CASE WHEN embedding_status = 'ready' THEN 1 ELSE 0 END) AS ready,
       SUM(CASE WHEN embedding_status = 'pending' THEN 1 ELSE 0 END) AS pending,
       SUM(CASE WHEN embedding_status = 'failed' THEN 1 ELSE 0 END) AS failed
     FROM notes WHERE deleted_at IS NULL`,
  ).first<{ notes: number; ready: number | null; pending: number | null; failed: number | null }>();
  const chunkCount = await context.env.DB.prepare(
    `SELECT COUNT(*) AS count
     FROM note_chunks c
     JOIN notes n ON n.id = c.note_id
     WHERE n.deleted_at IS NULL AND n.content_hash = c.content_hash`,
  ).first<{ count: number }>();

  let indexedVectorCount: number | null = null;
  let indexError: string | null = null;
  try {
    const details = await context.env.CHUNK_INDEX.describe() as unknown as Record<string, unknown>;
    const count = typeof details.vectorCount === "number"
      ? details.vectorCount
      : typeof details.vectorsCount === "number"
      ? details.vectorsCount
      : null;
    indexedVectorCount = count;
  } catch (error) {
    indexError = error instanceof Error ? error.name : "UNKNOWN_ERROR";
  }

  return json({
    backend: "legacy-vectorize",
    semanticBackend: "legacy-vectorize",
    strategy: "chunk-vector-recall",
    comparisonScope: "line-level-chunks",
    embeddingModel: config.spec.id,
    embeddingDimensions: config.spec.dimensions,
    chunking: config.chunking,
    minCosine: config.aggregation.minCosine,
    relativeMinRatio: config.aggregation.relativeMinRatio,
    shortQueryRescue: config.shortQueryRescue,
    chunkTopK: config.chunkTopK,
    topK: config.aggregation.topK,
    currentNoteCount: noteCounts?.notes ?? 0,
    readyNoteCount: noteCounts?.ready ?? 0,
    pendingNoteCount: noteCounts?.pending ?? 0,
    failedNoteCount: noteCounts?.failed ?? 0,
    currentChunkCount: chunkCount?.count ?? 0,
    indexedVectorCount,
    indexError,
  });
}

async function aiSearchIndexStatus(
  context: RequestContext,
  config: AiSearchRuntimeConfig,
): Promise<Response> {
  const noteCounts = await context.env.DB.prepare(
    `SELECT
       COUNT(*) AS notes,
       SUM(CASE WHEN ai_search_status = 'ready' THEN 1 ELSE 0 END) AS ready,
       SUM(CASE WHEN ai_search_status IN ('pending', 'processing') THEN 1 ELSE 0 END) AS pending,
       SUM(CASE WHEN ai_search_status = 'failed' THEN 1 ELSE 0 END) AS failed
     FROM notes WHERE deleted_at IS NULL`,
  ).first<{ notes: number; ready: number | null; pending: number | null; failed: number | null }>();
  const itemCounts = await context.env.DB.prepare(
    `SELECT
       COUNT(*) AS items,
       SUM(CASE WHEN i.sync_state = 'ready' THEN 1 ELSE 0 END) AS ready,
       SUM(CASE WHEN i.sync_state IN ('pending', 'uploading', 'submitted', 'deleting')
                THEN 1 ELSE 0 END) AS pending,
       SUM(CASE WHEN i.sync_state = 'failed' THEN 1 ELSE 0 END) AS failed
     FROM ai_search_items i
     JOIN notes n ON n.id = i.note_id
     WHERE n.deleted_at IS NULL AND n.content_hash = i.note_content_hash`,
  ).first<{ items: number; ready: number | null; pending: number | null; failed: number | null }>();

  let providerStatus: {
    queued: number | null;
    running: number | null;
    completed: number | null;
    error: number | null;
    skipped: number | null;
    outdated: number | null;
  } | null = null;
  let providerError: string | null = null;
  try {
    const stats = await (await aiSearchInstance(context.env, config)).stats();
    const count = (value: number | undefined): number | null =>
      typeof value === "number" && Number.isFinite(value) ? value : null;
    providerStatus = {
      queued: count(stats.queued),
      running: count(stats.running),
      completed: count(stats.completed),
      error: count(stats.error),
      skipped: count(stats.skipped),
      outdated: count(stats.outdated),
    };
  } catch (error) {
    providerError = error instanceof AppError
      ? error.code
      : error instanceof Error
      ? error.name
      : "UNKNOWN_ERROR";
  }

  return json({
    backend: "cloudflare-ai-search",
    semanticBackend: "ai-search",
    strategy: "cloudflare-ai-search-hybrid-rrf",
    rankingSource: "provider-order",
    comparisonScope: "logical-line-items",
    retrieval: {
      type: "hybrid",
      fusionMethod: "rrf",
      keywordMatchMode: "or",
      reranking: config.reranking,
    },
    translation: { enabled: config.queryTranslation },
    queryRewrite: {
      configured: config.queryRewrite,
      enabled: false,
      reason: "independent-query-not-rewritten",
    },
    topK: config.topK,
    providerResultLimit: config.maxResults,
    currentNoteCount: noteCounts?.notes ?? 0,
    readyNoteCount: noteCounts?.ready ?? 0,
    pendingNoteCount: noteCounts?.pending ?? 0,
    failedNoteCount: noteCounts?.failed ?? 0,
    currentItemCount: itemCounts?.items ?? 0,
    readyItemCount: itemCounts?.ready ?? 0,
    pendingItemCount: itemCounts?.pending ?? 0,
    failedItemCount: itemCounts?.failed ?? 0,
    providerStatus,
    providerError,
  });
}
