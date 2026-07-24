import { hydrateNotes } from "./db";
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

interface RerankerResultLike {
  id?: unknown;
  score?: unknown;
}

interface SemanticNoteExcerpt {
  id: string;
  title: string;
  body_excerpt: string;
  migration_target?: number;
}

interface RerankedNote {
  note: SemanticNoteExcerpt;
  score: number;
}

const RERANKER_MODEL = "@cf/baai/bge-reranker-base";
const DEFAULT_RERANKER_BODY_EXCERPT_CHARS = 1_200;
const MAX_RERANKER_BODY_EXCERPT_CHARS = 4_000;

function rerankerMinimumScore(context: RequestContext): number {
  const raw = context.env.RERANKER_MIN_SCORE ?? "0.05";
  const configured = Number(raw.trim());
  if (raw.trim() === "" || !Number.isFinite(configured)) {
    throw new AppError(
      500,
      "INVALID_RERANKER_CONFIGURATION",
      "RERANKER_MIN_SCORE must be a finite number.",
    );
  }
  return configured;
}

function rerankerBodyExcerptChars(context: RequestContext): number {
  const raw = context.env.RERANKER_BODY_EXCERPT_CHARS ?? String(DEFAULT_RERANKER_BODY_EXCERPT_CHARS);
  const configured = Number(raw.trim());
  if (
    raw.trim() === "" ||
    !Number.isInteger(configured) ||
    configured < 1 ||
    configured > MAX_RERANKER_BODY_EXCERPT_CHARS
  ) {
    throw new AppError(
      500,
      "INVALID_RERANKER_CONFIGURATION",
      `RERANKER_BODY_EXCERPT_CHARS must be an integer between 1 and ${MAX_RERANKER_BODY_EXCERPT_CHARS}.`,
    );
  }
  return configured;
}

function rerankerNoteText(note: SemanticNoteExcerpt): string {
  const title = note.title.trim() || "无标题";
  const bodyExcerpt = note.body_excerpt.trim();
  return bodyExcerpt ? `${title}\n\n${bodyExcerpt}` : title;
}

async function rerankNotes(
  context: RequestContext,
  query: string,
  notes: SemanticNoteExcerpt[],
  limit: number,
): Promise<RerankedNote[]> {
  if (notes.length === 0) return [];

  let output: unknown;
  try {
    output = await context.env.AI.run(RERANKER_MODEL, {
      query,
      contexts: notes.map((note) => ({
        text: rerankerNoteText(note),
      })),
      top_k: Math.min(limit, notes.length),
    });
  } catch (error) {
    console.error("Workers AI reranker request failed", context.requestId, error);
    throw new AppError(
      503,
      "RERANKER_UNAVAILABLE",
      "Workers AI could not compare the current notes for semantic search.",
    );
  }

  const response = output && typeof output === "object"
    ? (output as { response?: unknown }).response
    : undefined;
  if (!Array.isArray(response)) {
    throw new AppError(
      502,
      "INVALID_RERANKER_RESPONSE",
      "Workers AI returned an invalid reranker response.",
    );
  }

  const seenContextIds = new Set<number>();
  const ranked: RerankedNote[] = [];
  for (const value of response) {
    if (!value || typeof value !== "object") {
      throw new AppError(
        502,
        "INVALID_RERANKER_RESPONSE",
        "Workers AI returned an invalid reranker result.",
      );
    }
    const result = value as RerankerResultLike;
    const id = result.id;
    const score = result.score;
    if (
      typeof id !== "number" ||
      !Number.isInteger(id) ||
      id < 0 ||
      id >= notes.length ||
      seenContextIds.has(id) ||
      typeof score !== "number" ||
      !Number.isFinite(score)
    ) {
      throw new AppError(
        502,
        "INVALID_RERANKER_RESPONSE",
        "Workers AI returned an invalid reranker result.",
      );
    }
    seenContextIds.add(id);
    ranked.push({ note: notes[id], score });
  }

  // Never depend on the model response order or the D1 input order for ties.
  return ranked.sort(
    (left, right) => right.score - left.score || left.note.id.localeCompare(right.note.id),
  );
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
  // SEMANTIC_TOP_K is the instance owner's response-size ceiling. Older
  // clients request 30 results unconditionally, so keep the hard maximum.
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

  const minimumScore = rerankerMinimumScore(context);
  const bodyExcerptCharacters = rerankerBodyExcerptChars(context);
  const noteScanStartedAt = performance.now();
  const noteResult = await context.env.DB.prepare(
    `SELECT id, title, substr(body, 1, ?) AS body_excerpt
     FROM notes
     WHERE deleted_at IS NULL
     ORDER BY id ASC`,
  )
    .bind(bodyExcerptCharacters)
    .all<SemanticNoteExcerpt>();
  const noteScanDuration = performance.now() - noteScanStartedAt;

  const rerankerStartedAt = performance.now();
  const rankedNotes = await rerankNotes(
    context,
    query,
    noteResult.results,
    limit,
  );
  const rerankerDuration = performance.now() - rerankerStartedAt;
  const selectedNotes = rankedNotes
    .filter((note) => note.score >= minimumScore)
    .slice(0, limit);
  const scores = new Map(selectedNotes.map((note) => [note.note.id, note.score]));

  // Re-read and hydrate only notes that survived reranking. A concurrent
  // deletion naturally removes the note from the response.
  const hydrationStartedAt = performance.now();
  const selectedIds = selectedNotes.map((note) => note.note.id);
  const selectedRows = selectedIds.length === 0
    ? []
    : (await context.env.DB.prepare(
      `SELECT * FROM notes
       WHERE deleted_at IS NULL
         AND id IN (${selectedIds.map(() => "?").join(",")})`,
    )
      .bind(...selectedIds)
      .all<NoteRow>()).results;
  const selectedRowsById = new Map(selectedRows.map((row) => [row.id, row]));
  const notes = await hydrateNotes(
    context.env,
    selectedIds
      .map((id) => selectedRowsById.get(id))
      .filter((row): row is NoteRow => row !== undefined),
  );
  const hydrationDuration = performance.now() - hydrationStartedAt;
  const results: SearchResult[] = notes.map((note) => ({
    ...note,
    matchType: "semantic",
    score: scores.get(note.id) ?? null,
  }));
  return json({
    query,
    strategy: "semantic-fallback",
    rankingStrategy: "direct-bge-reranker",
    comparisonScope: "all-current-non-deleted-notes",
    rerankerModel: RERANKER_MODEL,
    rerankerMinimumScore: minimumScore,
    bodyExcerptCharacters,
    topK: limit,
    comparedNoteCount: noteResult.results.length,
    scoredNoteCount: rankedNotes.length,
    matchedNoteCount: selectedNotes.length,
    topRerankerScore: rankedNotes[0]?.score ?? null,
    results,
  }, 200, {
    "server-timing": semanticServerTiming(
      noteScanDuration,
      rerankerDuration,
      hydrationDuration,
      performance.now() - startedAt,
    ),
  });
}

function semanticServerTiming(
  notes: number,
  reranker: number,
  hydrate: number,
  total: number,
): string {
  return [
    `notes;dur=${notes.toFixed(1)}`,
    `reranker;dur=${reranker.toFixed(1)}`,
    `hydrate;dur=${hydrate.toFixed(1)}`,
    `total;dur=${total.toFixed(1)}`,
  ].join(", ");
}

export async function searchIndexStatus(context: RequestContext): Promise<Response> {
  requirePrincipal(context);
  const noteCount = await context.env.DB.prepare(
    "SELECT COUNT(*) AS count FROM notes WHERE deleted_at IS NULL",
  ).first<{ count: number }>();

  return json({
    strategy: "direct-bge-reranker",
    comparisonScope: "all-current-non-deleted-notes",
    rerankerModel: RERANKER_MODEL,
    rerankerMinimumScore: rerankerMinimumScore(context),
    bodyExcerptCharacters: rerankerBodyExcerptChars(context),
    topK: semanticTopK(context, undefined),
    currentNoteCount: noteCount?.count ?? 0,
  });
}

export async function migrateRerankerDiagnostic(context: RequestContext): Promise<Response> {
  requirePrincipal(context);
  const bodyExcerptCharacters = rerankerBodyExcerptChars(context);
  const notes = (await context.env.DB.prepare(
    `SELECT
       id,
       title,
       substr(body, 1, ?) AS body_excerpt,
       CASE
         WHEN instr(title, '迁移') > 0 OR instr(body, '迁移') > 0 THEN 1
         ELSE 0
       END AS migration_target
     FROM notes
     WHERE deleted_at IS NULL
     ORDER BY id ASC`,
  )
    .bind(bodyExcerptCharacters)
    .all<SemanticNoteExcerpt>()).results;
  const migrationTargets = notes.filter((note) => note.migration_target === 1);
  const normalRanking = await rerankNotes(context, "migrate", notes, Math.min(notes.length, 8));
  const targetRanking = await rerankNotes(
    context,
    "migrate",
    migrationTargets,
    Math.min(migrationTargets.length, 8),
  );

  return json({
    query: "migrate",
    rerankerModel: RERANKER_MODEL,
    configuredThreshold: rerankerMinimumScore(context),
    bodyExcerptCharacters,
    comparedNoteCount: notes.length,
    migrationTargetCount: migrationTargets.length,
    normalTopScores: normalRanking.map((result) => result.score),
    migrationTargetsInNormalTopK: normalRanking.filter(
      (result) => result.note.migration_target === 1,
    ).length,
    migrationTargetScores: targetRanking.map((result) => result.score),
  });
}
