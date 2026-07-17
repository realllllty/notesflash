import { hydrateNotes } from "./db";
import { documentText, embedText } from "./embedding";
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

export async function semanticSearch(context: RequestContext): Promise<Response> {
  requirePrincipal(context);
  const body = await readJson<SemanticBody>(context.request);
  const query = requireString(body.query, "query", { min: 1, max: 2000 }).trim();
  const requestedLimit =
    typeof body.limit === "number" && Number.isInteger(body.limit) ? String(body.limit) : null;
  const limit = searchLimit(requestedLimit, 20);

  const vector = await embedText(context.env, documentText(query, ""));
  const queryResult = await context.env.VECTOR_INDEX.query(vector, {
    topK: Math.min(Math.max(limit * 4, 20), 100),
    returnMetadata: "all",
  });
  const matches = (queryResult.matches ?? []) as VectorMatchLike[];
  if (matches.length === 0) return json({ query, results: [] });

  const minimumScore = semanticMinimumScore(context);
  const relevantMatches = matches.filter(
    (match) => typeof match.score === "number" && match.score >= minimumScore,
  );
  if (relevantMatches.length === 0) {
    return json({ query, minimumScore, results: [] });
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
    model: context.env.EMBEDDING_MODEL ?? "@cf/baai/bge-m3",
    minimumScore,
    results,
  });
}

export async function searchIndexStatus(context: RequestContext): Promise<Response> {
  requirePrincipal(context);
  const result = await context.env.DB.prepare(
    `SELECT embedding_status AS status, COUNT(*) AS count
     FROM notes WHERE deleted_at IS NULL GROUP BY embedding_status`,
  ).all<{ status: string; count: number }>();
  return json({
    model: context.env.EMBEDDING_MODEL ?? "@cf/baai/bge-m3",
    dimensions: Number.parseInt(context.env.EMBEDDING_DIMENSIONS ?? "1024", 10),
    minimumScore: semanticMinimumScore(context),
    counts: Object.fromEntries(result.results.map((row) => [row.status, row.count])),
  });
}
