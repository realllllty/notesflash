import { hydrateNotes } from "./db";
import { embedQuery } from "./embedding";
import { AppError, json, readJson, requirePrincipal, requireString } from "./http";
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

interface VectorMatchLike {
  id: string;
  score?: number;
  metadata?: Record<string, unknown>;
}

function semanticMinimumScore(context: RequestContext): number {
  const configured = Number.parseFloat(context.env.SEMANTIC_MIN_SCORE ?? "0.45");
  if (!Number.isFinite(configured)) return 0.45;
  return Math.min(Math.max(configured, -1), 1);
}

function semanticTopK(context: RequestContext, requested: unknown): number {
  const configuredValue = Number.parseInt(context.env.SEMANTIC_TOP_K ?? "8", 10);
  const configured = Number.isFinite(configuredValue)
    ? Math.min(Math.max(configuredValue, 1), 8)
    : 8;
  if (requested === undefined) return configured;
  if (typeof requested !== "number" || !Number.isInteger(requested) || requested < 1) {
    throw new AppError(400, "INVALID_INPUT", "limit must be a positive integer.");
  }
  // SEMANTIC_TOP_K is the instance owner's recall/cost ceiling. Older clients
  // used to request 30 results unconditionally, so clamp rather than allowing
  // them to turn every keystroke into a 100-candidate Vectorize query.
  return Math.min(requested, configured);
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

export async function semanticSearch(context: RequestContext): Promise<Response> {
  requirePrincipal(context);
  const body = await readJson<SemanticBody>(context.request);
  const query = requireString(body.query, "query", { min: 1, max: 2000 }).trim();
  if (body.fallbackOnly !== undefined && typeof body.fallbackOnly !== "boolean") {
    throw new AppError(400, "INVALID_INPUT", "fallbackOnly must be a boolean.");
  }
  const fallbackOnly = body.fallbackOnly !== false;
  const limit = semanticTopK(context, body.limit);
  const startedAt = performance.now();

  // Literal matches are faster, deterministic, and easier to explain. This
  // guard also protects old clients that still start lexical and semantic
  // requests concurrently: Workers AI is never called when exact recall is
  // already sufficient.
  if (fallbackOnly && await hasLiteralMatch(context, query)) {
    return json(
      {
        query,
        strategy: "lexical-first",
        semanticSkipped: true,
        reason: "literal-match-exists",
        topK: limit,
        results: [],
      },
      200,
      { "server-timing": `total;dur=${(performance.now() - startedAt).toFixed(1)}` },
    );
  }

  const embeddingStartedAt = performance.now();
  const vector = await embedQuery(context.env, query);
  const embeddingDuration = performance.now() - embeddingStartedAt;
  const vectorStartedAt = performance.now();
  const candidateTopK = Math.min(Math.max(limit * 2, 12), 50);
  let queryResult: VectorizeMatches;
  try {
    queryResult = await context.env.VECTOR_INDEX.query(vector, {
      topK: candidateTopK,
      // IDs and scores are sufficient because D1 is the source of truth. "all"
      // metadata forces an additional Vectorize fetch and materially slows the
      // hot search path.
      returnMetadata: "none",
    });
  } catch (error) {
    console.error("Vectorize semantic query failed", context.requestId, error);
    throw new AppError(
      503,
      "VECTOR_SEARCH_UNAVAILABLE",
      "Vectorize could not complete the semantic search.",
    );
  }
  const vectorDuration = performance.now() - vectorStartedAt;
  const matches = (queryResult.matches ?? []) as VectorMatchLike[];
  const topCandidateScore = matches.find((match) => typeof match.score === "number")?.score ?? null;
  if (matches.length === 0) {
    return json(
      {
        query,
        strategy: "semantic-fallback",
        topK: limit,
        candidateCount: 0,
        topCandidateScore,
        results: [],
      },
      200,
      {
        "server-timing": semanticServerTiming(
          embeddingDuration,
          vectorDuration,
          performance.now() - startedAt,
        ),
      },
    );
  }

  const minimumScore = semanticMinimumScore(context);
  const relevantMatches = matches.filter(
    (match) => typeof match.score === "number" && match.score >= minimumScore,
  );
  if (relevantMatches.length === 0) {
    return json(
      {
        query,
        strategy: "semantic-fallback",
        topK: limit,
        candidateCount: matches.length,
        topCandidateScore,
        minimumScore,
        results: [],
      },
      200,
      {
        "server-timing": semanticServerTiming(
          embeddingDuration,
          vectorDuration,
          performance.now() - startedAt,
        ),
      },
    );
  }

  const orderedVectorIds = relevantMatches.map((match) => match.id);
  const placeholders = orderedVectorIds.map(() => "?").join(",");
  const rows = await context.env.DB.prepare(
    `SELECT * FROM notes
     WHERE deleted_at IS NULL
       AND embedding_model = ?
       AND embedded_content_hash = content_hash
       AND embedding_vector_id IN (${placeholders})`,
  )
    .bind(context.env.EMBEDDING_MODEL ?? "@cf/baai/bge-m3", ...orderedVectorIds)
    .all<NoteRow>();

  const rowByVectorId = new Map(
    rows.results
      .filter((row) => row.embedding_vector_id)
      .map((row) => [row.embedding_vector_id as string, row]),
  );
  const validRows: NoteRow[] = [];
  const scores = new Map<string, number>();
  for (const match of relevantMatches) {
    const row = rowByVectorId.get(match.id);
    if (!row || scores.has(row.id)) continue;
    validRows.push(row);
    scores.set(row.id, typeof match.score === "number" ? match.score : 0);
    if (validRows.length >= limit) break;
  }

  const notes = await hydrateNotes(context.env, validRows);
  const results: SearchResult[] = notes.map((note) => ({
    ...note,
    matchType: "semantic",
    score: scores.get(note.id) ?? null,
  }));
  return json({
    query,
    strategy: "semantic-fallback",
    model: context.env.EMBEDDING_MODEL ?? "@cf/baai/bge-m3",
    topK: limit,
    candidateCount: matches.length,
    topCandidateScore,
    minimumScore,
    results,
  }, 200, {
    "server-timing": semanticServerTiming(
      embeddingDuration,
      vectorDuration,
      performance.now() - startedAt,
    ),
  });
}

function semanticServerTiming(embedding: number, vector: number, total: number): string {
  return [
    `embedding;dur=${embedding.toFixed(1)}`,
    `vector;dur=${vector.toFixed(1)}`,
    `total;dur=${total.toFixed(1)}`,
  ].join(", ");
}

export async function searchIndexStatus(context: RequestContext): Promise<Response> {
  requirePrincipal(context);
  const model = context.env.EMBEDDING_MODEL ?? "@cf/baai/bge-m3";
  const configuredDimensions = Number.parseInt(context.env.EMBEDDING_DIMENSIONS ?? "1024", 10);
  const [result, coverage, failures, vectorize] = await Promise.all([
    context.env.DB.prepare(
      `SELECT embedding_status AS status, COUNT(*) AS count
       FROM notes WHERE deleted_at IS NULL GROUP BY embedding_status`,
    ).all<{ status: string; count: number }>(),
    context.env.DB.prepare(
      `SELECT
         COUNT(*) AS total,
         SUM(CASE WHEN
           embedding_status = 'ready'
           AND embedding_model = ?
           AND embedded_content_hash = content_hash
           AND embedding_vector_id IS NOT NULL
         THEN 1 ELSE 0 END) AS current_ready,
         SUM(CASE WHEN
           embedding_status = 'ready'
           AND (
             embedding_model IS NULL OR embedding_model != ?
             OR embedded_content_hash IS NULL OR embedded_content_hash != content_hash
             OR embedding_vector_id IS NULL
           )
         THEN 1 ELSE 0 END) AS stale_ready
       FROM notes WHERE deleted_at IS NULL`,
    )
      .bind(model, model)
      .first<{ total: number; current_ready: number; stale_ready: number }>(),
    context.env.DB.prepare(
      `SELECT COALESCE(embedding_error_code, 'UNKNOWN') AS code, COUNT(*) AS count
       FROM notes
       WHERE deleted_at IS NULL AND embedding_status = 'failed'
       GROUP BY COALESCE(embedding_error_code, 'UNKNOWN')
       ORDER BY count DESC
       LIMIT 10`,
    ).all<{ code: string; count: number }>(),
    context.env.VECTOR_INDEX.describe().catch((error: unknown) => {
      console.error("Could not describe Vectorize index", context.requestId, error);
      return null;
    }),
  ]);

  const total = coverage?.total ?? 0;
  const currentReady = coverage?.current_ready ?? 0;
  const staleReady = coverage?.stale_ready ?? 0;
  const vectorizeRecord = vectorize as unknown as Record<string, unknown> | null;
  const actualDimensions = vectorize && "dimensions" in vectorize.config
    ? vectorize.config.dimensions
    : typeof vectorizeRecord?.dimensions === "number"
      ? vectorizeRecord.dimensions
    : null;
  const vectorCount = vectorize
    ? typeof vectorizeRecord?.vectorCount === "number"
      ? vectorizeRecord.vectorCount
      : vectorize.vectorsCount
    : null;
  const metric = vectorize && "metric" in vectorize.config ? vectorize.config.metric : null;
  const suspectedMissingVectors = vectorCount === null
    ? null
    : Math.max(currentReady - vectorCount, 0);

  return json({
    model,
    dimensions: configuredDimensions,
    minimumScore: semanticMinimumScore(context),
    topK: semanticTopK(context, undefined),
    counts: Object.fromEntries(result.results.map((row) => [row.status, row.count])),
    coverage: {
      total,
      currentReady,
      staleReady,
      ratio: total === 0 ? 1 : currentReady / total,
    },
    failures: Object.fromEntries(failures.results.map((row) => [row.code, row.count])),
    vectorize: vectorize
      ? {
          vectorCount,
          dimensions: actualDimensions,
          metric,
          suspectedMissingVectors,
          dimensionMatches: actualDimensions === null || actualDimensions === configuredDimensions,
          metricMatches: metric === null || metric === "cosine",
        }
      : {
          available: false,
          suspectedMissingVectors: null,
        },
  });
}
