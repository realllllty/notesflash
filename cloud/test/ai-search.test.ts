import { describe, expect, it, vi } from "vitest";

import { buildAiSearchItems, type DesiredAiSearchItem } from "../src/ai-search-items";
import { searchAiSearchNotes } from "../src/ai-search";
import { semanticSearch } from "../src/search";
import type { AiSearchItemRow, Env, NoteRow, RequestContext } from "../src/types";

function note(id: string, title: string, body: string, overrides: Partial<NoteRow> = {}): NoteRow {
  const contentHash = overrides.content_hash ?? `hash-${id}`;
  return {
    rowid: Number.parseInt(id.replace(/\D/g, ""), 10) || 1,
    id,
    title,
    body,
    version: 1,
    content_hash: contentHash,
    mutation_id: null,
    created_at: 1,
    updated_at: 2,
    last_opened_at: null,
    pinned: 0,
    archived: 0,
    deleted_at: null,
    embedding_status: "ready",
    embedding_model: null,
    embedded_content_hash: null,
    embedding_vector_id: null,
    embedding_updated_at: null,
    embedding_error_code: null,
    ai_search_status: "ready",
    ai_search_indexed_content_hash: contentHash,
    ai_search_updated_at: 3,
    ai_search_error_code: null,
    ...overrides,
  };
}

function mapping(noteRow: NoteRow, item: DesiredAiSearchItem, overrides: Partial<AiSearchItemRow> = {}): AiSearchItemRow {
  return {
    item_key: item.itemKey,
    item_id: `provider-${item.itemIndex}-${noteRow.id}`,
    note_id: noteRow.id,
    note_content_hash: noteRow.content_hash,
    note_version: noteRow.version,
    item_index: item.itemIndex,
    kind: item.kind,
    raw_line_index: item.rawLineIndex,
    line_number: item.lineNumber,
    char_start: item.charStart,
    char_end: item.charEnd,
    text: item.text,
    index_text_hash: item.indexTextHash,
    sync_state: "ready",
    provider_status: "completed",
    error_code: null,
    upload_token: null,
    provider_scan_page: 1,
    provider_scan_pass: 0,
    provider_scan_total_count: null,
    created_at: 3,
    updated_at: 4,
    ...overrides,
  };
}

function providerChunk(row: AiSearchItemRow, score: number, overrides: Record<string, unknown> = {}) {
  return {
    id: `chunk-${row.item_key}`,
    type: "text",
    score,
    text: "provider text must never be trusted",
    item: {
      key: row.item_key,
      metadata: {
        schema_version: 1,
        index_hash: row.index_text_hash,
      },
    },
    ...overrides,
  };
}

interface HarnessOptions {
  notes?: NoteRow[];
  mappings?: AiSearchItemRow[];
  chunks?: unknown[];
  searchError?: Error;
  instanceInfoError?: unknown;
  createError?: unknown;
  existingOverrides?: Record<string, unknown>;
  translation?: string | Error;
  reverseDatabaseRows?: boolean;
  literal?: boolean;
  fallbackOnly?: boolean;
  env?: Record<string, string>;
}

function harness(options: HarnessOptions = {}) {
  const notes = options.notes ?? [];
  const mappings = options.mappings ?? [];
  const search = vi.fn(async () => {
    if (options.searchError) throw options.searchError;
    return { search_query: "provider-rewritten-query", chunks: options.chunks ?? [] };
  });
  const update = vi.fn(async () => ({}));
  const existing = {
    id: "notesflash-search",
    embedding_model: "@cf/google/embeddinggemma-300m",
    index_method: { vector: true, keyword: true },
    fusion_method: "rrf",
    indexing_options: { keyword_tokenizer: "trigram" },
    retrieval_options: { keyword_match_mode: "or" },
    rewrite_query: false,
    reranking: options.env?.AI_SEARCH_RERANKING === "true",
    chunk_size: 512,
    chunk_overlap: 0,
    score_threshold: 0.4,
    cache: false,
    max_num_results: Number(options.env?.AI_SEARCH_MAX_RESULTS ?? 50),
    custom_metadata: [
      { field_name: "schema_version", data_type: "number" },
      { field_name: "kind", data_type: "text" },
      { field_name: "raw_line_index", data_type: "number" },
      { field_name: "index_hash", data_type: "text" },
    ],
    ...options.existingOverrides,
  };
  let infoCalls = 0;
  const info = vi.fn(async () => {
    infoCalls += 1;
    if (infoCalls === 1 && options.instanceInfoError !== undefined) {
      throw options.instanceInfoError;
    }
    return existing;
  });
  const instance = {
    search,
    info,
    update,
    items: {},
    jobs: {},
  };
  const namespace = {
    list: vi.fn(),
    get: vi.fn(() => instance),
    create: vi.fn(async () => {
      if (options.createError !== undefined) throw options.createError;
      return instance;
    }),
  };
  const aiRun = vi.fn(async () => {
    if (options.translation instanceof Error) throw options.translation;
    return { translated_text: options.translation ?? "" };
  });
  const prepared: Array<{ sql: string; bound: unknown[] }> = [];
  const db = {
    prepare(sql: string) {
      let bound: unknown[] = [];
      return {
        bind(...values: unknown[]) {
          bound = values;
          return this;
        },
        async all() {
          prepared.push({ sql, bound });
          if (sql.includes("FROM ai_search_items")) {
            const keys = new Set(bound.map(String));
            const rows = mappings.filter((row) =>
              row.sync_state === "ready" && keys.has(row.item_key)
            );
            return { results: options.reverseDatabaseRows ? [...rows].reverse() : rows };
          }
          if (sql.includes("FROM notes") && sql.includes("deleted_at IS NULL")) {
            const ids = new Set(bound.map(String));
            const rows = notes.filter((row) => row.deleted_at === null && ids.has(row.id));
            return { results: options.reverseDatabaseRows ? [...rows].reverse() : rows };
          }
          if (sql.includes("FROM note_images")) return { results: [] };
          return { results: [] };
        },
        async first() {
          prepared.push({ sql, bound });
          if (sql.includes("FROM notes_fts") || sql.includes("instr(lower(title)")) {
            return options.literal ? { found: 1 } : null;
          }
          return null;
        },
        async run() {
          prepared.push({ sql, bound });
          return { meta: { changes: 1 } };
        },
      };
    },
  };

  const env = {
    DB: db,
    AI: { run: aiRun },
    AI_SEARCH: namespace,
    SEMANTIC_BACKEND: "ai-search",
    ...options.env,
  } as unknown as Env;
  const request = new Request("https://notes.example/api/search/semantic", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query: "entry", limit: 8, fallbackOnly: options.fallbackOnly }),
  });
  const requestContext = {
    env,
    request,
    url: new URL(request.url),
    requestId: "ai-search-handler-test",
    principal: { deviceId: "device-1", deviceName: "test", sessionId: "session-1" },
  } as RequestContext;
  return { env, requestContext, search, info, update, existing, namespace, aiRun, prepared };
}

function notFoundError(): Error & { code: number } {
  return Object.assign(new Error("AI Search instance not found"), {
    name: "AiSearchNotFoundError",
    code: 7002,
  });
}

describe("Cloudflare AI Search instance ensure", () => {
  it("reads the complete instance configuration through get(name).info without listing", async () => {
    const test = harness({
      env: { AI_SEARCH_QUERY_TRANSLATION: "false" },
    });

    await searchAiSearchNotes(test.env, "entry");

    expect(test.namespace.get).toHaveBeenCalledOnce();
    expect(test.namespace.get).toHaveBeenCalledWith("notesflash-search");
    expect(test.info).toHaveBeenCalledOnce();
    expect(test.namespace.list).not.toHaveBeenCalled();
    expect(test.namespace.create).not.toHaveBeenCalled();
    expect(test.update).not.toHaveBeenCalled();
  });

  it("creates built-in Items storage only after a documented NotFound", async () => {
    const test = harness({
      instanceInfoError: notFoundError(),
      env: { AI_SEARCH_QUERY_TRANSLATION: "false" },
    });

    await searchAiSearchNotes(test.env, "entry");

    expect(test.namespace.create).toHaveBeenCalledOnce();
    const create = test.namespace.create.mock.calls[0][0] as Record<string, unknown>;
    expect(create).toMatchObject({
      id: "notesflash-search",
      embedding_model: "@cf/google/embeddinggemma-300m",
      index_method: { vector: true, keyword: true },
      fusion_method: "rrf",
      indexing_options: { keyword_tokenizer: "trigram" },
      retrieval_options: { keyword_match_mode: "or" },
      rewrite_query: false,
      reranking: false,
      chunk_size: 512,
      chunk_overlap: 0,
      score_threshold: 0.4,
      max_num_results: 50,
      cache: false,
      custom_metadata: expect.arrayContaining([
        { field_name: "schema_version", data_type: "number" },
        { field_name: "index_hash", data_type: "text" },
      ]),
    });
    expect(create).not.toHaveProperty("type");
    expect(create).not.toHaveProperty("source");
    expect(create).not.toHaveProperty("token_id");
    expect(create).not.toHaveProperty("chunk");
  });

  it("recovers a concurrent create 7022 race by opening and reconciling the winner", async () => {
    const test = harness({
      instanceInfoError: notFoundError(),
      createError: { code: 7022, message: "ai_search_with_this_name_already_exist" },
      env: { AI_SEARCH_QUERY_TRANSLATION: "false" },
    });

    await searchAiSearchNotes(test.env, "entry");

    expect(test.namespace.create).toHaveBeenCalledOnce();
    expect(test.namespace.get).toHaveBeenCalledTimes(2);
    expect(test.info).toHaveBeenCalledTimes(2);
    expect(test.search).toHaveBeenCalledOnce();
  });

  it.each([
    ["embedding model", { embedding_model: "@cf/legacy/model" }],
    ["vector index", { index_method: { vector: false, keyword: true } }],
    ["keyword index", { index_method: { vector: true, keyword: false } }],
    ["fusion", { fusion_method: "max" }],
    ["tokenizer", { indexing_options: { keyword_tokenizer: "porter" } }],
    ["keyword mode", { retrieval_options: { keyword_match_mode: "and" } }],
    ["retrieval boost", {
      retrieval_options: {
        keyword_match_mode: "or",
        boost_by: [{ field: "raw_line_index", direction: "asc" }],
      },
    }],
    ["query rewrite", { rewrite_query: true }],
    ["reranking", { reranking: true }],
    ["chunk size", { chunk_size: 128 }],
    ["chunk overlap", { chunk_overlap: 32 }],
    ["threshold", { score_threshold: 0.9 }],
    ["result limit", { max_num_results: 7 }],
    ["cache", { cache: true }],
    ["custom metadata", { custom_metadata: [{ field_name: "note_id", data_type: "text" }] }],
  ])("repairs %s drift using a mutable-settings-only update payload", async (_label, drift) => {
    const test = harness({
      existingOverrides: drift,
      env: { AI_SEARCH_QUERY_TRANSLATION: "false" },
    });

    await searchAiSearchNotes(test.env, "entry");

    expect(test.update).toHaveBeenCalledOnce();
    const update = test.update.mock.calls[0][0] as Record<string, unknown>;
    expect(update).toMatchObject({
      embedding_model: "@cf/google/embeddinggemma-300m",
      index_method: { vector: true, keyword: true },
      fusion_method: "rrf",
      indexing_options: { keyword_tokenizer: "trigram" },
      retrieval_options: { keyword_match_mode: "or" },
      rewrite_query: false,
      reranking: false,
      chunk_size: 512,
      chunk_overlap: 0,
      score_threshold: 0.4,
      max_num_results: 50,
      cache: false,
    });
    expect(update).not.toHaveProperty("id");
    expect(update).not.toHaveProperty("chunk");
    expect(update).not.toHaveProperty("type");
    expect(update).not.toHaveProperty("source");
    expect(update).not.toHaveProperty("source_params");
  });

  it("accepts equivalent custom metadata in provider-defined order", async () => {
    const expected = harness({ env: { AI_SEARCH_QUERY_TRANSLATION: "false" } });
    const reordered = [...(expected.existing.custom_metadata as Array<Record<string, unknown>>)]
      .reverse();
    const test = harness({
      existingOverrides: { custom_metadata: reordered },
      env: { AI_SEARCH_QUERY_TRANSLATION: "false" },
    });

    await searchAiSearchNotes(test.env, "entry");

    expect(test.update).not.toHaveBeenCalled();
  });

  it("does not create on provider auth, quota, validation, or outage failures", async () => {
    const test = harness({
      instanceInfoError: Object.assign(new Error("forbidden"), { code: 403 }),
      env: { AI_SEARCH_QUERY_TRANSLATION: "false" },
    });

    await expect(searchAiSearchNotes(test.env, "entry")).rejects.toMatchObject({
      status: 503,
      code: "AI_SEARCH_UNAVAILABLE",
    });
    expect(test.namespace.create).not.toHaveBeenCalled();
  });
});

describe("Cloudflare AI Search retrieval", () => {
  it("translates an English query and sends a fixed hybrid RRF request", async () => {
    const test = harness({ translation: "入口" });

    const result = await searchAiSearchNotes(test.env, "entry", 8);

    expect(test.aiRun).toHaveBeenCalledWith("@cf/meta/m2m100-1.2b", {
      text: "entry",
      source_lang: "en",
      target_lang: "zh",
    });
    expect(test.search).toHaveBeenCalledWith({
      query: "entry\n入口",
      ai_search_options: {
        retrieval: {
          retrieval_type: "hybrid",
          fusion_method: "rrf",
          keyword_match_mode: "or",
          max_num_results: 50,
          context_expansion: 0,
          metadata_only: true,
          return_on_failure: false,
        },
        query_rewrite: { enabled: false },
        reranking: { enabled: false },
        cache: { enabled: false },
      },
    });
    expect(result).toMatchObject({
      effectiveQuery: "entry\n入口",
      translatedQuery: "入口",
      translationAttempted: true,
      translationFailed: false,
      providerSearchQuery: "provider-rewritten-query",
    });
  });

  it("translates Chinese in the opposite direction and degrades to the original query on failure", async () => {
    const translated = harness({ translation: "entry" });
    const translatedResult = await searchAiSearchNotes(translated.env, "入口");
    expect(translated.aiRun).toHaveBeenCalledWith("@cf/meta/m2m100-1.2b", {
      text: "入口",
      source_lang: "zh",
      target_lang: "en",
    });
    expect(translatedResult.effectiveQuery).toBe("入口\nentry");

    const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    try {
      const failed = harness({ translation: new Error("translator unavailable") });
      const failedResult = await searchAiSearchNotes(failed.env, "entry");
      expect(failed.search.mock.calls[0][0]).toMatchObject({ query: "entry" });
      expect(failedResult).toMatchObject({
        effectiveQuery: "entry",
        translatedQuery: null,
        translationAttempted: true,
        translationFailed: true,
      });
    } finally {
      warning.mockRestore();
    }
  });

  it("keeps mixed technical queries intact instead of translating identifiers", async () => {
    const test = harness({ translation: "不应调用" });

    const result = await searchAiSearchNotes(test.env, "wrangler 迁移 --remote");

    expect(test.aiRun).not.toHaveBeenCalled();
    expect(test.search).toHaveBeenCalledWith(expect.objectContaining({
      query: "wrangler 迁移 --remote",
    }));
    expect(result).toMatchObject({
      translatedQuery: null,
      translationAttempted: false,
      translationFailed: false,
    });
  });

  it("preserves provider order while aggregating multiple logical lines per note", async () => {
    const first = note("note-a", "恢复说明", "第一行\n迁移入口在这里\n恢复入口也在这里");
    const second = note("note-b", "发布说明", "entry command lives here");
    const firstItems = await buildAiSearchItems({
      id: first.id,
      title: first.title,
      body: first.body,
      version: first.version,
      contentHash: first.content_hash,
    });
    const secondItems = await buildAiSearchItems({
      id: second.id,
      title: second.title,
      body: second.body,
      version: second.version,
      contentHash: second.content_hash,
    });
    const aLine1 = mapping(first, firstItems.find((item) => item.rawLineIndex === 1)!);
    const aLine2 = mapping(first, firstItems.find((item) => item.rawLineIndex === 2)!);
    const bLine0 = mapping(second, secondItems.find((item) => item.rawLineIndex === 0)!);
    const chunks = [
      providerChunk(aLine1, 0.31),
      providerChunk(bLine0, 0.99),
      providerChunk(aLine2, 0.88),
      providerChunk(aLine1, 0.97),
    ];
    const test = harness({
      notes: [first, second],
      mappings: [aLine1, aLine2, bLine0],
      chunks,
      translation: "入口",
      reverseDatabaseRows: true,
    });

    const result = await searchAiSearchNotes(test.env, "entry", 8);

    expect(result.results.map((hit) => [hit.id, hit.score])).toEqual([
      ["note-a", 0.31],
      ["note-b", 0.99],
    ]);
    expect(result.results[0].matches?.map((match) => [
      match.rawLineIndex,
      match.lineNumber,
      match.text,
      match.score,
    ])).toEqual([
      [1, 2, "迁移入口在这里", 0.31],
      [2, 3, "恢复入口也在这里", 0.88],
    ]);
    for (const match of result.results[0].matches ?? []) {
      expect(first.body.slice(match.charStart ?? -1, match.charEnd ?? -1)).toBe(match.text);
    }
    expect(result).toMatchObject({
      responseChunkCount: 4,
      validItemCount: 3,
      matchedNoteCount: 2,
    });
  });

  it("returns the exact current D1 subrange when a very long logical line was split", async () => {
    const current = note("split-line", "迁移", "prefix 迁移 suffix");
    const bodyItem = (await buildAiSearchItems({
      id: current.id,
      title: current.title,
      body: current.body,
      version: current.version,
      contentHash: current.content_hash,
    })).find((item) => item.kind === "body")!;
    const part = mapping(current, bodyItem, {
      text: "迁移",
      char_start: 7,
      char_end: 9,
      index_text_hash: "split-part-hash",
    });
    const test = harness({
      notes: [current],
      mappings: [part],
      chunks: [providerChunk(part, 0.8)],
      translation: "migration",
    });

    const result = await searchAiSearchNotes(test.env, "入口");

    expect(result.results[0].matches?.[0]).toMatchObject({
      rawLineIndex: 0,
      lineNumber: 1,
      charStart: 7,
      charEnd: 9,
      text: "迁移",
    });
    expect(current.body.slice(7, 9)).toBe(result.results[0].matches?.[0].text);
  });

  it("filters provider metadata, stale mappings, stale note versions, and invalid anchors", async () => {
    const staleHash = note("stale-hash", "标题", "当前正文");
    const pending = note("pending", "标题", "等待索引", { ai_search_status: "processing" });
    const staleReadyHash = note("stale-ready", "标题", "当前正文", {
      ai_search_indexed_content_hash: "old-content-hash",
    });
    const changedText = note("changed-text", "标题", "当前正文");
    const imageLine = note("image-line", "标题", "[[notesflash-image:image_1]]");
    const outOfRange = note("out-of-range", "标题", "唯一一行");
    const rows: AiSearchItemRow[] = [
      mapping(staleHash, (await buildAiSearchItems({
        id: staleHash.id, title: staleHash.title, body: staleHash.body,
        version: 1, contentHash: staleHash.content_hash,
      }))[1], { note_content_hash: "old-content-hash" }),
      mapping(pending, (await buildAiSearchItems({
        id: pending.id, title: pending.title, body: pending.body,
        version: 1, contentHash: pending.content_hash,
      }))[1]),
      mapping(staleReadyHash, (await buildAiSearchItems({
        id: staleReadyHash.id, title: staleReadyHash.title, body: staleReadyHash.body,
        version: 1, contentHash: staleReadyHash.content_hash,
      }))[1]),
      mapping(changedText, (await buildAiSearchItems({
        id: changedText.id, title: changedText.title, body: changedText.body,
        version: 1, contentHash: changedText.content_hash,
      }))[1], { text: "旧正文" }),
      mapping(imageLine, (await buildAiSearchItems({
        id: imageLine.id, title: imageLine.title, body: "可索引正文",
        version: 1, contentHash: imageLine.content_hash,
      }))[1], { raw_line_index: 0, text: "[[notesflash-image:image_1]]" }),
      mapping(outOfRange, (await buildAiSearchItems({
        id: outOfRange.id, title: outOfRange.title, body: outOfRange.body,
        version: 1, contentHash: outOfRange.content_hash,
      }))[1], { raw_line_index: 99, line_number: 100 }),
    ];
    const chunks = rows.map((row, index) => providerChunk(row, 0.9 - index * 0.01));
    chunks.unshift({
      id: "bad-schema",
      type: "text",
      score: 1,
      text: "ignored",
      item: { key: "bad-schema", metadata: { schema_version: 999, index_hash: "hash" } },
    });
    const test = harness({
      notes: [staleHash, pending, staleReadyHash, changedText, imageLine, outOfRange],
      mappings: rows,
      chunks,
      translation: "入口",
    });

    const result = await searchAiSearchNotes(test.env, "entry");

    expect(result.results).toEqual([]);
    expect(result.responseChunkCount).toBe(7);
    expect(result.matchedNoteCount).toBe(0);
  });

  it("fails closed when provider retrieval fails or returns a malformed response", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      const unavailable = harness({
        searchError: new Error("provider unavailable"),
        translation: "入口",
      });
      await expect(searchAiSearchNotes(unavailable.env, "entry")).rejects.toMatchObject({
        status: 503,
        code: "AI_SEARCH_UNAVAILABLE",
      });

      const malformed = harness({ translation: "入口" });
      malformed.search.mockResolvedValueOnce({ search_query: "entry" } as never);
      await expect(searchAiSearchNotes(malformed.env, "entry")).rejects.toMatchObject({
        status: 503,
        code: "INVALID_AI_SEARCH_RESPONSE",
      });
    } finally {
      error.mockRestore();
    }
  });

  it("distinguishes a missing Workers binding from provider open/create failures", async () => {
    const missingBinding = {
      AI: { run: vi.fn() },
      SEMANTIC_BACKEND: "ai-search",
    } as unknown as Env;
    await expect(searchAiSearchNotes(missingBinding, "entry")).rejects.toMatchObject({
      status: 503,
      code: "AI_SEARCH_SETUP_REQUIRED",
    });

    const providerFailure = harness({
      instanceInfoError: new Error("forbidden provider response"),
      translation: "入口",
    });
    await expect(searchAiSearchNotes(providerFailure.env, "entry")).rejects.toMatchObject({
      status: 503,
      code: "AI_SEARCH_UNAVAILABLE",
    });
  });
});

describe("AI Search semantic handler integration", () => {
  it("ignores fallbackOnly=false without opening AI Search or translating on a literal hit", async () => {
    const test = harness({ literal: true, translation: "入口", fallbackOnly: false });

    const payload = await (await semanticSearch(test.requestContext)).json() as Record<string, unknown>;

    expect(payload).toMatchObject({
      strategy: "lexical-first",
      semanticBackend: "ai-search",
      semanticSkipped: true,
      reason: "literal-match-exists",
      results: [],
    });
    expect(test.namespace.get).not.toHaveBeenCalled();
    expect(test.info).not.toHaveBeenCalled();
    expect(test.search).not.toHaveBeenCalled();
    expect(test.aiRun).not.toHaveBeenCalled();
  });

  it("reports provider-order hybrid RRF results without exposing query or translation text", async () => {
    const current = note("handler-note", "恢复说明", "迁移入口位于设置页面");
    const item = (await buildAiSearchItems({
      id: current.id,
      title: current.title,
      body: current.body,
      version: current.version,
      contentHash: current.content_hash,
    })).find((candidate) => candidate.kind === "body")!;
    const row = mapping(current, item);
    const test = harness({
      notes: [current],
      mappings: [row],
      chunks: [providerChunk(row, 0.72)],
      translation: "入口",
    });

    const payload = await (await semanticSearch(test.requestContext)).json() as Record<string, unknown>;
    const serialized = JSON.stringify(payload);

    expect(payload).toMatchObject({
      query: "entry",
      strategy: "semantic-fallback",
      semanticBackend: "ai-search",
      rankingStrategy: "cloudflare-ai-search-hybrid-rrf",
      rankingSource: "provider-order",
      comparisonScope: "logical-line-items",
      retrieval: {
        type: "hybrid",
        fusionMethod: "rrf",
        keywordMatchMode: "or",
        reranking: false,
      },
      translation: {
        enabled: true,
        attempted: true,
        applied: true,
        failed: false,
      },
      matchedNoteCount: 1,
    });
    expect((payload.results as Array<{ id: string }>).map((result) => result.id)).toEqual([
      "handler-note",
    ]);
    expect(serialized).not.toContain("effectiveQuery");
    expect(serialized).not.toContain("translatedQuery");
    expect(serialized).not.toContain("providerSearchQuery");
  });

  it("surfaces provider failure as a 503 AppError instead of an empty successful search", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      const test = harness({
        searchError: new Error("provider unavailable"),
        translation: "入口",
      });
      await expect(semanticSearch(test.requestContext)).rejects.toMatchObject({
        status: 503,
        code: "AI_SEARCH_UNAVAILABLE",
      });
    } finally {
      error.mockRestore();
    }
  });
});
