/**
 * Search lab: an operator-only experiment surface for calibrating semantic
 * search against the instance's real corpus.
 *
 * Why it exists: model choice, chunk shape, and score thresholds cannot be
 * picked from documentation. Workers AI is only reachable from a deployed
 * Worker, so the lab runs candidate strategies in-request (chunk, embed, score)
 * without touching the Vectorize index, which makes a sweep cheap to repeat and
 * safe to run while production search keeps working.
 *
 * Access control (both repositories are public):
 * - `LAB_ENABLED` must be exactly "true".
 * - `LAB_TOKEN_SHA256` holds only the SHA-256 hex of a 32-byte token; the
 *   plaintext never enters the repository.
 * - A paired device Bearer token is also accepted, so the owner can use it
 *   without a separate secret.
 * - Anything else gets the same 404 as an unknown route, so the endpoint does
 *   not advertise itself.
 * - Note text is returned only when the caller explicitly asks for it.
 *
 * Turn `LAB_ENABLED` off (or delete this module) before any public release.
 */
import { authenticate } from "./auth";
import {
  buildNoteChunks,
  DEFAULT_CHUNKING,
  resolveChunkingOptions,
  type ChunkingOptions,
  type NoteChunk,
} from "./chunking";
import { constantTimeEqual, contentHash, newId, sha256Hex } from "./crypto";
import {
  DEFAULT_EMBEDDING_MODEL,
  EMBEDDING_MODELS,
  embedTexts,
  embeddingModelSpec,
  type EmbeddingMode,
  type EmbeddingModelSpec,
} from "./embedding-models";
import { AppError, json, readJson } from "./http";
import { enforceRateLimit } from "./rate-limit";
import { retrieveSemanticMatches } from "./semantic";
import { semanticConfig } from "./semantic-config";
import {
  aggregateChunkHits,
  cosineSimilarity,
  DEFAULT_AGGREGATION,
  resolveAggregationOptions,
  type AggregationOptions,
  type ChunkHit,
} from "./semantic-core";
import type { EmbedNoteJob, Env, RequestContext } from "./types";

/** Seeded evaluation notes are the only rows the lab may create or destroy. */
export const EVAL_TITLE_PREFIX = "[EVAL";

const MAX_STRATEGIES = 4;
const MAX_QUERIES = 6;
const MAX_CORPUS_NOTES = 400;
const MAX_CORPUS_CHARS = 400_000;
const MAX_SEED_NOTES = 200;
const CACHE_LOOKUP_BATCH = 80;
const CACHE_WRITE_BATCH = 20;

function notFound(): AppError {
  // Must be byte-identical to the router's unknown-route error.
  return new AppError(404, "ROUTE_NOT_FOUND", "The requested endpoint does not exist.");
}

export function labConfigured(env: Env): boolean {
  return (env.LAB_ENABLED ?? "").trim() === "true" &&
    (env.LAB_TOKEN_SHA256 ?? "").trim().length === 64;
}

function bearerToken(request: Request): string | null {
  const header = request.headers.get("x-lab-token");
  if (header && header.trim().length > 0) return header.trim();
  const authorization = request.headers.get("authorization") ?? "";
  if (!authorization.toLowerCase().startsWith("bearer ")) return null;
  const token = authorization.slice(7).trim();
  return token.length > 0 ? token : null;
}

type LabActor = "lab-token" | "device";

async function authorizeLab(context: RequestContext): Promise<LabActor> {
  const token = bearerToken(context.request);
  if (token && labConfigured(context.env)) {
    const expected = (context.env.LAB_TOKEN_SHA256 ?? "").trim().toLowerCase();
    const actual = (await sha256Hex(token)).toLowerCase();
    if (constantTimeEqual(expected, actual)) return "lab-token";
  }

  const principal = await authenticate(context.request, context.env);
  if (principal) {
    context.principal = principal;
    return "device";
  }
  throw notFound();
}

interface LabBody {
  action?: unknown;
  query?: unknown;
  queries?: unknown;
  strategies?: unknown;
  includeText?: unknown;
  corpus?: unknown;
  maxNotes?: unknown;
  notes?: unknown;
  enqueue?: unknown;
  pruneCache?: unknown;
  models?: unknown;
  chunking?: unknown;
}

interface CorpusNote {
  id: string;
  ref: string;
  title: string;
  body: string;
  contentHash: string;
}

interface LabStrategy {
  name: string;
  spec: EmbeddingModelSpec;
  instruction?: string;
  chunking: ChunkingOptions;
  aggregation: AggregationOptions;
}

function invalid(message: string): AppError {
  return new AppError(400, "INVALID_INPUT", message);
}

function asRecord(value: unknown, name: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw invalid(`${name} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function parseStrategies(value: unknown): LabStrategy[] {
  const raw = value === undefined ? [{}] : value;
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_STRATEGIES) {
    throw invalid(`strategies must be an array of 1 to ${MAX_STRATEGIES} objects.`);
  }

  return raw.map((item, index) => {
    const record = asRecord(item, `strategies[${index}]`);
    const model = record.model === undefined ? DEFAULT_EMBEDDING_MODEL : record.model;
    if (typeof model !== "string") throw invalid(`strategies[${index}].model must be a string.`);
    const instruction = record.instruction;
    if (instruction !== undefined && typeof instruction !== "string") {
      throw invalid(`strategies[${index}].instruction must be a string.`);
    }
    const name = record.name === undefined ? `${model}#${index}` : record.name;
    if (typeof name !== "string" || name.length === 0 || name.length > 80) {
      throw invalid(`strategies[${index}].name must be a short string.`);
    }

    try {
      return {
        name,
        spec: embeddingModelSpec(model),
        instruction,
        chunking: resolveChunkingOptions(
          record.chunking === undefined
            ? undefined
            : (asRecord(record.chunking, `strategies[${index}].chunking`) as Partial<ChunkingOptions>),
        ),
        aggregation: resolveAggregationOptions(
          record.aggregation === undefined
            ? undefined
            : (asRecord(
              record.aggregation,
              `strategies[${index}].aggregation`,
            ) as Partial<AggregationOptions>),
        ),
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw invalid(`strategies[${index}]: ${error instanceof Error ? error.message : "invalid"}`);
    }
  });
}

function parseQueries(body: LabBody): string[] {
  const list = body.queries === undefined
    ? [body.query]
    : body.queries;
  if (!Array.isArray(list) || list.length === 0 || list.length > MAX_QUERIES) {
    throw invalid(`queries must be an array of 1 to ${MAX_QUERIES} strings.`);
  }
  return list.map((item, index) => {
    if (typeof item !== "string" || item.trim().length === 0 || item.length > 500) {
      throw invalid(`queries[${index}] must be a non-empty string of at most 500 characters.`);
    }
    return item.trim();
  });
}

async function loadCorpus(context: RequestContext, body: LabBody): Promise<CorpusNote[]> {
  const corpus = body.corpus === undefined ? "all" : body.corpus;
  if (corpus !== "all" && corpus !== "eval" && corpus !== "real") {
    throw invalid('corpus must be "all", "eval", or "real".');
  }
  const maxNotes = body.maxNotes === undefined
    ? MAX_CORPUS_NOTES
    : body.maxNotes;
  if (typeof maxNotes !== "number" || !Number.isInteger(maxNotes) || maxNotes < 1 || maxNotes > MAX_CORPUS_NOTES) {
    throw invalid(`maxNotes must be an integer between 1 and ${MAX_CORPUS_NOTES}.`);
  }

  const filter = corpus === "eval"
    ? "AND title LIKE '[EVAL%'"
    : corpus === "real"
    ? "AND title NOT LIKE '[EVAL%'"
    : "";
  const rows = (await context.env.DB.prepare(
    `SELECT id, title, body, content_hash
     FROM notes
     WHERE deleted_at IS NULL ${filter}
     ORDER BY id ASC
     LIMIT ?`,
  )
    .bind(maxNotes)
    .all<{ id: string; title: string; body: string; content_hash: string }>()).results;

  const notes: CorpusNote[] = [];
  let characters = 0;
  for (const row of rows) {
    characters += row.title.length + row.body.length;
    if (characters > MAX_CORPUS_CHARS) break;
    notes.push({
      id: row.id,
      ref: (await sha256Hex(row.id)).slice(0, 10),
      title: row.title,
      body: row.body,
      contentHash: row.content_hash,
    });
  }
  return notes;
}

interface CachedEmbeddings {
  vectors: number[][];
  aiCalls: number;
  cacheHits: number;
  embedded: number;
}

function roundVector(vector: number[]): number[] {
  return vector.map((value) => Math.round(value * 1e6) / 1e6);
}

/**
 * Embed with a D1-backed cache keyed by (model, mode, instruction, text).
 * A repeated sweep over the same corpus then costs no Workers AI calls, which
 * is what makes threshold sweeps practical.
 */
async function embedWithCache(
  context: RequestContext,
  spec: EmbeddingModelSpec,
  texts: string[],
  mode: EmbeddingMode,
  instruction: string | undefined,
): Promise<CachedEmbeddings> {
  const unique = new Map<string, number[]>();
  for (const text of texts) if (!unique.has(text)) unique.set(text, []);
  const uniqueTexts = [...unique.keys()];
  const keys = await Promise.all(
    uniqueTexts.map((text) => sha256Hex(`${spec.id}|${mode}|${instruction ?? ""}|${text}`)),
  );
  const vectorByKey = new Map<string, number[]>();

  for (let offset = 0; offset < keys.length; offset += CACHE_LOOKUP_BATCH) {
    const batch = keys.slice(offset, offset + CACHE_LOOKUP_BATCH);
    const rows = (await context.env.DB.prepare(
      `SELECT cache_key, vector FROM lab_embedding_cache
       WHERE cache_key IN (${batch.map(() => "?").join(",")})`,
    )
      .bind(...batch)
      .all<{ cache_key: string; vector: string }>()).results;
    for (const row of rows) {
      try {
        const parsed: unknown = JSON.parse(row.vector);
        if (Array.isArray(parsed) && parsed.length === spec.dimensions) {
          vectorByKey.set(row.cache_key, parsed as number[]);
        }
      } catch {
        // A corrupt cache row simply re-embeds.
      }
    }
  }

  const missingIndexes = keys
    .map((key, index) => ({ key, index }))
    .filter((entry) => !vectorByKey.has(entry.key));
  let aiCalls = 0;
  if (missingIndexes.length > 0) {
    const result = await embedTexts(
      context.env,
      spec,
      missingIndexes.map((entry) => uniqueTexts[entry.index]),
      mode,
      instruction,
    );
    aiCalls = result.aiCalls;
    const now = Date.now();
    const inserts = missingIndexes.map((entry, position) => {
      const vector = roundVector(result.vectors[position]);
      vectorByKey.set(entry.key, vector);
      return context.env.DB.prepare(
        `INSERT INTO lab_embedding_cache(cache_key, model, mode, dimensions, vector, created_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(cache_key) DO NOTHING`,
      ).bind(entry.key, spec.id, mode, spec.dimensions, JSON.stringify(vector), now);
    });
    for (let offset = 0; offset < inserts.length; offset += CACHE_WRITE_BATCH) {
      await context.env.DB.batch(inserts.slice(offset, offset + CACHE_WRITE_BATCH));
    }
  }

  const byText = new Map<string, number[]>();
  uniqueTexts.forEach((text, index) => {
    const vector = vectorByKey.get(keys[index]);
    if (vector) byText.set(text, vector);
  });

  return {
    vectors: texts.map((text) => byText.get(text) ?? []),
    aiCalls,
    cacheHits: uniqueTexts.length - missingIndexes.length,
    embedded: missingIndexes.length,
  };
}

interface ChunkRecord {
  note: CorpusNote;
  chunk: NoteChunk;
}

function histogram(scores: number[]): Record<string, number> {
  const buckets: Record<string, number> = {};
  for (const score of scores) {
    const bucket = Math.floor(Math.max(0, Math.min(0.999, score)) * 20) / 20;
    const label = bucket.toFixed(2);
    buckets[label] = (buckets[label] ?? 0) + 1;
  }
  return buckets;
}

function percentile(sorted: number[], fraction: number): number | null {
  if (sorted.length === 0) return null;
  const index = Math.min(sorted.length - 1, Math.max(0, Math.round((sorted.length - 1) * fraction)));
  return sorted[index];
}

async function runSweep(context: RequestContext, body: LabBody): Promise<Response> {
  const includeText = body.includeText === true;
  const queries = parseQueries(body);
  const strategies = parseStrategies(body.strategies);
  const startedAt = performance.now();
  const notes = await loadCorpus(context, body);
  const noteById = new Map(notes.map((note) => [note.id, note]));
  const corpusMs = performance.now() - startedAt;

  const strategyReports = [];
  for (const strategy of strategies) {
    const chunkStartedAt = performance.now();
    const records: ChunkRecord[] = [];
    for (const note of notes) {
      for (const chunk of buildNoteChunks(note, strategy.chunking)) {
        records.push({ note, chunk });
      }
    }
    const chunkingMs = performance.now() - chunkStartedAt;

    const embedStartedAt = performance.now();
    const documents = await embedWithCache(
      context,
      strategy.spec,
      records.map((record) => record.chunk.embedText),
      "document",
      strategy.instruction,
    );
    const queryEmbeddings = await embedWithCache(
      context,
      strategy.spec,
      queries,
      "query",
      strategy.instruction,
    );
    const embeddingMs = performance.now() - embedStartedAt;

    const scoreStartedAt = performance.now();
    const queryReports = queries.map((query, queryIndex) => {
      const queryVector = queryEmbeddings.vectors[queryIndex];
      const hits: ChunkHit[] = records.map((record, index) => ({
        noteId: record.note.id,
        chunkId: `${record.note.ref}:${record.chunk.chunkIndex}`,
        chunkIndex: record.chunk.chunkIndex,
        kind: record.chunk.kind,
        primaryLine: record.chunk.primaryLine,
        lineStart: record.chunk.lineStart,
        lineEnd: record.chunk.lineEnd,
        charStart: record.chunk.charStart,
        charEnd: record.chunk.charEnd,
        score: cosineSimilarity(queryVector, documents.vectors[index]),
        text: record.chunk.text,
      }));
      const aggregated = aggregateChunkHits(hits, strategy.aggregation);
      const sortedScores = hits.map((hit) => hit.score).sort((left, right) => left - right);

      return {
        query,
        topChunkScore: aggregated.topChunkScore,
        effectiveFloor: aggregated.effectiveFloor,
        matchedChunkCount: aggregated.matchedChunkCount,
        scoreStats: {
          max: percentile(sortedScores, 1),
          p99: percentile(sortedScores, 0.99),
          p90: percentile(sortedScores, 0.9),
          median: percentile(sortedScores, 0.5),
          min: percentile(sortedScores, 0),
          histogram: histogram(sortedScores),
        },
        // Unfiltered ranking, so a threshold sweep can be replayed offline
        // without paying for embeddings again.
        rankedChunks: hits
          .slice()
          .sort((left, right) => right.score - left.score)
          .slice(0, 20)
          .map((hit) => ({
            noteRef: noteById.get(hit.noteId)?.ref ?? "unknown",
            noteId: includeText ? hit.noteId : undefined,
            title: includeText ? noteById.get(hit.noteId)?.title : undefined,
            kind: hit.kind,
            lineNumber: hit.primaryLine,
            lineStart: hit.lineStart,
            lineEnd: hit.lineEnd,
            charStart: hit.charStart,
            charEnd: hit.charEnd,
            score: hit.score,
            text: includeText ? hit.text : undefined,
          })),
        results: aggregated.notes.map((note, rank) => ({
          rank: rank + 1,
          noteRef: noteById.get(note.noteId)?.ref ?? "unknown",
          noteId: includeText ? note.noteId : undefined,
          title: includeText ? noteById.get(note.noteId)?.title : undefined,
          score: note.score,
          bestScore: note.bestScore,
          matchedChunkCount: note.matchedChunkCount,
          matches: note.matches.map((match) => ({
            kind: match.kind,
            lineNumber: match.primaryLine,
            lineStart: match.lineStart,
            lineEnd: match.lineEnd,
            charStart: match.charStart,
            charEnd: match.charEnd,
            score: match.score,
            text: includeText ? match.text : undefined,
          })),
        })),
      };
    });
    const scoringMs = performance.now() - scoreStartedAt;

    strategyReports.push({
      name: strategy.name,
      model: strategy.spec.id,
      dimensions: strategy.spec.dimensions,
      instruction: strategy.spec.style === "instructed"
        ? strategy.instruction ?? strategy.spec.defaultInstruction
        : null,
      chunking: strategy.chunking,
      aggregation: strategy.aggregation,
      chunkCount: records.length,
      uniqueChunkTexts: new Set(records.map((record) => record.chunk.embedText)).size,
      aiCalls: documents.aiCalls + queryEmbeddings.aiCalls,
      cacheHits: documents.cacheHits + queryEmbeddings.cacheHits,
      embeddedTexts: documents.embedded + queryEmbeddings.embedded,
      timings: {
        chunkingMs: Number(chunkingMs.toFixed(1)),
        embeddingMs: Number(embeddingMs.toFixed(1)),
        scoringMs: Number(scoringMs.toFixed(1)),
      },
      queries: queryReports,
    });
  }

  return json({
    action: "sweep",
    includeText,
    noteCount: notes.length,
    corpusChars: notes.reduce((sum, note) => sum + note.title.length + note.body.length, 0),
    timings: {
      corpusMs: Number(corpusMs.toFixed(1)),
      totalMs: Number((performance.now() - startedAt).toFixed(1)),
    },
    strategies: strategyReports,
  });
}

async function runProbe(context: RequestContext, body: LabBody): Promise<Response> {
  const requested = body.models === undefined ? Object.keys(EMBEDDING_MODELS) : body.models;
  if (!Array.isArray(requested) || requested.length === 0 || requested.length > 6) {
    throw invalid("models must be an array of 1 to 6 model IDs.");
  }

  const zh = "数据迁移需要先清理旧的向量索引";
  const en = "data migration requires clearing the old vector index first";
  const unrelated = "今天午餐吃了牛肉面";
  const probes = [];

  for (const model of requested) {
    if (typeof model !== "string") throw invalid("models must contain strings.");
    const spec = embeddingModelSpec(model);
    const startedAt = performance.now();
    try {
      const documents = await embedTexts(context.env, spec, [zh, en, unrelated], "document");
      const query = await embedTexts(context.env, spec, ["migrate"], "query");
      probes.push({
        model: spec.id,
        ok: true,
        dimensions: documents.vectors[0].length,
        aiCalls: documents.aiCalls + query.aiCalls,
        latencyMs: Number((performance.now() - startedAt).toFixed(1)),
        crossLanguageDocumentSimilarity: cosineSimilarity(documents.vectors[0], documents.vectors[1]),
        queryToChineseDocument: cosineSimilarity(query.vectors[0], documents.vectors[0]),
        queryToEnglishDocument: cosineSimilarity(query.vectors[0], documents.vectors[1]),
        queryToUnrelatedDocument: cosineSimilarity(query.vectors[0], documents.vectors[2]),
      });
    } catch (error) {
      probes.push({
        model: spec.id,
        ok: false,
        latencyMs: Number((performance.now() - startedAt).toFixed(1)),
        error: error instanceof AppError
          ? `${error.code}: ${error.message}`
          : error instanceof Error
          ? error.message
          : "unknown error",
      });
    }
  }

  return json({ action: "probe", probes });
}

async function runCorpusStats(context: RequestContext, body: LabBody): Promise<Response> {
  const chunking = resolveChunkingOptions(
    body.chunking === undefined
      ? undefined
      : (asRecord(body.chunking, "chunking") as Partial<ChunkingOptions>),
  );
  const notes = await loadCorpus(context, { ...body, corpus: body.corpus ?? "all" });
  const statusRows = (await context.env.DB.prepare(
    `SELECT embedding_status AS status, COUNT(*) AS count
     FROM notes WHERE deleted_at IS NULL
     GROUP BY embedding_status`,
  ).all<{ status: string; count: number }>()).results;
  const cacheRow = await context.env.DB.prepare(
    "SELECT COUNT(*) AS count FROM lab_embedding_cache",
  ).first<{ count: number }>();
  const evalRow = await context.env.DB.prepare(
    "SELECT COUNT(*) AS count FROM notes WHERE deleted_at IS NULL AND title LIKE '[EVAL%'",
  ).first<{ count: number }>();

  const lengths: number[] = [];
  let chunkCount = 0;
  let titleChunks = 0;
  for (const note of notes) {
    for (const chunk of buildNoteChunks(note, chunking)) {
      chunkCount += 1;
      if (chunk.kind === "title") titleChunks += 1;
      lengths.push(chunk.text.length);
    }
  }
  lengths.sort((left, right) => left - right);

  return json({
    action: "corpus-stats",
    chunking,
    noteCount: notes.length,
    evalNoteCount: evalRow?.count ?? 0,
    chunkCount,
    titleChunks,
    bodyChunks: chunkCount - titleChunks,
    chunksPerNote: notes.length === 0 ? 0 : Number((chunkCount / notes.length).toFixed(2)),
    chunkChars: {
      min: percentile(lengths, 0),
      median: percentile(lengths, 0.5),
      p90: percentile(lengths, 0.9),
      max: percentile(lengths, 1),
    },
    embeddingStatus: Object.fromEntries(statusRows.map((row) => [row.status, row.count])),
    cachedEmbeddings: cacheRow?.count ?? 0,
  });
}

async function runSeed(context: RequestContext, body: LabBody): Promise<Response> {
  const raw = body.notes;
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_SEED_NOTES) {
    throw invalid(`notes must be an array of 1 to ${MAX_SEED_NOTES} objects.`);
  }
  const enqueue = body.enqueue !== false;

  const parsed = raw.map((item, index) => {
    const record = asRecord(item, `notes[${index}]`);
    const title = record.title;
    const noteBody = record.body ?? "";
    if (typeof title !== "string" || !title.startsWith(EVAL_TITLE_PREFIX) || title.length > 500) {
      throw invalid(`notes[${index}].title must start with "${EVAL_TITLE_PREFIX}".`);
    }
    if (typeof noteBody !== "string" || noteBody.length > 200_000) {
      throw invalid(`notes[${index}].body must be a string of at most 200000 characters.`);
    }
    return { title, body: noteBody };
  });

  const now = Date.now();
  let inserted = 0;
  let replaced = 0;
  const jobs: EmbedNoteJob[] = [];

  for (const note of parsed) {
    // Only ever touches rows whose title carries the eval prefix, so a seed can
    // never overwrite or delete a real note.
    const existing = await context.env.DB.prepare(
      "SELECT id FROM notes WHERE title = ? AND title LIKE '[EVAL%'",
    )
      .bind(note.title)
      .all<{ id: string }>();
    for (const row of existing.results) {
      await context.env.DB.prepare("DELETE FROM notes WHERE id = ? AND title LIKE '[EVAL%'")
        .bind(row.id)
        .run();
      replaced += 1;
    }

    const id = newId();
    const hash = await contentHash(note.title, note.body);
    await context.env.DB.prepare(
      `INSERT INTO notes(id, title, body, version, content_hash, created_at, updated_at, embedding_status)
       VALUES (?, ?, ?, 1, ?, ?, ?, 'pending')`,
    )
      .bind(id, note.title, note.body, hash, now, now)
      .run();
    inserted += 1;
    jobs.push({
      type: "embed-note",
      eventId: newId(),
      noteId: id,
      version: 1,
      contentHash: hash,
      createdAt: now,
    });
  }

  let enqueued = 0;
  if (enqueue) {
    for (let offset = 0; offset < jobs.length; offset += 100) {
      const batch = jobs.slice(offset, offset + 100);
      try {
        await context.env.INDEX_QUEUE.sendBatch(batch.map((job) => ({ body: job })));
        enqueued += batch.length;
      } catch (error) {
        console.error("Search lab could not enqueue seed embeddings", context.requestId, error);
        break;
      }
    }
  }

  return json({ action: "seed", inserted, replaced, enqueued });
}

async function runCleanup(context: RequestContext, body: LabBody): Promise<Response> {
  const rows = (await context.env.DB.prepare(
    `SELECT id, embedding_vector_id FROM notes WHERE title LIKE '[EVAL%'`,
  ).all<{ id: string; embedding_vector_id: string | null }>()).results;

  const vectorIds = rows
    .map((row) => row.embedding_vector_id)
    .filter((value): value is string => typeof value === "string" && value.length > 0);
  let deletedVectors = 0;
  for (let offset = 0; offset < vectorIds.length; offset += 100) {
    const batch = vectorIds.slice(offset, offset + 100);
    try {
      await context.env.VECTOR_INDEX.deleteByIds(batch);
      deletedVectors += batch.length;
    } catch (error) {
      console.error("Search lab could not delete eval vectors", context.requestId, error);
      break;
    }
  }

  const result = await context.env.DB.prepare("DELETE FROM notes WHERE title LIKE '[EVAL%'").run();
  let prunedCache = 0;
  if (body.pruneCache === true) {
    const cache = await context.env.DB.prepare("DELETE FROM lab_embedding_cache").run();
    prunedCache = cache.meta.changes ?? 0;
  }

  return json({
    action: "cleanup",
    matchedNotes: rows.length,
    deletedRows: result.meta.changes ?? 0,
    deletedVectors,
    prunedCache,
  });
}

async function runReindex(context: RequestContext): Promise<Response> {
  await context.env.DB.prepare(
    `UPDATE notes SET embedding_status = 'pending', embedding_error_code = NULL
     WHERE deleted_at IS NULL`,
  ).run();
  const rows = (await context.env.DB.prepare(
    `SELECT id, version, content_hash FROM notes WHERE deleted_at IS NULL ORDER BY updated_at ASC LIMIT 500`,
  ).all<{ id: string; version: number; content_hash: string }>()).results;

  let enqueued = 0;
  for (let offset = 0; offset < rows.length; offset += 100) {
    const batch = rows.slice(offset, offset + 100);
    try {
      await context.env.INDEX_QUEUE.sendBatch(
        batch.map((row) => ({
          body: {
            type: "embed-note" as const,
            eventId: newId(),
            noteId: row.id,
            version: row.version,
            contentHash: row.content_hash,
            createdAt: Date.now(),
          },
        })),
      );
      enqueued += batch.length;
    } catch (error) {
      console.error("Search lab could not enqueue reindex jobs", context.requestId, error);
      break;
    }
  }

  return json({ action: "reindex", pendingNotes: rows.length, enqueued });
}

async function runLive(context: RequestContext, body: LabBody): Promise<Response> {
  const includeText = body.includeText === true;
  const queries = parseQueries(body);
  const config = semanticConfig(context.env);
  const reports = [];

  for (const query of queries) {
    const startedAt = performance.now();
    const retrieval = await retrieveSemanticMatches(context.env, config, query);
    const noteIds = retrieval.aggregation.notes.map((note) => note.noteId);
    const titles = new Map<string, string>();
    if (includeText && noteIds.length > 0) {
      const rows = (await context.env.DB.prepare(
        `SELECT id, title FROM notes WHERE id IN (${noteIds.map(() => "?").join(",")})`,
      )
        .bind(...noteIds)
        .all<{ id: string; title: string }>()).results;
      for (const row of rows) titles.set(row.id, row.title);
    }

    reports.push({
      query,
      elapsedMs: Number((performance.now() - startedAt).toFixed(1)),
      timings: {
        embeddingMs: Number(retrieval.timings.embeddingMs.toFixed(1)),
        vectorMs: Number(retrieval.timings.vectorMs.toFixed(1)),
        resolveMs: Number(retrieval.timings.resolveMs.toFixed(1)),
        pendingMs: Number(retrieval.timings.pendingMs.toFixed(1)),
      },
      candidateChunkCount: retrieval.indexedCandidateCount,
      resolvedChunkCount: retrieval.resolvedCandidateCount,
      pendingNoteCount: retrieval.pendingNoteCount,
      pendingNotesScored: retrieval.pendingNotesScored,
      topChunkScore: retrieval.aggregation.topChunkScore,
      effectiveFloor: retrieval.aggregation.effectiveFloor,
      matchedChunkCount: retrieval.aggregation.matchedChunkCount,
      // Same shape as the sweep report, so the harness can score either source.
      rankedChunks: retrieval.hits
        .slice()
        .sort((left, right) => right.score - left.score)
        .slice(0, 20)
        .map((hit) => ({
          noteRef: hit.noteId.slice(0, 8),
          noteId: includeText ? hit.noteId : undefined,
          title: includeText ? titles.get(hit.noteId) : undefined,
          kind: hit.kind,
          lineNumber: hit.primaryLine,
          lineStart: hit.lineStart,
          lineEnd: hit.lineEnd,
          charStart: hit.charStart,
          charEnd: hit.charEnd,
          score: hit.score,
          text: includeText ? hit.text : undefined,
        })),
      results: retrieval.aggregation.notes.map((note, rank) => ({
        rank: rank + 1,
        noteRef: note.noteId.slice(0, 8),
        noteId: includeText ? note.noteId : undefined,
        title: includeText ? titles.get(note.noteId) : undefined,
        score: note.score,
        bestScore: note.bestScore,
        matchedChunkCount: note.matchedChunkCount,
        matches: note.matches.map((match) => ({
          kind: match.kind,
          lineNumber: match.primaryLine,
          lineStart: match.lineStart,
          lineEnd: match.lineEnd,
          charStart: match.charStart,
          charEnd: match.charEnd,
          score: match.score,
          text: includeText ? match.text : undefined,
        })),
      })),
    });
  }

  return json({
    action: "live",
    includeText,
    embeddingModel: config.spec.id,
    embeddingDimensions: config.spec.dimensions,
    chunking: config.chunking,
    aggregation: config.aggregation,
    chunkTopK: config.chunkTopK,
    queries: reports,
  });
}

export async function searchLab(context: RequestContext): Promise<Response> {
  // Rate limiting runs before authorization so a masked 404 cannot be used as a
  // cheap oracle for brute-forcing the token.
  await enforceRateLimit(
    context,
    "search-lab",
    240,
    5 * 60 * 1000,
    "Too many search lab requests. Wait for the current rate-limit window to expire.",
  );
  const actor = await authorizeLab(context);
  const body = await readJson<LabBody>(context.request);
  const action = body.action === undefined ? "sweep" : body.action;
  if (typeof action !== "string") throw invalid("action must be a string.");

  switch (action) {
    case "sweep":
      return runSweep(context, body);
    case "live":
      return runLive(context, body);
    case "probe":
      return runProbe(context, body);
    case "corpus-stats":
      return runCorpusStats(context, body);
    case "seed":
      return runSeed(context, body);
    case "cleanup":
      return runCleanup(context, body);
    case "reindex":
      return runReindex(context);
    case "whoami":
      return json({
        action: "whoami",
        actor,
        labConfigured: labConfigured(context.env),
        models: Object.keys(EMBEDDING_MODELS),
        defaults: { chunking: DEFAULT_CHUNKING, aggregation: DEFAULT_AGGREGATION },
      });
    default:
      throw invalid(
        'action must be one of "sweep", "live", "probe", "corpus-stats", "seed", "cleanup", "reindex", "whoami".',
      );
  }
}
