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
 * - A paired device Bearer token is also accepted after the kill switch and
 *   lab-token hash are configured, but it receives read-only actions only.
 * - Anything else gets the same 404 as an unknown route, so the endpoint does
 *   not advertise itself.
 * - Responses are anonymous-only: no note IDs, titles, bodies, image URLs, or
 *   matched text are ever returned, even to the operator token.
 */
import { authenticate } from "./auth";
import { deleteAiSearchItemsForNotes } from "./ai-search-index";
import { aiSearchConfig, probeAiSearchProvider } from "./ai-search";
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
import { semanticSearch } from "./search";
import {
  isShortQueryRescueEligible,
  retrieveSemanticMatches,
  SHORT_QUERY_EXPANSION_PREFIX,
} from "./semantic";
import {
  DEFAULT_SHORT_QUERY_RESCUE,
  semanticConfig,
  type ShortQueryRescueOptions,
} from "./semantic-config";
import { refineSpans } from "./span-refine";
import { DEFAULT_PRUNE, pruneOrphanChunkVectors } from "./vector-prune";
import {
  aggregateChunkHits,
  appendShortQueryConsensus,
  cosineSimilarity,
  DEFAULT_AGGREGATION,
  resolveAggregationOptions,
  type AggregationOptions,
  type ChunkHit,
} from "./semantic-core";
import type { EmbedNoteJob, Env, IndexJob, RequestContext, SyncAiSearchNoteJob } from "./types";

/** Input marker accepted from the local harness; never stored or embedded. */
export const EVAL_TITLE_PREFIX = "[EVAL:";
const EVAL_INPUT_PATTERN = /^\[EVAL:([a-z0-9-]+)\]\s*/;
/** Server-owned marker stored outside searchable title/body content. */
const EVAL_MUTATION_PREFIX = "notesflash-search-lab-eval:";

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
    /^[a-f0-9]{64}$/i.test((env.LAB_TOKEN_SHA256 ?? "").trim());
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
  if (!labConfigured(context.env)) throw notFound();
  const token = bearerToken(context.request);
  if (token) {
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
  fallbackOnly?: unknown;
  spanRefine?: unknown;
  passes?: unknown;
}

interface CorpusNote {
  id: string;
  ref: string;
  title: string;
  body: string;
  contentHash: string;
}

function evalKeyFromMetadata(title: string, mutationId: string | null | undefined): string | null {
  if (mutationId?.startsWith(EVAL_MUTATION_PREFIX)) {
    const key = mutationId.slice(EVAL_MUTATION_PREFIX.length);
    return /^[a-z0-9-]+$/.test(key) ? key : null;
  }
  // Backward-compatible cleanup/mapping for rows seeded by an older lab build.
  return title.match(EVAL_INPUT_PATTERN)?.[1] ?? null;
}

async function anonymousNoteRef(
  id: string,
  title: string,
  mutationId: string | null | undefined,
): Promise<string> {
  const evalKey = evalKeyFromMetadata(title, mutationId);
  return evalKey ?? `note-${(await sha256Hex(`search-lab-ref\u0000${id}`)).slice(0, 12)}`;
}

interface LabStrategy {
  name: string;
  spec: EmbeddingModelSpec;
  instruction?: string;
  chunking: ChunkingOptions;
  aggregation: AggregationOptions;
  shortQueryRescue: ShortQueryRescueOptions;
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

function parseLabShortQueryRescue(
  value: unknown,
  model: string,
  aggregation: AggregationOptions,
  name: string,
): ShortQueryRescueOptions {
  const base: ShortQueryRescueOptions = {
    ...DEFAULT_SHORT_QUERY_RESCUE,
    enabled: model === DEFAULT_EMBEDDING_MODEL,
  };
  if (value === undefined) return base;
  const record = asRecord(value, name);
  const allowed = new Set([
    "enabled",
    "maxCodePoints",
    "maxTokens",
    "rawMinCosine",
    "expandedMinCosine",
  ]);
  const unknown = Object.keys(record).find((key) => !allowed.has(key));
  if (unknown) throw invalid(`${name}.${unknown} is not supported.`);

  const boolean = (key: string, fallback: boolean): boolean => {
    const candidate = record[key];
    if (candidate === undefined) return fallback;
    if (typeof candidate !== "boolean") throw invalid(`${name}.${key} must be a boolean.`);
    return candidate;
  };
  const number = (key: string, fallback: number): number => {
    const candidate = record[key];
    if (candidate === undefined) return fallback;
    if (typeof candidate !== "number" || !Number.isFinite(candidate)) {
      throw invalid(`${name}.${key} must be a finite number.`);
    }
    return candidate;
  };
  const integer = (key: string, fallback: number): number => {
    const candidate = number(key, fallback);
    if (!Number.isInteger(candidate)) throw invalid(`${name}.${key} must be an integer.`);
    return candidate;
  };
  const resolved: ShortQueryRescueOptions = {
    enabled: boolean("enabled", base.enabled),
    maxCodePoints: integer("maxCodePoints", base.maxCodePoints),
    maxTokens: integer("maxTokens", base.maxTokens),
    rawMinCosine: number("rawMinCosine", base.rawMinCosine),
    expandedMinCosine: number("expandedMinCosine", base.expandedMinCosine),
  };
  if (resolved.maxCodePoints < 1 || resolved.maxCodePoints > 500) {
    throw invalid(`${name}.maxCodePoints must be between 1 and 500.`);
  }
  if (resolved.maxTokens < 1 || resolved.maxTokens > 100) {
    throw invalid(`${name}.maxTokens must be between 1 and 100.`);
  }
  if (
    resolved.rawMinCosine < -1 || resolved.rawMinCosine > 1 ||
    resolved.expandedMinCosine < -1 || resolved.expandedMinCosine > 1
  ) {
    throw invalid(`${name} cosine floors must be between -1 and 1.`);
  }
  if (resolved.enabled && resolved.rawMinCosine >= aggregation.minCosine) {
    throw invalid(`${name}.rawMinCosine must be below aggregation.minCosine.`);
  }
  return resolved;
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
      const spec = embeddingModelSpec(model);
      const chunking = resolveChunkingOptions(
        record.chunking === undefined
          ? undefined
          : (asRecord(record.chunking, `strategies[${index}].chunking`) as Partial<ChunkingOptions>),
      );
      const aggregation = resolveAggregationOptions(
        record.aggregation === undefined
          ? undefined
          : (asRecord(
            record.aggregation,
            `strategies[${index}].aggregation`,
          ) as Partial<AggregationOptions>),
      );
      return {
        name,
        spec,
        instruction,
        chunking,
        aggregation,
        shortQueryRescue: parseLabShortQueryRescue(
          record.shortQueryRescue,
          spec.id,
          aggregation,
          `strategies[${index}].shortQueryRescue`,
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

  const evalPredicate = `(
    COALESCE(mutation_id, '') LIKE '${EVAL_MUTATION_PREFIX}%'
    OR title LIKE '[EVAL:%'
  )`;
  const filter = corpus === "eval"
    ? `AND ${evalPredicate}`
    : corpus === "real"
    ? `AND NOT ${evalPredicate}`
    : "";
  const rows = (await context.env.DB.prepare(
    `SELECT id, title, body, content_hash, mutation_id
     FROM notes
     WHERE deleted_at IS NULL ${filter}
     ORDER BY id ASC
     LIMIT ?`,
  )
    .bind(maxNotes)
    .all<{
      id: string;
      title: string;
      body: string;
      content_hash: string;
      mutation_id: string | null;
    }>()).results;

  const notes: CorpusNote[] = [];
  let characters = 0;
  for (const row of rows) {
    characters += row.title.length + row.body.length;
    if (characters > MAX_CORPUS_CHARS) break;
    const evalKey = evalKeyFromMetadata(row.title, row.mutation_id);
    notes.push({
      id: row.id,
      ref: evalKey ?? await anonymousNoteRef(row.id, row.title, row.mutation_id),
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
  const queries = parseQueries(body);
  const strategies = parseStrategies(body.strategies);
  const startedAt = performance.now();
  const notes = await loadCorpus(context, body);
  const noteById = new Map(notes.map((note) => [note.id, note]));
  const corpusMs = performance.now() - startedAt;

  const strategyReports = [];
  for (const strategy of strategies) {
    const shortQueryRescue = strategy.shortQueryRescue;
    const chunkStartedAt = performance.now();
    const records: ChunkRecord[] = [];
    for (const note of notes) {
      // The marker is only an evaluation identity used for seed/cleanup and
      // expected-result mapping. Letting its English key reach the embedding
      // text would leak the answer into cross-language retrieval metrics.
      const embeddingNote = {
        ...note,
        title: note.title.replace(/^\[EVAL:[a-z0-9-]+\]\s*/, ""),
      };
      for (const chunk of buildNoteChunks(embeddingNote, strategy.chunking)) {
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
    const queryTexts: string[] = [];
    const queryViewIndexes = queries.map((query) => {
      const raw = queryTexts.push(query) - 1;
      const expanded = isShortQueryRescueEligible(query, shortQueryRescue)
        ? queryTexts.push(`${SHORT_QUERY_EXPANSION_PREFIX}${query}`) - 1
        : null;
      return { raw, expanded };
    });
    const queryEmbeddings = await embedWithCache(
      context,
      strategy.spec,
      queryTexts,
      "query",
      strategy.instruction,
    );
    const embeddingMs = performance.now() - embedStartedAt;

    const scoreStartedAt = performance.now();
    const queryReports = queries.map((query, queryIndex) => {
      const viewIndexes = queryViewIndexes[queryIndex];
      const rawVector = queryEmbeddings.vectors[viewIndexes.raw];
      const rawAll: ChunkHit[] = records.map((record, index) => ({
        noteId: record.note.id,
        chunkId: `${record.note.ref}:${record.chunk.chunkIndex}`,
        chunkIndex: record.chunk.chunkIndex,
        kind: record.chunk.kind,
        primaryLine: record.chunk.primaryLine,
        lineStart: record.chunk.lineStart,
        lineEnd: record.chunk.lineEnd,
        charStart: record.chunk.charStart,
        charEnd: record.chunk.charEnd,
        score: cosineSimilarity(rawVector, documents.vectors[index]),
        text: record.chunk.text,
      }));
      const rawHits = rawAll
        .slice()
        .sort((left, right) => right.score - left.score || left.chunkId.localeCompare(right.chunkId))
        .slice(0, 40);
      const expandedHits = viewIndexes.expanded === null
        ? []
        : records.map((record, index): ChunkHit => ({
          noteId: record.note.id,
          chunkId: `${record.note.ref}:${record.chunk.chunkIndex}`,
          chunkIndex: record.chunk.chunkIndex,
          kind: record.chunk.kind,
          primaryLine: record.chunk.primaryLine,
          lineStart: record.chunk.lineStart,
          lineEnd: record.chunk.lineEnd,
          charStart: record.chunk.charStart,
          charEnd: record.chunk.charEnd,
          score: cosineSimilarity(
            queryEmbeddings.vectors[viewIndexes.expanded as number],
            documents.vectors[index],
          ),
          text: record.chunk.text,
        }))
          .sort((left, right) =>
            right.score - left.score || left.chunkId.localeCompare(right.chunkId)
          )
          .slice(0, 40);
      const primary = aggregateChunkHits(rawHits, strategy.aggregation);
      const consensus = viewIndexes.expanded === null
        ? null
        : appendShortQueryConsensus(primary, rawHits, expandedHits, {
          rawMinCosine: shortQueryRescue.rawMinCosine,
          expandedMinCosine: shortQueryRescue.expandedMinCosine,
          relativeMinRatio: strategy.aggregation.relativeMinRatio,
          maxMatchesPerNote: strategy.aggregation.maxMatchesPerNote,
          topK: strategy.aggregation.topK,
        });
      const aggregated = consensus?.aggregation ?? primary;
      const sortedScores = rawAll.map((hit) => hit.score).sort((left, right) => left - right);
      const expandedById = new Map(expandedHits.map((hit) => [hit.chunkId, hit.score]));

      return {
        query,
        topChunkScore: aggregated.topChunkScore,
        effectiveFloor: aggregated.effectiveFloor,
        matchedChunkCount: aggregated.matchedChunkCount,
        candidateChunkCount: rawHits.length,
        expandedCandidateChunkCount: expandedHits.length,
        shortQueryRescue: {
          eligible: viewIndexes.expanded !== null,
          attempted: viewIndexes.expanded !== null,
          applied: viewIndexes.expanded !== null,
          expandedIndexAvailable: viewIndexes.expanded !== null,
          expandedVectorizeFailed: false,
          ...(consensus?.diagnostics ?? {
            rawFloor: shortQueryRescue.rawMinCosine,
            expandedFloor: shortQueryRescue.expandedMinCosine,
            consensusChunkCount: 0,
            candidateNoteCount: 0,
            addedNoteCount: 0,
            enrichedNoteCount: 0,
          }),
        },
        scoreStats: {
          max: percentile(sortedScores, 1),
          p99: percentile(sortedScores, 0.99),
          p90: percentile(sortedScores, 0.9),
          median: percentile(sortedScores, 0.5),
          min: percentile(sortedScores, 0),
          histogram: histogram(sortedScores),
        },
        // Production-depth raw ranking. Expanded scores are attached only when
        // that exact chunk also appeared in the contextual top 40.
        rankedChunks: rawHits
          .map((hit) => ({
            noteRef: noteById.get(hit.noteId)?.ref ?? "unknown",
            kind: hit.kind,
            lineNumber: hit.primaryLine,
            lineStart: hit.lineStart,
            lineEnd: hit.lineEnd,
            charStart: hit.charStart,
            charEnd: hit.charEnd,
            score: hit.score,
            expandedScore: expandedById.get(hit.chunkId) ?? null,
          })),
        results: aggregated.notes.map((note, rank) => ({
          rank: rank + 1,
          noteRef: noteById.get(note.noteId)?.ref ?? "unknown",
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
      shortQueryRescue,
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
    privacyMode: "anonymous-only",
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
  const aiStatusRows = (await context.env.DB.prepare(
    `SELECT ai_search_status AS status, COUNT(*) AS count
     FROM notes WHERE deleted_at IS NULL
     GROUP BY ai_search_status`,
  ).all<{ status: string; count: number }>()).results;
  const aiItemStatusRows = (await context.env.DB.prepare(
    `SELECT sync_state AS status, COUNT(*) AS count
     FROM ai_search_items
     GROUP BY sync_state`,
  ).all<{ status: string; count: number }>()).results;
  const aiErrorRows = (await context.env.DB.prepare(
    `SELECT ai_search_error_code AS code, COUNT(*) AS count
     FROM notes
     WHERE deleted_at IS NULL AND ai_search_error_code IS NOT NULL
     GROUP BY ai_search_error_code`,
  ).all<{ code: string; count: number }>()).results;
  const aiItemErrorRows = (await context.env.DB.prepare(
    `SELECT error_code AS code, COUNT(*) AS count
     FROM ai_search_items
     WHERE error_code IS NOT NULL
     GROUP BY error_code`,
  ).all<{ code: string; count: number }>()).results;
  const currentAiItemRow = await context.env.DB.prepare(
    `SELECT COUNT(*) AS count
     FROM ai_search_items a
     JOIN notes n ON n.id = a.note_id
     WHERE n.deleted_at IS NULL
       AND n.content_hash = a.note_content_hash
       AND a.sync_state = 'ready'`,
  ).first<{ count: number }>();
  const cacheRow = await context.env.DB.prepare(
    "SELECT COUNT(*) AS count FROM lab_embedding_cache",
  ).first<{ count: number }>();
  const evalRow = await context.env.DB.prepare(
    `SELECT COUNT(*) AS count FROM notes
     WHERE deleted_at IS NULL
       AND (
         mutation_id LIKE '${EVAL_MUTATION_PREFIX}%'
         OR title LIKE '[EVAL:%'
       )`,
  ).first<{ count: number }>();
  const indexedRow = await context.env.DB.prepare(
    `SELECT COUNT(*) AS count
     FROM note_chunks c
     JOIN notes n ON n.id = c.note_id
     WHERE n.deleted_at IS NULL AND n.content_hash = c.content_hash`,
  ).first<{ count: number }>();
  const staleRow = await context.env.DB.prepare(
    `SELECT COUNT(*) AS count
     FROM note_chunks c
     LEFT JOIN notes n ON n.id = c.note_id
     WHERE n.id IS NULL OR n.deleted_at IS NOT NULL OR n.content_hash != c.content_hash`,
  ).first<{ count: number }>();

  let vectorCount: number | null = null;
  let vectorError: string | null = null;
  try {
    const details = await context.env.CHUNK_INDEX.describe() as unknown as Record<string, unknown>;
    vectorCount = typeof details.vectorCount === "number"
      ? details.vectorCount
      : typeof details.vectorsCount === "number"
      ? details.vectorsCount
      : null;
  } catch (error) {
    vectorError = error instanceof Error ? error.name : "UNKNOWN_ERROR";
  }

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
    aiSearchStatus: Object.fromEntries(aiStatusRows.map((row) => [row.status, row.count])),
    aiSearchItemsByState: Object.fromEntries(
      aiItemStatusRows.map((row) => [row.status, row.count]),
    ),
    aiSearchErrors: Object.fromEntries(aiErrorRows.map((row) => [row.code, row.count])),
    aiSearchItemErrors: Object.fromEntries(
      aiItemErrorRows.map((row) => [row.code, row.count]),
    ),
    currentAiSearchItems: currentAiItemRow?.count ?? 0,
    indexedChunkRows: indexedRow?.count ?? 0,
    staleChunkRows: staleRow?.count ?? 0,
    vectorizeVectorCount: vectorCount,
    vectorizeError: vectorError,
    cachedEmbeddings: cacheRow?.count ?? 0,
  });
}

interface EvalArtifactRow {
  id: string;
  embedding_vector_id: string | null;
}

/**
 * Stop live/queued AI Search maintenance before inspecting provider items.
 * The sync path treats a live `disabled` note as a durable cleanup barrier and
 * provider uploads use their own per-item lease, so a retry can safely wait for
 * any operation that was already in flight.
 */
async function fenceEvalAiSearchArtifacts(
  context: RequestContext,
  rows: EvalArtifactRow[],
): Promise<void> {
  const noteIds = [...new Set(rows.map((row) => row.id))];
  for (let offset = 0; offset < noteIds.length; offset += 40) {
    const batch = noteIds.slice(offset, offset + 40);
    if (batch.length === 0) continue;
    await context.env.DB.prepare(
      `UPDATE notes SET
         ai_search_status = 'disabled', ai_search_indexed_content_hash = NULL,
         ai_search_updated_at = ?, ai_search_error_code = NULL
       WHERE id IN (${batch.map(() => "?").join(",")})
         AND (
           mutation_id LIKE '${EVAL_MUTATION_PREFIX}%'
           OR title LIKE '[EVAL:%'
         )`,
    )
      .bind(Date.now(), ...batch)
      .run();
  }
}

async function deleteEvalAiSearchArtifacts(
  context: RequestContext,
  rows: EvalArtifactRow[],
): Promise<number> {
  if (rows.length === 0) return 0;
  let result: Awaited<ReturnType<typeof deleteAiSearchItemsForNotes>>;
  try {
    result = await deleteAiSearchItemsForNotes(
      context.env,
      rows.map((row) => row.id),
    );
  } catch (error) {
    console.error("Search lab could not delete eval AI Search items", context.requestId, error);
    throw new AppError(
      503,
      "LAB_AI_SEARCH_CLEANUP_FAILED",
      "Evaluation AI Search items could not be removed safely; the notes were left intact.",
    );
  }
  if (!result.complete) {
    throw new AppError(
      503,
      "LAB_AI_SEARCH_CLEANUP_PENDING",
      "Evaluation AI Search cleanup made bounded progress; retry before deleting the notes.",
      {
        deletedAiSearchItems: result.deletedItems,
        remainingAiSearchItems: result.remainingItems,
      },
    );
  }
  return result.deletedItems;
}

/** Delete vectors before D1 cascades erase the IDs needed to address them. */
async function deleteEvalVectorArtifacts(
  context: RequestContext,
  rows: EvalArtifactRow[],
): Promise<{ deletedChunkVectors: number; deletedVectors: number }> {
  const chunkIds: string[] = [];
  for (let offset = 0; offset < rows.length; offset += 40) {
    const noteIds = rows.slice(offset, offset + 40).map((row) => row.id);
    if (noteIds.length === 0) continue;
    const chunkRows = (await context.env.DB.prepare(
      `SELECT chunk_id FROM note_chunks WHERE note_id IN (${noteIds.map(() => "?").join(",")})`,
    )
      .bind(...noteIds)
      .all<{ chunk_id: string }>()).results;
    chunkIds.push(...chunkRows.map((row) => row.chunk_id));
  }

  let deletedChunkVectors = 0;
  for (let offset = 0; offset < chunkIds.length; offset += 100) {
    const batch = chunkIds.slice(offset, offset + 100);
    try {
      await context.env.CHUNK_INDEX.deleteByIds(batch);
      deletedChunkVectors += batch.length;
    } catch (error) {
      console.error("Search lab could not delete eval chunk vectors", context.requestId, error);
      throw new AppError(
        503,
        "LAB_VECTOR_CLEANUP_FAILED",
        "Evaluation vectors could not be removed safely; the notes were left intact.",
      );
    }
  }

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
      console.error("Search lab could not delete legacy eval vectors", context.requestId, error);
      throw new AppError(
        503,
        "LAB_VECTOR_CLEANUP_FAILED",
        "Evaluation vectors could not be removed safely; the notes were left intact.",
      );
    }
  }
  return { deletedChunkVectors, deletedVectors };
}

async function runSeed(context: RequestContext, body: LabBody): Promise<Response> {
  const raw = body.notes;
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_SEED_NOTES) {
    throw invalid(`notes must be an array of 1 to ${MAX_SEED_NOTES} objects.`);
  }
  const enqueue = body.enqueue !== false;
  const maintainAiSearch = aiSearchConfig(context.env).enabled;

  const parsed = raw.map((item, index) => {
    const record = asRecord(item, `notes[${index}]`);
    const title = record.title;
    const noteBody = record.body ?? "";
    const titleMatch = typeof title === "string" ? title.match(EVAL_INPUT_PATTERN) : null;
    if (!titleMatch) {
      throw invalid(`notes[${index}].title must start with "${EVAL_TITLE_PREFIX}<key>]".`);
    }
    const inputTitle = title as string;
    const key = titleMatch[1];
    const storedTitle = inputTitle.slice(titleMatch[0].length).trim();
    if (storedTitle.length === 0 || storedTitle.length > 500) {
      throw invalid(`notes[${index}].title content must contain 1 to 500 characters.`);
    }
    if (typeof noteBody !== "string" || noteBody.length > 200_000) {
      throw invalid(`notes[${index}].body must be a string of at most 200000 characters.`);
    }
    return {
      key,
      inputTitle,
      title: storedTitle,
      body: noteBody,
      mutationId: `${EVAL_MUTATION_PREFIX}${key}`,
    };
  });

  const now = Date.now();
  let inserted = 0;
  let replaced = 0;
  const vectorJobs: EmbedNoteJob[] = [];
  const aiSearchJobs: SyncAiSearchNoteJob[] = [];

  // Discover the entire replacement set before mutating anything. The strict
  // provider helper owns one global 100-item budget per HTTP request; calling
  // it once per input note would accidentally multiply that budget by as many
  // as MAX_SEED_NOTES and could exceed Workers' internal-subrequest limit.
  const existingById = new Map<string, EvalArtifactRow>();
  for (const note of parsed) {
    // The server-owned mutation namespace identifies lab rows without putting
    // an English evaluation key into searchable title/body content.
    const existing = await context.env.DB.prepare(
      `SELECT id, embedding_vector_id FROM notes
       WHERE mutation_id = ?
          OR (title = ? AND title LIKE '[EVAL:%')`,
    )
      .bind(note.mutationId, note.inputTitle)
      .all<EvalArtifactRow>();
    for (const row of existing.results) existingById.set(row.id, row);
  }

  const existingRows = [...existingById.values()];
  await fenceEvalAiSearchArtifacts(context, existingRows);
  const deletedAiSearchItems = await deleteEvalAiSearchArtifacts(context, existingRows);
  await deleteEvalVectorArtifacts(context, existingRows);
  for (const row of existingRows) {
    const result = await context.env.DB.prepare(
      `DELETE FROM notes
       WHERE id = ?
         AND (
           mutation_id LIKE '${EVAL_MUTATION_PREFIX}%'
           OR title LIKE '[EVAL:%'
         )`,
    )
      .bind(row.id)
      .run();
    replaced += result.meta.changes ?? 0;
  }

  for (const note of parsed) {
    const id = newId();
    const hash = await contentHash(note.title, note.body);
    await context.env.DB.prepare(
      `INSERT INTO notes(
         id, title, body, version, content_hash, created_at, updated_at,
         embedding_status, ai_search_status, mutation_id
       ) VALUES (?, ?, ?, 1, ?, ?, ?, ?, ?, ?)`,
    )
      // A non-enqueued sweep corpus must stay invisible to the periodic
      // pending-note repair job. Otherwise a long calibration run can race the
      // five-minute cron, write synthetic vectors into the production index,
      // and leave orphans if cleanup deletes the note mid-job.
      .bind(
        id,
        note.title,
        note.body,
        hash,
        now,
        now,
        enqueue ? "pending" : "disabled",
        enqueue && maintainAiSearch ? "pending" : "disabled",
        note.mutationId,
      )
      .run();
    inserted += 1;
    vectorJobs.push({
      type: "embed-note",
      eventId: newId(),
      noteId: id,
      version: 1,
      contentHash: hash,
      createdAt: now,
    });
    if (maintainAiSearch) {
      aiSearchJobs.push({
        type: "sync-ai-search-note",
        eventId: newId(),
        noteId: id,
        version: 1,
        contentHash: hash,
        createdAt: now,
      });
    }
  }

  let vectorJobsEnqueued = 0;
  let aiSearchJobsEnqueued = 0;
  if (enqueue) {
    vectorJobsEnqueued = await enqueueLabJobs(context, vectorJobs, "seed Vectorize");
    aiSearchJobsEnqueued = await enqueueLabJobs(context, aiSearchJobs, "seed AI Search");
  }

  return json({
    action: "seed",
    inserted,
    replaced,
    // Preserve the original field for existing eval clients; the explicit
    // fields below remove the ambiguity now that two independent indexes exist.
    enqueued: vectorJobsEnqueued,
    vectorJobsEnqueued,
    aiSearchJobsEnqueued,
    aiSearchEnabled: maintainAiSearch,
    deletedAiSearchItems,
  });
}

async function runCleanup(context: RequestContext, body: LabBody): Promise<Response> {
  const rows = (await context.env.DB.prepare(
    `SELECT id, embedding_vector_id FROM notes
     WHERE mutation_id LIKE '${EVAL_MUTATION_PREFIX}%'
        OR title LIKE '[EVAL:%'`,
  ).all<EvalArtifactRow>()).results;

  await fenceEvalAiSearchArtifacts(context, rows);
  const deletedAiSearchItems = await deleteEvalAiSearchArtifacts(context, rows);
  const { deletedChunkVectors, deletedVectors } = await deleteEvalVectorArtifacts(context, rows);

  let deletedRows = 0;
  // Delete only the rows whose provider mappings were inspected above. A
  // predicate-only bulk delete could catch a concurrently seeded eval note and
  // cascade away an item ID that this invocation never cleaned up.
  for (const row of rows) {
    const result = await context.env.DB.prepare(
      `DELETE FROM notes
       WHERE id = ?
         AND (
           mutation_id LIKE '${EVAL_MUTATION_PREFIX}%'
           OR title LIKE '[EVAL:%'
         )`,
    )
      .bind(row.id)
      .run();
    deletedRows += result.meta.changes ?? 0;
  }
  let prunedCache = 0;
  if (body.pruneCache === true) {
    const cache = await context.env.DB.prepare("DELETE FROM lab_embedding_cache").run();
    prunedCache = cache.meta.changes ?? 0;
  }

  return json({
    action: "cleanup",
    matchedNotes: rows.length,
    deletedRows,
    deletedChunkVectors,
    deletedVectors,
    deletedAiSearchItems,
    prunedCache,
  });
}

async function enqueueLabJobs(
  context: RequestContext,
  jobs: IndexJob[],
  label: string,
): Promise<number> {
  let enqueued = 0;
  for (let offset = 0; offset < jobs.length; offset += 100) {
    const batch = jobs.slice(offset, offset + 100);
    try {
      await context.env.INDEX_QUEUE.sendBatch(batch.map((job) => ({ body: job })));
      enqueued += batch.length;
    } catch (error) {
      console.error(`Search lab could not enqueue ${label} jobs`, context.requestId, error);
      break;
    }
  }
  return enqueued;
}

async function runReindex(context: RequestContext): Promise<Response> {
  const maintainAiSearch = aiSearchConfig(context.env).enabled;
  const aiSearchStatus = maintainAiSearch ? "pending" : "disabled";
  await context.env.DB.prepare(
    `UPDATE notes SET
       embedding_status = 'pending', embedding_error_code = NULL,
       ai_search_status = '${aiSearchStatus}', ai_search_indexed_content_hash = NULL,
       ai_search_updated_at = NULL, ai_search_error_code = NULL
     WHERE deleted_at IS NULL`,
  ).run();
  const rows = (await context.env.DB.prepare(
    `SELECT id, version, content_hash FROM notes WHERE deleted_at IS NULL ORDER BY updated_at ASC LIMIT 500`,
  ).all<{ id: string; version: number; content_hash: string }>()).results;

  const createdAt = Date.now();
  const vectorJobs: EmbedNoteJob[] = rows.map((row) => ({
    type: "embed-note",
    eventId: newId(),
    noteId: row.id,
    version: row.version,
    contentHash: row.content_hash,
    createdAt,
  }));
  const aiSearchJobs: SyncAiSearchNoteJob[] = maintainAiSearch
    ? rows.map((row) => ({
      type: "sync-ai-search-note",
      eventId: newId(),
      noteId: row.id,
      version: row.version,
      contentHash: row.content_hash,
      createdAt,
    }))
    : [];
  const vectorJobsEnqueued = await enqueueLabJobs(context, vectorJobs, "reindex Vectorize");
  const aiSearchJobsEnqueued = await enqueueLabJobs(context, aiSearchJobs, "reindex AI Search");

  return json({
    action: "reindex",
    pendingNotes: rows.length,
    enqueued: vectorJobsEnqueued,
    vectorJobsEnqueued,
    aiSearchJobsEnqueued,
    aiSearchEnabled: maintainAiSearch,
  });
}

async function runLive(context: RequestContext, body: LabBody): Promise<Response> {
  const queries = parseQueries(body);
  const baseConfig = semanticConfig(context.env);
  if (body.spanRefine !== undefined && typeof body.spanRefine !== "boolean") {
    throw invalid("spanRefine must be a boolean.");
  }
  const config = body.spanRefine === undefined
    ? baseConfig
    : {
      ...baseConfig,
      spanRefine: { ...baseConfig.spanRefine, enabled: body.spanRefine },
    };
  const reports = [];

  for (const query of queries) {
    const startedAt = performance.now();
    const retrieval = await retrieveSemanticMatches(context.env, config, query);
    const refinement = await refineSpans(
      context.env,
      config,
      retrieval.queryVector,
      retrieval.aggregation.notes,
      config.spanRefine,
    );
    const noteIds = [...new Set([
      ...retrieval.hits.map((hit) => hit.noteId),
      ...retrieval.aggregation.notes.map((note) => note.noteId),
    ])];
    const noteRefs = new Map<string, string>();
    if (noteIds.length > 0) {
      const rows = (await context.env.DB.prepare(
        `SELECT id, title, mutation_id FROM notes
         WHERE id IN (${noteIds.map(() => "?").join(",")})`,
      )
        .bind(...noteIds)
        .all<{ id: string; title: string; mutation_id: string | null }>()).results;
      await Promise.all(rows.map(async (row) => {
        noteRefs.set(row.id, await anonymousNoteRef(row.id, row.title, row.mutation_id));
      }));
    }

    reports.push({
      query,
      elapsedMs: Number((performance.now() - startedAt).toFixed(1)),
      timings: {
        embeddingMs: Number(retrieval.timings.embeddingMs.toFixed(1)),
        vectorMs: Number(retrieval.timings.vectorMs.toFixed(1)),
        resolveMs: Number(retrieval.timings.resolveMs.toFixed(1)),
        pendingMs: Number(retrieval.timings.pendingMs.toFixed(1)),
        refineMs: Number(refinement.durationMs.toFixed(1)),
      },
      spanRefinement: {
        enabled: config.spanRefine.enabled,
        refinedMatchCount: refinement.refinedCount,
        candidateCount: refinement.candidateCount,
        aiCalls: refinement.aiCalls,
      },
      candidateChunkCount: retrieval.indexedCandidateCount,
      resolvedChunkCount: retrieval.resolvedCandidateCount,
      expandedCandidateChunkCount: retrieval.expandedIndexedCandidateCount,
      expandedResolvedChunkCount: retrieval.expandedResolvedCandidateCount,
      shortQueryRescue: retrieval.shortQueryRescue,
      pendingNoteCount: retrieval.pendingNoteCount,
      pendingNotesScored: retrieval.pendingNotesScored,
      topChunkScore: retrieval.aggregation.topChunkScore,
      effectiveFloor: retrieval.aggregation.effectiveFloor,
      matchedChunkCount: retrieval.aggregation.matchedChunkCount,
      // Same shape as the sweep report, so the harness can score either source.
      rankedChunks: retrieval.hits
        .slice()
        .sort((left, right) => right.score - left.score)
        .slice(0, 40)
        .map((hit) => ({
          noteRef: noteRefs.get(hit.noteId) ?? "unknown",
          kind: hit.kind,
          lineNumber: hit.primaryLine,
          lineStart: hit.lineStart,
          lineEnd: hit.lineEnd,
          charStart: hit.charStart,
          charEnd: hit.charEnd,
          score: hit.score,
        })),
      results: retrieval.aggregation.notes.map((note, rank) => ({
        rank: rank + 1,
        noteRef: noteRefs.get(note.noteId) ?? "unknown",
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
        })),
      })),
    });
  }

  return json({
    action: "live",
    privacyMode: "anonymous-only",
    backend: "legacy-vectorize",
    productionHandler: false,
    embeddingModel: config.spec.id,
    embeddingDimensions: config.spec.dimensions,
    chunking: config.chunking,
    aggregation: config.aggregation,
    chunkTopK: config.chunkTopK,
    queries: reports,
  });
}

/**
 * Call the production search handler itself, so the response contract that
 * clients consume is verified rather than just the retrieval internals.
 */
async function runApi(context: RequestContext, body: LabBody): Promise<Response> {
  const queries = parseQueries(body);
  const fallbackOnly = body.fallbackOnly !== false;
  const reports = [];

  for (const query of queries) {
    const startedAt = performance.now();
    const request = new Request("https://internal/api/search/semantic", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query, fallbackOnly }),
    });
    const response = await semanticSearch({
      env: context.env,
      request,
      url: new URL(request.url),
      requestId: context.requestId,
      // The lab is already authorized; searchSemantic only needs a principal to
      // exist, and no device-specific data reaches the response.
      principal: context.principal ?? {
        deviceId: "search-lab",
        deviceName: "search-lab",
        sessionId: "search-lab",
      },
    });
    const payload = await response.json() as Record<string, unknown>;
    const results = Array.isArray(payload.results) ? payload.results : [];

    const sanitizedResults = await Promise.all(results.map(async (item) => {
      const record = item as Record<string, unknown>;
      const matches = Array.isArray(record.matches) ? record.matches : [];
      const noteBody = typeof record.body === "string" ? record.body : "";
      const noteId = typeof record.id === "string" ? record.id : "";
      const title = typeof record.title === "string" ? record.title : "";
      // The normal API response has no mutation metadata. Resolve it only for
      // synthetic eval notes so the harness can map anonymous results.
      const metadata = noteId.length === 0
        ? null
        : await context.env.DB.prepare(
          "SELECT mutation_id FROM notes WHERE id = ?",
        ).bind(noteId).first<{ mutation_id: string | null }>();
      return {
        noteRef: noteId.length === 0
          ? "unknown"
          : await anonymousNoteRef(noteId, title, metadata?.mutation_id),
        score: record.score,
        matchType: record.matchType,
        matches: matches.map((value) => {
          const match = value as Record<string, unknown>;
          const charStart = typeof match.charStart === "number" ? match.charStart : null;
          const charEnd = typeof match.charEnd === "number" ? match.charEnd : null;
          const slice = charStart !== null && charEnd !== null
            ? noteBody.slice(charStart, charEnd)
            : null;
          return {
            kind: match.kind,
            lineNumber: match.lineNumber,
            rawLineIndex: match.rawLineIndex,
            charStart,
            charEnd,
            score: match.score,
            // Proves offsets address the same text without returning either.
            offsetsMatchText: slice === null ? null : slice === match.text,
          };
        }),
      };
    }));

    reports.push({
      query,
      status: response.status,
      elapsedMs: Number((performance.now() - startedAt).toFixed(1)),
      serverTiming: response.headers.get("server-timing"),
      strategy: payload.strategy,
      backend: payload.backend,
      rankingStrategy: payload.rankingStrategy,
      semanticSkipped: payload.semanticSkipped ?? false,
      effectiveFloor: payload.effectiveFloor,
      topChunkScore: payload.topChunkScore,
      candidateChunkCount: payload.candidateChunkCount,
      candidateItemCount: payload.candidateItemCount,
      resolvedItemCount: payload.resolvedItemCount,
      matchedNoteCount: payload.matchedNoteCount,
      pendingIndexCount: payload.pendingIndexCount,
      translation: payload.translation && typeof payload.translation === "object"
        ? {
          enabled: (payload.translation as Record<string, unknown>).enabled === true,
          attempted: (payload.translation as Record<string, unknown>).attempted === true,
          applied: (payload.translation as Record<string, unknown>).applied === true,
          failed: (payload.translation as Record<string, unknown>).failed === true,
        }
        : null,
      results: sanitizedResults,
    });
  }

  return json({ action: "api", privacyMode: "anonymous-only", fallbackOnly, queries: reports });
}

async function runPruneVectors(context: RequestContext, body: LabBody): Promise<Response> {
  const passes = body.passes === undefined ? 1 : body.passes;
  if (typeof passes !== "number" || !Number.isInteger(passes) || passes < 1 || passes > 20) {
    throw invalid("passes must be an integer between 1 and 20.");
  }
  const config = semanticConfig(context.env);
  const results = [];
  for (let pass = 0; pass < passes; pass += 1) {
    const result = await pruneOrphanChunkVectors(context.env, config.spec, {
      ...DEFAULT_PRUNE,
      probes: 8,
    });
    results.push(result);
    if (result.orphaned === 0) break;
  }

  return json({
    action: "prune-vectors",
    passes: results.length,
    deleted: results.reduce((sum, result) => sum + result.deleted, 0),
    results,
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
  if (body.includeText === true) {
    throw invalid("includeText is not supported; search-lab responses are anonymous-only.");
  }
  const action = body.action === undefined ? "sweep" : body.action;
  if (typeof action !== "string") throw invalid("action must be a string.");
  if (
    actor === "device" &&
    !["live", "api", "corpus-stats", "whoami"].includes(action)
  ) {
    // Preserve the masked surface when a paired device attempts a calibration
    // or mutation action reserved for the dedicated operator token.
    throw notFound();
  }

  switch (action) {
    case "sweep":
      return runSweep(context, body);
    case "live":
      return runLive(context, body);
    case "api":
      return runApi(context, body);
    case "probe":
      return runProbe(context, body);
    case "provider-probe":
      return json({ action: "provider-probe", ...await probeAiSearchProvider(context.env) });
    case "corpus-stats":
      return runCorpusStats(context, body);
    case "seed":
      return runSeed(context, body);
    case "cleanup":
      return runCleanup(context, body);
    case "prune-vectors":
      return runPruneVectors(context, body);
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
        'action must be one of "sweep", "live", "api", "probe", "provider-probe", "corpus-stats", "seed", "cleanup", "prune-vectors", "reindex", "whoami".',
      );
  }
}
