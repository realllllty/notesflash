import { currentLineSlice, AI_SEARCH_ITEM_SCHEMA_VERSION } from "./ai-search-items";
import { hydrateNotes } from "./db";
import { AppError } from "./http";
import type { AiSearchItemRow, Env, NoteRow, SearchMatch, SearchResult } from "./types";

const DEFAULT_INSTANCE_NAME = "notesflash-search";
const DEFAULT_EMBEDDING_MODEL = "@cf/google/embeddinggemma-300m";
const MAX_TRANSLATED_QUERY_CODEPOINTS = 256;

export type SemanticBackend = "vectorize" | "ai-search";

export interface AiSearchRuntimeConfig {
  backend: SemanticBackend;
  enabled: boolean;
  instanceName: string;
  queryTranslation: boolean;
  queryRewrite: boolean;
  reranking: boolean;
  maxResults: number;
  maxMatchesPerNote: number;
  maxItemsPerNote: number;
  topK: number;
}

function booleanVar(value: string | undefined, fallback: boolean, name: string): boolean {
  if (value === undefined || value.trim() === "") return fallback;
  if (value === "true") return true;
  if (value === "false") return false;
  throw new AppError(500, "INVALID_AI_SEARCH_CONFIGURATION", `${name} must be true or false.`);
}

function integerVar(
  value: string | undefined,
  fallback: number,
  min: number,
  max: number,
  name: string,
): number {
  if (value === undefined || value.trim() === "") return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new AppError(
      500,
      "INVALID_AI_SEARCH_CONFIGURATION",
      `${name} must be an integer between ${min} and ${max}.`,
    );
  }
  return parsed;
}

export function aiSearchConfig(env: Env): AiSearchRuntimeConfig {
  const rawBackend = env.SEMANTIC_BACKEND?.trim() || "vectorize";
  if (rawBackend !== "vectorize" && rawBackend !== "ai-search") {
    throw new AppError(
      500,
      "INVALID_AI_SEARCH_CONFIGURATION",
      "SEMANTIC_BACKEND must be vectorize or ai-search.",
    );
  }
  const instanceName = env.AI_SEARCH_INSTANCE_NAME?.trim() || DEFAULT_INSTANCE_NAME;
  if (!/^[a-z0-9_]+(?:-[a-z0-9_]+)*$/.test(instanceName) || instanceName.length > 32) {
    throw new AppError(
      500,
      "INVALID_AI_SEARCH_CONFIGURATION",
      "AI_SEARCH_INSTANCE_NAME is not a valid Cloudflare AI Search instance name.",
    );
  }
  return {
    backend: rawBackend,
    enabled: rawBackend === "ai-search" || booleanVar(
      env.AI_SEARCH_ENABLED,
      false,
      "AI_SEARCH_ENABLED",
    ),
    instanceName,
    queryTranslation: booleanVar(
      env.AI_SEARCH_QUERY_TRANSLATION,
      true,
      "AI_SEARCH_QUERY_TRANSLATION",
    ),
    // Cloudflare query rewrite does not rewrite the first independent query;
    // keep this visible in diagnostics but disabled in the request contract.
    queryRewrite: booleanVar(env.AI_SEARCH_QUERY_REWRITE, false, "AI_SEARCH_QUERY_REWRITE"),
    reranking: booleanVar(env.AI_SEARCH_RERANKING, false, "AI_SEARCH_RERANKING"),
    maxResults: integerVar(env.AI_SEARCH_MAX_RESULTS, 50, 1, 50, "AI_SEARCH_MAX_RESULTS"),
    maxMatchesPerNote: integerVar(
      env.AI_SEARCH_MAX_MATCHES_PER_NOTE,
      3,
      1,
      20,
      "AI_SEARCH_MAX_MATCHES_PER_NOTE",
    ),
    maxItemsPerNote: integerVar(
      env.AI_SEARCH_MAX_ITEMS_PER_NOTE,
      2_000,
      1,
      20_000,
      "AI_SEARCH_MAX_ITEMS_PER_NOTE",
    ),
    topK: integerVar(env.SEMANTIC_TOP_K, 8, 1, 50, "SEMANTIC_TOP_K"),
  };
}

type AiSearchInstanceSettings = Omit<AiSearchConfig, "id" | "type" | "source" | "source_params">;
type AiSearchMetadataField = {
  field_name: string;
  data_type: "text" | "number" | "boolean" | "datetime";
};

const AI_SEARCH_CUSTOM_METADATA: AiSearchMetadataField[] = [
  { field_name: "schema_version", data_type: "number" },
  { field_name: "kind", data_type: "text" },
  { field_name: "raw_line_index", data_type: "number" },
  { field_name: "index_hash", data_type: "text" },
];

function desiredInstanceSettings(config: AiSearchRuntimeConfig): AiSearchInstanceSettings {
  return {
    embedding_model: DEFAULT_EMBEDDING_MODEL,
    index_method: { vector: true, keyword: true },
    fusion_method: "rrf",
    indexing_options: { keyword_tokenizer: "trigram" },
    retrieval_options: { keyword_match_mode: "or" },
    rewrite_query: false,
    reranking: config.reranking,
    // One NotesFlash item is already one logical line. These documented chunk
    // fields only protect exceptionally long lines; repeated chunks still map
    // back to the same D1 item key and are deduplicated during aggregation.
    chunk_size: 512,
    chunk_overlap: 0,
    score_threshold: 0.4,
    max_num_results: config.maxResults,
    cache: false,
    custom_metadata: AI_SEARCH_CUSTOM_METADATA,
  };
}

function desiredCreateConfig(config: AiSearchRuntimeConfig): AiSearchConfig {
  return { id: config.instanceName, ...desiredInstanceSettings(config) };
}

function providerErrorText(error: unknown): string {
  if (!error || typeof error !== "object") return String(error);
  const record = error as Record<string, unknown>;
  return [record.name, record.message, record.code]
    .filter((value) => typeof value === "string" || typeof value === "number")
    .join(" ");
}

function providerDiagnostic(error: unknown): {
  name: string;
  code: string | null;
  message: string;
} {
  const record = error && typeof error === "object"
    ? error as Record<string, unknown>
    : {};
  const rawMessage = typeof record.message === "string"
    ? record.message
    : error instanceof Error
    ? error.message
    : String(error);
  // This is returned only by the authenticated operator lab, but provider
  // messages still get a conservative scrub so account IDs, URLs, or opaque
  // tokens cannot become observability output accidentally.
  const message = rawMessage
    .replace(/https?:\/\/\S+/gi, "[url]")
    .replace(/\b[a-f0-9]{32,}\b/gi, "[redacted]")
    .replace(/\b[A-Za-z0-9_-]{48,}\b/g, "[redacted]")
    .slice(0, 300);
  const code = typeof record.code === "string" || typeof record.code === "number"
    ? String(record.code).slice(0, 100)
    : null;
  const name = typeof record.name === "string"
    ? record.name.slice(0, 100)
    : error instanceof Error
    ? error.name.slice(0, 100)
    : "UNKNOWN_ERROR";
  return { name, code, message };
}

/**
 * Exercise the production namespace and built-in Items upload contract without
 * reading a note. The protected search lab exposes only this anonymous result;
 * the fixed synthetic item is deleted before the probe returns.
 */
export async function probeAiSearchProvider(env: Env): Promise<Record<string, unknown>> {
  const config = aiSearchConfig(env);
  if (!config.enabled || !env.AI_SEARCH) {
    return {
      ok: false,
      stage: "binding",
      error: {
        name: "AppError",
        code: "AI_SEARCH_SETUP_REQUIRED",
        message: "Cloudflare AI Search is not bound to this Worker.",
      },
    };
  }

  const instance = env.AI_SEARCH.get(config.instanceName);
  let info: AiSearchInstanceInfo;
  try {
    info = await instance.info();
  } catch (error) {
    return { ok: false, stage: "instance-info", error: providerDiagnostic(error) };
  }
  const instanceConfig = {
    status: typeof info.status === "string" ? info.status : null,
    embeddingModel: info.embedding_model ?? null,
    vectorIndex: info.index_method?.vector === true,
    keywordIndex: info.index_method?.keyword === true,
    fusionMethod: info.fusion_method ?? null,
    keywordTokenizer: info.indexing_options?.keyword_tokenizer ?? null,
    keywordMatchMode: info.retrieval_options?.keyword_match_mode ?? null,
    rewriteQuery: info.rewrite_query ?? null,
    reranking: info.reranking ?? null,
    chunkSize: info.chunk_size ?? null,
    chunkOverlap: info.chunk_overlap ?? null,
    scoreThreshold: info.score_threshold ?? null,
    maxResults: info.max_num_results ?? null,
    cache: info.cache ?? null,
    customMetadata: Array.isArray(info.custom_metadata)
      ? info.custom_metadata.map((field) => ({
        fieldName: field.field_name,
        dataType: field.data_type,
      }))
      : [],
    configurationDrift: instanceConfigDrift(info, config),
  };

  const probeKey = `nf_provider_probe_body_0_${"0".repeat(64)}.txt`;
  let uploaded: AiSearchItemInfo;
  try {
    uploaded = await instance.items.upload(
      probeKey,
      "NotesFlash Cloudflare AI Search provider diagnostic.",
      {
        metadata: {
          schema_version: String(AI_SEARCH_ITEM_SCHEMA_VERSION),
          kind: "body",
          raw_line_index: "0",
          index_hash: "0".repeat(64),
        },
      },
    );
  } catch (error) {
    return {
      ok: false,
      stage: "item-upload",
      instanceConfig,
      error: providerDiagnostic(error),
    };
  }

  const itemId = typeof uploaded.id === "string" && uploaded.id.length > 0
    ? uploaded.id
    : null;
  let cleanup: Record<string, unknown> = { attempted: itemId !== null, ok: itemId === null };
  if (itemId !== null) {
    try {
      await instance.items.delete(itemId);
      cleanup = { attempted: true, ok: true };
    } catch (error) {
      cleanup = { attempted: true, ok: false, error: providerDiagnostic(error) };
    }
  }

  if (itemId === null || uploaded.status === "error") {
    return {
      ok: false,
      stage: itemId === null ? "item-response" : "item-processing",
      uploadStatus: uploaded.status,
      providerItemError: typeof uploaded.error === "string"
        ? providerDiagnostic(new Error(uploaded.error))
        : null,
      instanceConfig,
      cleanup,
    };
  }

  return {
    ok: cleanup.ok === true,
    stage: cleanup.ok === true ? "complete" : "item-cleanup",
    uploadStatus: uploaded.status,
    instanceConfig,
    cleanup,
  };
}

function instanceNotFound(error: unknown): boolean {
  return /AiSearchNotFoundError|ai_search_not_found|\b7002\b|\b404\b/i.test(
    providerErrorText(error),
  );
}

function instanceAlreadyExists(error: unknown): boolean {
  return /ai_search_with_this_name_already_exist|already exists|\b7022\b/i.test(
    providerErrorText(error),
  );
}

function customMetadataMatches(actual: unknown): boolean {
  if (!Array.isArray(actual)) return false;
  const normalize = (fields: AiSearchMetadataField[]) =>
    fields.map((field) => `${field.field_name}:${field.data_type}`).sort();
  const parsed: AiSearchMetadataField[] = [];
  for (const field of actual) {
    if (!field || typeof field !== "object") return false;
    const record = field as Record<string, unknown>;
    if (typeof record.field_name !== "string" || typeof record.data_type !== "string") {
      return false;
    }
    parsed.push({
      field_name: record.field_name,
      data_type: record.data_type as AiSearchMetadataField["data_type"],
    });
  }
  return JSON.stringify(normalize(parsed)) ===
    JSON.stringify(normalize(AI_SEARCH_CUSTOM_METADATA));
}

function instanceConfigDrift(
  existing: AiSearchInstanceInfo,
  config: AiSearchRuntimeConfig,
): boolean {
  return existing.embedding_model !== DEFAULT_EMBEDDING_MODEL ||
    existing.index_method?.vector !== true ||
    existing.index_method?.keyword !== true ||
    existing.fusion_method !== "rrf" ||
    existing.indexing_options?.keyword_tokenizer !== "trigram" ||
    existing.retrieval_options?.keyword_match_mode !== "or" ||
    (existing.retrieval_options?.boost_by?.length ?? 0) !== 0 ||
    existing.rewrite_query === true ||
    (config.reranking ? existing.reranking !== true : existing.reranking === true) ||
    existing.chunk_size !== 512 ||
    existing.chunk_overlap !== 0 ||
    existing.score_threshold !== 0.4 ||
    existing.max_num_results !== config.maxResults ||
    existing.cache !== false ||
    !customMetadataMatches(existing.custom_metadata);
}

async function reconcileInstance(
  instance: AiSearchInstance,
  existing: AiSearchInstanceInfo,
  config: AiSearchRuntimeConfig,
): Promise<AiSearchInstance> {
  if (instanceConfigDrift(existing, config)) {
    // update() accepts a partial create configuration, but the instance ID and
    // source fields are immutable and must not be sent back in the update body.
    await instance.update(desiredInstanceSettings(config));
  }
  return instance;
}

async function openOrCreateInstance(
  namespace: AiSearchNamespace,
  config: AiSearchRuntimeConfig,
): Promise<AiSearchInstance> {
  try {
    const instance = namespace.get(config.instanceName);
    try {
      return await reconcileInstance(instance, await instance.info(), config);
    } catch (error) {
      if (!instanceNotFound(error)) throw error;
    }

    try {
      return await namespace.create(desiredCreateConfig(config));
    } catch (error) {
      // Two cold isolates can observe the instance as absent and create it at
      // the same time. Only the provider's documented name-conflict is safe to
      // recover; auth, quota, validation, and outage errors remain failures.
      if (!instanceAlreadyExists(error)) throw error;
      const raced = namespace.get(config.instanceName);
      return await reconcileInstance(raced, await raced.info(), config);
    }
  } catch (_error) {
    // The namespace/instance Workers binding authorizes built-in Items storage
    // without an application-managed API token. A service API token is only
    // needed for an R2-backed AI Search data source, which NotesFlash does not
    // use. Do not misdiagnose provider auth/outage errors as a missing user
    // configuration step.
    throw new AppError(
      503,
      "AI_SEARCH_UNAVAILABLE",
      "Cloudflare AI Search is temporarily unavailable.",
    );
  }
}

export async function aiSearchInstance(
  env: Env,
  config = aiSearchConfig(env),
): Promise<AiSearchInstance> {
  if (!config.enabled || !env.AI_SEARCH) {
    throw new AppError(
      503,
      "AI_SEARCH_SETUP_REQUIRED",
      "Cloudflare AI Search is not bound to this Worker.",
    );
  }
  // Binding handles and promises that resolve to them are request-scoped I/O
  // objects. Module-level caching survives isolate reuse and makes a later
  // HTTP/Queue invocation fail with "Cannot perform I/O on behalf of a
  // different request." Open a fresh handle for every invocation instead.
  return openOrCreateInstance(env.AI_SEARCH, config);
}

interface TranslationResult {
  effectiveQuery: string;
  translatedQuery: string | null;
  attempted: boolean;
  failed: boolean;
  durationMs: number;
}

function translationPair(query: string): { source: "en" | "zh"; target: "zh" | "en" } | null {
  const codepoints = [...query];
  if (codepoints.length > MAX_TRANSLATED_QUERY_CODEPOINTS) return null;
  const hasHan = codepoints.some((character) => /\p{Script=Han}/u.test(character));
  const hasLatin = codepoints.some((character) => /[A-Za-z]/.test(character));
  // Translating a mixed technical command can rewrite identifiers and degrade
  // exact keyword retrieval. Keep mixed/long queries intact; AI Search's
  // multilingual vector index still receives the original text.
  if (hasHan === hasLatin) return null;
  if (hasHan) return { source: "zh", target: "en" };
  if (hasLatin) return { source: "en", target: "zh" };
  return null;
}

async function translateQuery(
  env: Env,
  query: string,
  enabled: boolean,
): Promise<TranslationResult> {
  const started = performance.now();
  const pair = enabled ? translationPair(query) : null;
  if (!pair) {
    return {
      effectiveQuery: query,
      translatedQuery: null,
      attempted: false,
      failed: false,
      durationMs: performance.now() - started,
    };
  }
  try {
    const response = await env.AI.run("@cf/meta/m2m100-1.2b", {
      text: query,
      source_lang: pair.source,
      target_lang: pair.target,
    });
    const translated = response && typeof response === "object" &&
        typeof (response as Record<string, unknown>).translated_text === "string"
      ? String((response as Record<string, unknown>).translated_text).trim()
      : "";
    const normalized = translated.normalize("NFKC").toLocaleLowerCase();
    const original = query.normalize("NFKC").toLocaleLowerCase();
    return {
      effectiveQuery: translated.length > 0 && normalized !== original
        ? `${query}\n${translated}`
        : query,
      translatedQuery: translated.length > 0 && normalized !== original ? translated : null,
      attempted: true,
      failed: translated.length === 0,
      durationMs: performance.now() - started,
    };
  } catch (error) {
    console.warn("AI Search query translation failed", error instanceof Error ? error.name : "error");
    return {
      effectiveQuery: query,
      translatedQuery: null,
      attempted: true,
      failed: true,
      durationMs: performance.now() - started,
    };
  }
}

interface AiSearchCandidate {
  rank: number;
  score: number;
  key: string;
  indexHash: string;
}

export interface AiSearchRetrieval {
  results: SearchResult[];
  providerSearchQuery: string;
  effectiveQuery: string;
  translatedQuery: string | null;
  translationAttempted: boolean;
  translationFailed: boolean;
  responseChunkCount: number;
  providerCandidateCount: number;
  providerCandidateDiagnostics: Record<string, unknown>;
  validItemCount: number;
  matchedNoteCount: number;
  timings: {
    translationMs: number;
    searchMs: number;
    resolveMs: number;
    hydrateMs: number;
    totalMs: number;
  };
}

function providerValueType(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

function providerCandidates(response: AiSearchSearchResponse): {
  candidates: AiSearchCandidate[];
  diagnostics: Record<string, unknown>;
} {
  if (!response || !Array.isArray(response.chunks)) {
    throw new AppError(503, "INVALID_AI_SEARCH_RESPONSE", "Cloudflare AI Search returned invalid data.");
  }
  const candidates: AiSearchCandidate[] = [];
  const seenKeys = new Set<string>();
  const counts = {
    missingKey: 0,
    duplicateKey: 0,
    invalidScore: 0,
    invalidSchemaVersion: 0,
    invalidIndexHash: 0,
    accepted: 0,
    acceptedNotesFlashKeyShape: 0,
  };
  const metadataFields = new Set<string>();
  const schemaVersionTypes = new Set<string>();
  const indexHashTypes = new Set<string>();
  response.chunks.forEach((chunk, rank) => {
    const score = chunk?.score;
    const key = chunk?.item?.key;
    const metadata = chunk?.item?.metadata;
    const schemaVersion = metadata?.schema_version;
    const indexHash = metadata?.index_hash;
    if (metadata && typeof metadata === "object") {
      Object.keys(metadata).forEach((field) => metadataFields.add(field));
    }
    schemaVersionTypes.add(providerValueType(schemaVersion));
    indexHashTypes.add(providerValueType(indexHash));
    if (typeof key !== "string" || key.length === 0) {
      counts.missingKey += 1;
      return;
    }
    if (seenKeys.has(key)) {
      counts.duplicateKey += 1;
      return;
    }
    if (typeof score !== "number" || !Number.isFinite(score) || score < 0 || score > 1) {
      counts.invalidScore += 1;
      return;
    }
    if (
      schemaVersion !== AI_SEARCH_ITEM_SCHEMA_VERSION &&
      schemaVersion !== String(AI_SEARCH_ITEM_SCHEMA_VERSION)
    ) {
      counts.invalidSchemaVersion += 1;
      return;
    }
    if (typeof indexHash !== "string") {
      counts.invalidIndexHash += 1;
      return;
    }
    seenKeys.add(key);
    candidates.push({ rank, score, key, indexHash });
    counts.accepted += 1;
    if (/^nf_[a-f0-9]{20}_(?:title|body_\d+(?:_part_\d+)?)_[a-f0-9]{64}\.txt$/.test(key)) {
      counts.acceptedNotesFlashKeyShape += 1;
    }
  });
  return {
    candidates,
    diagnostics: {
      ...counts,
      metadataFields: [...metadataFields].sort(),
      schemaVersionTypes: [...schemaVersionTypes].sort(),
      indexHashTypes: [...indexHashTypes].sort(),
    },
  };
}

function mappingMatch(row: AiSearchItemRow, note: NoteRow, score: number): SearchMatch | null {
  if (note.deleted_at !== null || note.content_hash !== row.note_content_hash) return null;
  if (note.ai_search_status !== "ready" || note.ai_search_indexed_content_hash !== note.content_hash) {
    return null;
  }
  if (row.kind === "title") {
    const text = note.title.trim();
    if (row.raw_line_index !== null || text.length === 0 || text !== row.text) return null;
    return {
      kind: "title",
      lineNumber: null,
      rawLineIndex: null,
      lineStart: null,
      lineEnd: null,
      charStart: null,
      charEnd: null,
      score,
      text,
    };
  }
  if (
    row.raw_line_index === null ||
    row.char_start === null ||
    row.char_end === null ||
    !Number.isSafeInteger(row.char_start) ||
    !Number.isSafeInteger(row.char_end) ||
    row.char_start < 0 ||
    row.char_end <= row.char_start
  ) return null;
  const line = currentLineSlice(note.body, row.raw_line_index);
  if (
    !line ||
    row.char_start < line.charStart ||
    row.char_end > line.charEnd ||
    note.body.slice(row.char_start, row.char_end) !== row.text
  ) return null;
  return {
    kind: "body",
    lineNumber: line.lineNumber,
    rawLineIndex: row.raw_line_index,
    lineStart: line.lineNumber,
    lineEnd: line.lineNumber,
    charStart: row.char_start,
    charEnd: row.char_end,
    score,
    text: row.text,
  };
}

export async function searchAiSearchNotes(
  env: Env,
  query: string,
  requestedTopK?: number,
): Promise<AiSearchRetrieval> {
  const totalStarted = performance.now();
  const config = aiSearchConfig(env);
  const topK = Math.min(requestedTopK ?? config.topK, config.topK);
  const [instance, translation] = await Promise.all([
    aiSearchInstance(env, config),
    translateQuery(env, query, config.queryTranslation),
  ]);

  const searchStarted = performance.now();
  let response: AiSearchSearchResponse;
  try {
    response = await instance.search({
      query: translation.effectiveQuery,
      ai_search_options: {
        retrieval: {
          retrieval_type: "hybrid",
          fusion_method: "rrf",
          keyword_match_mode: "or",
          max_num_results: config.maxResults,
          context_expansion: 0,
          metadata_only: true,
          return_on_failure: false,
        },
        query_rewrite: { enabled: false },
        reranking: { enabled: config.reranking },
        cache: { enabled: false },
      },
    });
  } catch (error) {
    console.error("AI Search query failed", error instanceof Error ? error.name : "error");
    throw new AppError(
      503,
      "AI_SEARCH_UNAVAILABLE",
      "Cloudflare AI Search is temporarily unavailable.",
    );
  }
  const searchMs = performance.now() - searchStarted;
  const candidateParse = providerCandidates(response);
  const candidates = candidateParse.candidates;

  const resolveStarted = performance.now();
  const keys = candidates.map((candidate) => candidate.key);
  const mappings = keys.length === 0
    ? []
    : (await env.DB.prepare(
      `SELECT * FROM ai_search_items
       WHERE sync_state = 'ready'
         AND item_key IN (${keys.map(() => "?").join(",")})`,
    )
      .bind(...keys)
      .all<AiSearchItemRow>()).results;
  const mappingByKey = new Map(mappings.map((row) => [row.item_key, row]));
  const noteIds = [...new Set(mappings.map((row) => row.note_id))];
  const noteRows = noteIds.length === 0
    ? []
    : (await env.DB.prepare(
      `SELECT * FROM notes
       WHERE deleted_at IS NULL AND id IN (${noteIds.map(() => "?").join(",")})`,
    )
      .bind(...noteIds)
      .all<NoteRow>()).results;
  const noteById = new Map(noteRows.map((row) => [row.id, row]));

  const aggregated = new Map<string, {
    firstRank: number;
    score: number;
    matches: SearchMatch[];
    lineKeys: Set<string>;
  }>();
  for (const candidate of candidates) {
    const mapping = mappingByKey.get(candidate.key);
    if (!mapping || mapping.index_text_hash !== candidate.indexHash) continue;
    const note = noteById.get(mapping.note_id);
    if (!note) continue;
    const match = mappingMatch(mapping, note, candidate.score);
    if (!match) continue;
    const lineKey = `${match.kind}:${match.rawLineIndex ?? "title"}`;
    const current = aggregated.get(note.id) ?? {
      firstRank: candidate.rank,
      score: candidate.score,
      matches: [],
      lineKeys: new Set<string>(),
    };
    if (!current.lineKeys.has(lineKey) && current.matches.length < config.maxMatchesPerNote) {
      current.lineKeys.add(lineKey);
      current.matches.push(match);
    }
    aggregated.set(note.id, current);
  }
  const rankedIds = [...aggregated.entries()]
    .sort((left, right) => left[1].firstRank - right[1].firstRank)
    .slice(0, topK)
    .map(([noteId]) => noteId);
  const resolveMs = performance.now() - resolveStarted;

  const hydrateStarted = performance.now();
  const rankedRows = rankedIds
    .map((id) => noteById.get(id))
    .filter((row): row is NoteRow => row !== undefined);
  const hydrated = await hydrateNotes(env, rankedRows);
  const hydratedById = new Map(hydrated.map((note) => [note.id, note]));
  const results: SearchResult[] = rankedIds.flatMap((id) => {
    const note = hydratedById.get(id);
    const hit = aggregated.get(id);
    if (!note || !hit) return [];
    return [{ ...note, matchType: "semantic" as const, score: hit.score, matches: hit.matches }];
  });
  const hydrateMs = performance.now() - hydrateStarted;

  return {
    results,
    providerSearchQuery: typeof response.search_query === "string" ? response.search_query : "",
    effectiveQuery: translation.effectiveQuery,
    translatedQuery: translation.translatedQuery,
    translationAttempted: translation.attempted,
    translationFailed: translation.failed,
    responseChunkCount: response.chunks.length,
    providerCandidateCount: candidates.length,
    providerCandidateDiagnostics: candidateParse.diagnostics,
    validItemCount: mappings.length,
    matchedNoteCount: results.length,
    timings: {
      translationMs: translation.durationMs,
      searchMs,
      resolveMs,
      hydrateMs,
      totalMs: performance.now() - totalStarted,
    },
  };
}
