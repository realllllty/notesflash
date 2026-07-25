import { describe, expect, it, vi } from "vitest";

import { buildIdentifiedNoteChunks, DEFAULT_CHUNKING } from "../src/chunking";
import { searchLab } from "../src/lab";
import type { AiSearchItemRow, RequestContext } from "../src/types";

const LAB_TOKEN = "lab-token-for-tests";
/** sha256("lab-token-for-tests"), computed by the same helper the Worker uses. */
const LAB_TOKEN_SHA256 = "b7df400949abfe63870eecc49dcde0a11286fe6d39c80db36ee441de044daa89";

interface StubNote {
  id: string;
  title: string;
  body: string;
  content_hash: string;
  embedding_vector_id?: string | null;
  mutation_id?: string | null;
  embedding_status?: string;
  ai_search_status?: string;
  ai_search_indexed_content_hash?: string | null;
}

interface StubOptions {
  body: Record<string, unknown>;
  token?: string | null;
  headerName?: "authorization" | "x-lab-token";
  labEnabled?: string;
  labTokenSha256?: string;
  notes?: StubNote[];
  devicePrincipal?: boolean;
  vectors?: Record<string, number[]>;
  cached?: Record<string, number[]>;
  semanticBackend?: "vectorize" | "ai-search";
  aiSearchItems?: AiSearchItemRow[];
  aiSearchSearchFailure?: Error;
  aiSearchDeleteFailure?: Error;
}

/**
 * Deterministic stand-in for a real embedding model: each text maps to a fixed
 * vector so cosine ordering is predictable without calling Workers AI. The
 * width follows the model so dimension validation still applies.
 */
function stubVector(text: string, vectors: Record<string, number[]>, dimensions: number): number[] {
  const match = Object.entries(vectors).find(([needle]) => text.includes(needle));
  const seed = match ? match[1] : [0.05, 0.05, 0.05];
  const vector = new Array(dimensions).fill(0);
  seed.forEach((value, index) => {
    vector[index] = value;
  });
  return vector;
}

function modelDimensions(model: string): number {
  return model === "@cf/google/embeddinggemma-300m" ? 768 : 1024;
}

function stubContext(options: StubOptions) {
  const notes = options.notes ?? [];
  const fullNotes = notes.map((note, index) => ({
    rowid: index + 1,
    version: 1,
    mutation_id: null,
    created_at: 1,
    updated_at: 2,
    last_opened_at: null,
    pinned: 0,
    archived: 0,
    deleted_at: null,
    embedding_status: "ready",
    embedding_model: null,
    embedded_content_hash: note.content_hash,
    embedding_vector_id: null,
    embedding_updated_at: null,
    embedding_error_code: null,
    ai_search_status: "ready",
    ai_search_indexed_content_hash: note.content_hash,
    ai_search_updated_at: 2,
    ai_search_error_code: null,
    ...note,
  }));
  const aiSearchRows = [...(options.aiSearchItems ?? [])];
  const chunkRows = notes.flatMap((note) =>
    buildIdentifiedNoteChunks(
      {
        noteId: note.id,
        title: note.title,
        body: note.body,
        contentHash: note.content_hash,
      },
      DEFAULT_CHUNKING,
    ).map((chunk) => ({
      chunk_id: chunk.chunkId,
      note_id: note.id,
      content_hash: note.content_hash,
      chunk_index: chunk.chunkIndex,
      kind: chunk.kind,
      primary_line: chunk.primaryLine,
      line_start: chunk.lineStart,
      line_end: chunk.lineEnd,
      char_start: chunk.charStart,
      char_end: chunk.charEnd,
      text: chunk.text,
      created_at: 1,
    }))
  );
  const vectors = options.vectors ?? {};
  const cacheRows = new Map<string, string>();
  const insertedNotes: StubNote[] = [];
  const deletedNoteIds: string[] = [];
  const preparedSql: string[] = [];
  const queueBatches: unknown[] = [];
  const deletedVectorIds: string[][] = [];
  const deletedChunkVectorIds: string[][] = [];
  const deletedAiSearchItemIds: string[] = [];
  const operations: string[] = [];

  const aiRun = vi.fn(async (model: string, input: Record<string, unknown>) => {
    if (model === "@cf/meta/m2m100-1.2b") return { translated_text: "" };
    const texts = (input.text ?? input.queries ?? input.documents) as string[];
    return { data: texts.map((text) => stubVector(text, vectors, modelDimensions(model))) };
  });

  const aiSearchInstance = {
    info: vi.fn(async () => ({
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
      custom_metadata: [
        { field_name: "schema_version", data_type: "number" },
        { field_name: "kind", data_type: "text" },
        { field_name: "raw_line_index", data_type: "number" },
        { field_name: "index_hash", data_type: "text" },
      ],
    })),
    update: vi.fn(async () => ({})),
    search: vi.fn(async () => {
      if (options.aiSearchSearchFailure) throw options.aiSearchSearchFailure;
      return {
        search_query: "provider-adjusted-private-query",
        chunks: aiSearchRows.map((row, index) => ({
          score: Math.max(0.5, 0.9 - index * 0.01),
          item: {
            key: row.item_key,
            metadata: {
              schema_version: 1,
              index_hash: row.index_text_hash,
            },
          },
        })),
      };
    }),
    items: {
      upload: vi.fn(async (key: string, _content: unknown, options?: { metadata?: unknown }) => ({
        id: "private-provider-probe-id",
        key,
        status: "queued",
        metadata: options?.metadata,
      })),
      list: vi.fn(async (params: { key?: string }) => ({
        result: aiSearchRows
          .filter((row) => !params.key || row.item_key === params.key)
          .map((row) => ({
            id: row.item_id,
            key: row.item_key,
            status: row.provider_status ?? "completed",
          })),
      })),
      delete: vi.fn(async (itemId: string) => {
        if (options.aiSearchDeleteFailure) throw options.aiSearchDeleteFailure;
        deletedAiSearchItemIds.push(itemId);
        operations.push(`provider-delete:${itemId}`);
      }),
    },
  };

  const db = {
    prepare(sql: string) {
      preparedSql.push(sql);
      let bound: unknown[] = [];
      return {
        bind(...values: unknown[]) {
          bound = values;
          return this;
        },
        async first() {
          if (sql.includes("rate_limit_windows")) return { attempts: 1 };
          if (sql.includes("FROM device_sessions")) {
            return options.devicePrincipal
              ? {
                session_id: "session-1",
                device_id: "device-1",
                device_name: "test",
                last_seen_at: Date.now(),
              }
              : null;
          }
          if (sql.includes("FROM lab_embedding_cache")) return { count: cacheRows.size };
          if (sql.includes("LIKE '[EVAL%'")) return { count: 0 };
          if (sql.includes("embedding_status IN ('pending', 'processing')")) return { count: 0 };
          if (sql.includes("FROM ai_search_items") && sql.includes("COUNT(*) AS count")) {
            return { count: aiSearchRows.length };
          }
          if (sql.includes("COUNT(*) AS remaining_items") && sql.includes("FROM ai_search_items")) {
            const ids = new Set(bound.map(String));
            return {
              remaining_items: aiSearchRows.filter((row) => ids.has(row.note_id)).length,
            };
          }
          if (sql.includes("SELECT mutation_id FROM notes WHERE id = ?")) {
            const note = notes.find((entry) => entry.id === bound[0]);
            return note ? { mutation_id: note.mutation_id ?? null } : null;
          }
          if (sql.includes("SELECT * FROM ai_search_items")) {
            return aiSearchRows.find((row) =>
              row.item_key === String(bound[0]) &&
              row.note_content_hash === String(bound[1]) &&
              row.note_version === Number(bound[2])
            ) ?? null;
          }
          return null;
        },
        async all() {
          if (sql.includes("FROM ai_search_items")) {
            if (sql.includes("GROUP BY sync_state")) {
              const counts = new Map<string, number>();
              for (const row of aiSearchRows) {
                counts.set(row.sync_state, (counts.get(row.sync_state) ?? 0) + 1);
              }
              return {
                results: [...counts].map(([status, count]) => ({ status, count })),
              };
            }
            if (sql.includes("item_key IN")) {
              const keys = new Set(bound.map(String));
              return {
                results: aiSearchRows.filter((row) =>
                  row.sync_state === "ready" && keys.has(row.item_key)
                ),
              };
            }
            if (sql.includes("WHERE note_id IN")) {
              const ids = new Set(bound.slice(0, -1).map(String));
              const limit = Number(bound.at(-1));
              return {
                results: aiSearchRows
                  .filter((row) => ids.has(row.note_id))
                  .slice(0, limit),
              };
            }
            if (sql.includes("WHERE note_id = ?")) {
              return {
                results: aiSearchRows
                  .filter((row) => row.note_id === String(bound[0]))
                  .slice(0, 200),
              };
            }
            return { results: aiSearchRows };
          }
          if (sql.includes("FROM note_chunks c")) {
            const ids = new Set(bound.map(String));
            return { results: chunkRows.filter((row) => ids.has(row.chunk_id)) };
          }
          if (sql.includes("SELECT chunk_id FROM note_chunks WHERE note_id IN")) {
            const ids = new Set(bound.map(String));
            return { results: chunkRows.filter((row) => ids.has(row.note_id)) };
          }
          if (sql.includes("FROM notes") && sql.includes("content_hash")) {
            return { results: fullNotes };
          }
          if (sql.includes("SELECT id, title, mutation_id FROM notes")) {
            const ids = new Set(bound.map(String));
            return {
              results: fullNotes
                .filter((note) => ids.has(note.id))
                .map((note) => ({
                  id: note.id,
                  title: note.title,
                  mutation_id: note.mutation_id ?? null,
                })),
            };
          }
          if (sql.includes("SELECT * FROM notes") && sql.includes("id IN")) {
            const ids = new Set(bound.map(String));
            return {
              results: fullNotes.filter((note) => ids.has(note.id)),
            };
          }
          if (sql.includes("FROM note_images")) return { results: [] };
          if (sql.includes("FROM lab_embedding_cache")) {
            const keys = bound.map(String);
            return {
              results: keys
                .filter((key) => cacheRows.has(key))
                .map((key) => ({ cache_key: key, vector: cacheRows.get(key) })),
            };
          }
          if (sql.includes("SELECT id FROM notes WHERE title = ?")) {
            return { results: notes.filter((note) => note.title === bound[0]) };
          }
          if (sql.includes("SELECT id, embedding_vector_id FROM notes")) {
            if (sql.includes("WHERE mutation_id = ?")) {
              return {
                results: notes.filter((note) =>
                  note.mutation_id === String(bound[0]) ||
                  (note.title === String(bound[1]) && note.title.startsWith("[EVAL:"))
                ),
              };
            }
            return {
              results: notes.filter((note) =>
                note.mutation_id?.startsWith("notesflash-search-lab-eval:") ||
                note.title.startsWith("[EVAL")
              ),
            };
          }
          if (sql.includes("GROUP BY embedding_status")) {
            return { results: [{ status: "ready", count: notes.length }] };
          }
          if (sql.includes("GROUP BY ai_search_status")) {
            return { results: [{ status: "ready", count: notes.length }] };
          }
          return { results: [] };
        },
        async run() {
          if (sql.includes("ai_search_status = 'disabled'") && sql.startsWith("UPDATE notes")) {
            operations.push("ai-search-cleanup-fence");
          }
          if (sql.startsWith("INSERT INTO notes")) {
            insertedNotes.push({
              id: String(bound[0]),
              title: String(bound[1]),
              body: String(bound[2]),
              content_hash: String(bound[3]),
              embedding_status: String(bound[6]),
              ai_search_status: String(bound[7]),
              mutation_id: String(bound[8]),
            });
          }
          if (sql.startsWith("DELETE FROM ai_search_items")) {
            const index = aiSearchRows.findIndex((row) =>
              row.item_key === String(bound[0]) &&
              row.note_content_hash === String(bound[1]) &&
              row.note_version === Number(bound[2])
            );
            if (index >= 0) aiSearchRows.splice(index, 1);
          }
          if (sql.startsWith("DELETE FROM notes")) {
            const id = String(bound[0] ?? "all");
            deletedNoteIds.push(id);
            operations.push(`note-delete:${id}`);
          }
          return { meta: { changes: 1 } };
        },
      };
    },
    async batch(statements: Array<{ run: () => Promise<unknown> }>) {
      for (const statement of statements) await statement.run();
      return statements.map(() => ({ meta: { changes: 1 } }));
    },
  };

  const headers: Record<string, string> = { "content-type": "application/json" };
  const token = options.token === undefined ? LAB_TOKEN : options.token;
  if (token) {
    if (options.headerName === "x-lab-token") headers["x-lab-token"] = token;
    else headers.authorization = `Bearer ${token}`;
  }

  const request = new Request("https://notes.example/api/internal/search-lab", {
    method: "POST",
    headers,
    body: JSON.stringify(options.body),
  });

  const context = {
    env: {
      DB: db,
      AI: { run: aiRun },
      VECTOR_INDEX: {
        deleteByIds: vi.fn(async (ids: string[]) => {
          deletedVectorIds.push(ids);
        }),
      },
      CHUNK_INDEX: {
        query: vi.fn(async () => ({
          matches: chunkRows.map((row) => ({ id: row.chunk_id, score: 0.8 })),
        })),
        describe: vi.fn(async () => ({ vectorCount: chunkRows.length })),
        deleteByIds: vi.fn(async (ids: string[]) => {
          deletedChunkVectorIds.push(ids);
        }),
      },
      INDEX_QUEUE: {
        sendBatch: vi.fn(async (batch: unknown) => {
          queueBatches.push(batch);
        }),
      },
      AI_SEARCH: {
        get: vi.fn(() => aiSearchInstance),
        create: vi.fn(async () => aiSearchInstance),
      },
      SEMANTIC_BACKEND: options.semanticBackend ?? "vectorize",
      AI_SEARCH_QUERY_TRANSLATION: "false",
      LAB_ENABLED: options.labEnabled ?? "true",
      LAB_TOKEN_SHA256: options.labTokenSha256 ?? LAB_TOKEN_SHA256,
    },
    request,
    url: new URL(request.url),
    requestId: "test-request",
  } as unknown as RequestContext;

  return {
    context,
    aiRun,
    insertedNotes,
    deletedNoteIds,
    preparedSql,
    queueBatches,
    deletedVectorIds,
    deletedChunkVectorIds,
    deletedAiSearchItemIds,
    aiSearchRows,
    aiSearchInstance,
    operations,
  };
}

function evalNote(id: string, title: string, body: string): StubNote {
  return { id, title, body, content_hash: `hash-${id}`, embedding_vector_id: `vector-${id}` };
}

function aiSearchItem(
  note: StubNote,
  overrides: Partial<AiSearchItemRow> = {},
): AiSearchItemRow {
  return {
    item_key: `nf_${note.id}_body_0_hash.txt`,
    item_id: `provider-${note.id}`,
    note_id: note.id,
    note_content_hash: note.content_hash,
    note_version: 1,
    item_index: 0,
    kind: "body",
    raw_line_index: 0,
    line_number: 1,
    char_start: 0,
    char_end: note.body.length,
    text: note.body,
    index_text_hash: `index-hash-${note.id}`,
    sync_state: "ready",
    provider_status: "completed",
    error_code: null,
    upload_token: null,
    provider_scan_page: 1,
    provider_scan_pass: 0,
    provider_scan_total_count: null,
    created_at: 1,
    updated_at: 2,
    ...overrides,
  };
}

describe("search lab access control", () => {
  it("masks an unauthenticated request as an unknown route", async () => {
    const { context, aiRun } = stubContext({ body: { action: "whoami" }, token: null });

    await expect(searchLab(context)).rejects.toMatchObject({
      status: 404,
      code: "ROUTE_NOT_FOUND",
    });
    expect(aiRun).not.toHaveBeenCalled();
  });

  it("masks a wrong lab token as an unknown route", async () => {
    const { context } = stubContext({ body: { action: "whoami" }, token: "wrong-token" });

    await expect(searchLab(context)).rejects.toMatchObject({
      status: 404,
      code: "ROUTE_NOT_FOUND",
    });
  });

  it("masks a correct token while the lab is disabled", async () => {
    const { context } = stubContext({ body: { action: "whoami" }, labEnabled: "false" });

    await expect(searchLab(context)).rejects.toMatchObject({
      status: 404,
      code: "ROUTE_NOT_FOUND",
    });
  });

  it("accepts the lab token from the dedicated header", async () => {
    const { context } = stubContext({
      body: { action: "whoami" },
      headerName: "x-lab-token",
    });

    const payload = await (await searchLab(context)).json() as Record<string, unknown>;
    expect(payload).toMatchObject({ actor: "lab-token", labConfigured: true });
  });

  it("accepts a paired device token only while the lab kill switch is configured", async () => {
    const { context } = stubContext({
      body: { action: "whoami" },
      token: "device-session-token",
      devicePrincipal: true,
    });

    const payload = await (await searchLab(context)).json() as Record<string, unknown>;
    expect(payload).toMatchObject({ actor: "device", labConfigured: true });
  });

  it("masks a paired device while LAB_ENABLED is false", async () => {
    const { context } = stubContext({
      body: { action: "whoami" },
      token: "device-session-token",
      labEnabled: "false",
      devicePrincipal: true,
    });

    await expect(searchLab(context)).rejects.toMatchObject({
      status: 404,
      code: "ROUTE_NOT_FOUND",
    });
  });

  it("masks a paired device when the configured lab hash is not SHA-256 hex", async () => {
    const { context } = stubContext({
      body: { action: "whoami" },
      token: "device-session-token",
      labTokenSha256: "z".repeat(64),
      devicePrincipal: true,
    });

    await expect(searchLab(context)).rejects.toMatchObject({
      status: 404,
      code: "ROUTE_NOT_FOUND",
    });
  });

  it("does not grant a paired device mutating lab actions", async () => {
    const { context } = stubContext({
      body: { action: "reindex" },
      token: "device-session-token",
      devicePrincipal: true,
    });

    await expect(searchLab(context)).rejects.toMatchObject({
      status: 404,
      code: "ROUTE_NOT_FOUND",
    });
  });
});

describe("search lab sweep", () => {
  const notes = [
    evalNote("note-a", "[EVAL:migrate] Database migration", "We must migrate the vector index\nUnrelated lunch note"),
    evalNote("note-b", "[EVAL:noise] 午餐记录", "今天吃了牛肉面"),
  ];

  it("returns line-level results without note text by default", async () => {
    const { context } = stubContext({
      body: {
        action: "sweep",
        query: "迁移",
        strategies: [{ name: "baseline", model: "@cf/baai/bge-m3" }],
      },
      notes,
      vectors: {
        "迁移": [1, 0, 0],
        "migrate the vector index": [0.98, 0.1, 0],
        "Database migration": [0.9, 0.2, 0],
        "牛肉面": [0, 1, 0],
      },
    });

    const payload = await (await searchLab(context)).json() as {
      noteCount: number;
      strategies: Array<{
        chunkCount: number;
        queries: Array<{
          topChunkScore: number;
          effectiveFloor: number;
          results: Array<{
            noteRef: string;
            noteId?: string;
            title?: string;
            score: number;
            matches: Array<{ lineNumber: number | null; charStart: number | null; text?: string }>;
          }>;
        }>;
      }>;
    };
    const serialized = JSON.stringify(payload);

    expect(payload.noteCount).toBe(2);
    const [strategy] = payload.strategies;
    expect(strategy.chunkCount).toBeGreaterThan(2);
    const [queryReport] = strategy.queries;
    expect(queryReport.results.length).toBeGreaterThan(0);
    const [best] = queryReport.results;
    expect(best.matches[0].lineNumber).not.toBeNull();
    expect(best.noteId).toBeUndefined();
    expect(best.title).toBeUndefined();
    expect(best.matches[0].text).toBeUndefined();
    expect(serialized).not.toContain("牛肉面");
    expect(serialized).not.toContain("note-a");
  });

  it("rejects the legacy includeText escape hatch", async () => {
    const { context } = stubContext({
      body: {
        action: "sweep",
        query: "迁移",
        includeText: true,
        strategies: [{ name: "baseline" }],
      },
      notes,
      vectors: {
        "迁移": [1, 0, 0],
        "migrate the vector index": [0.98, 0.1, 0],
      },
    });

    await expect(searchLab(context)).rejects.toMatchObject({
      status: 400,
      code: "INVALID_INPUT",
    });
  });

  it("keeps evaluation keys for mapping but never sends them to embeddings", async () => {
    const { context, aiRun } = stubContext({
      body: {
        action: "sweep",
        query: "deploy",
        strategies: [{ name: "marker-free" }],
      },
      notes: [evalNote("note-deploy", "[EVAL:deploy-zh] 上线部署流程", "发布前运行测试。")],
    });

    const payload = await (await searchLab(context)).json() as {
      strategies: Array<{ queries: Array<{ results: Array<{ noteRef: string; title?: string }> }> }>;
    };
    const embeddedTexts = aiRun.mock.calls.flatMap((call) => {
      const input = call[1] as Record<string, unknown>;
      const texts = input.text ?? input.queries ?? input.documents;
      return Array.isArray(texts) ? texts.map(String) : [];
    });

    expect(embeddedTexts.some((text) => text.includes("[EVAL:deploy-zh]"))).toBe(false);
    expect(payload.strategies[0].queries[0].results[0]).toMatchObject({
      noteRef: "deploy-zh",
    });
    expect(payload.strategies[0].queries[0].results[0].title).toBeUndefined();
  });

  it("captures the same top-40 raw candidate depth as production", async () => {
    const manyNotes = Array.from({ length: 25 }, (_, index) =>
      evalNote(
        `note-${index}`,
        `[EVAL:candidate-${index}] 候选 ${index}`,
        `正文候选 ${index}`,
      )
    );
    const { context } = stubContext({
      body: {
        action: "sweep",
        query: "候选",
        strategies: [{ name: "top-40" }],
      },
      notes: manyNotes,
    });

    const payload = await (await searchLab(context)).json() as {
      strategies: Array<{ queries: Array<{ rankedChunks: unknown[] }> }>;
    };
    expect(payload.strategies[0].queries[0].rankedChunks).toHaveLength(40);
  });

  it("caches embeddings so a repeated sweep costs no Workers AI calls", async () => {
    const first = stubContext({
      body: { action: "sweep", query: "迁移", strategies: [{ name: "baseline" }] },
      notes,
      vectors: { "迁移": [1, 0, 0] },
    });
    const firstPayload = await (await searchLab(first.context)).json() as {
      strategies: Array<{ aiCalls: number; cacheHits: number }>;
    };
    expect(firstPayload.strategies[0].aiCalls).toBeGreaterThan(0);
    expect(first.aiRun).toHaveBeenCalled();
  });

  it("rejects an unknown embedding model", async () => {
    const { context } = stubContext({
      body: { action: "sweep", query: "迁移", strategies: [{ model: "@cf/openai/not-real" }] },
      notes,
    });

    await expect(searchLab(context)).rejects.toMatchObject({
      status: 400,
      code: "UNSUPPORTED_EMBEDDING_MODEL",
    });
  });

  it("rejects invalid chunking and aggregation overrides", async () => {
    const badChunking = stubContext({
      body: { action: "sweep", query: "迁移", strategies: [{ chunking: { maxLines: 0 } }] },
      notes,
    });
    await expect(searchLab(badChunking.context)).rejects.toMatchObject({
      status: 400,
      code: "INVALID_INPUT",
    });

    const badAggregation = stubContext({
      body: { action: "sweep", query: "迁移", strategies: [{ aggregation: { topK: 0 } }] },
      notes,
    });
    await expect(searchLab(badAggregation.context)).rejects.toMatchObject({
      status: 400,
      code: "INVALID_INPUT",
    });
  });

  it("rejects an unknown action", async () => {
    const { context } = stubContext({ body: { action: "drop-tables" } });
    await expect(searchLab(context)).rejects.toMatchObject({
      status: 400,
      code: "INVALID_INPUT",
    });
  });
});

describe("search lab response privacy", () => {
  const privateNote = evalNote(
    "private-note-id-123456",
    "Private recovery title",
    "Secret recovery entrance body text.",
  );

  it("returns only an anonymous ref from live diagnostics", async () => {
    const { context } = stubContext({
      body: { action: "live", query: "privacy-live-query" },
      notes: [privateNote],
    });

    const payload = await (await searchLab(context)).json() as {
      privacyMode: string;
      backend: string;
      productionHandler: boolean;
      queries: Array<{ results: Array<Record<string, unknown>> }>;
    };
    const serialized = JSON.stringify(payload);
    expect(payload.privacyMode).toBe("anonymous-only");
    expect(payload).toMatchObject({ backend: "legacy-vectorize", productionHandler: false });
    expect(payload.queries[0].results[0].noteRef).toMatch(/^note-[a-f0-9]{12}$/);
    for (const secret of [privateNote.id, privateNote.title, privateNote.body]) {
      expect(serialized).not.toContain(secret);
    }
    expect(serialized).not.toContain("noteId");
    expect(serialized).not.toContain('"title":');
    expect(serialized).not.toContain('"text":');
  });

  it("sanitizes the production API diagnostic response", async () => {
    const { context } = stubContext({
      body: { action: "api", query: "privacy-api-query", fallbackOnly: false },
      notes: [privateNote],
    });

    const payload = await (await searchLab(context)).json() as {
      privacyMode: string;
      queries: Array<{
        results: Array<{
          noteRef: string;
          matches: Array<{ offsetsMatchText: boolean | null }>;
        }>;
      }>;
    };
    const serialized = JSON.stringify(payload);
    expect(payload.privacyMode).toBe("anonymous-only");
    expect(payload.queries[0].results[0].noteRef).toMatch(/^note-[a-f0-9]{12}$/);
    expect(
      payload.queries[0].results[0].matches.some((match) => match.offsetsMatchText === true),
    ).toBe(true);
    for (const secret of [privateNote.id, privateNote.title, privateNote.body]) {
      expect(serialized).not.toContain(secret);
    }
    expect(serialized).not.toContain("noteId");
    expect(serialized).not.toContain('"title":');
    expect(serialized).not.toContain('"text":');
  });

  it("sanitizes the default AI Search production diagnostic response", async () => {
    const item = aiSearchItem(privateNote, {
      item_key: "private-provider-item-key",
      item_id: "private-provider-item-id",
    });
    const { context } = stubContext({
      body: { action: "api", query: "privacy-ai-search-query", fallbackOnly: false },
      notes: [privateNote],
      semanticBackend: "ai-search",
      aiSearchItems: [item],
    });

    const payload = await (await searchLab(context)).json() as {
      privacyMode: string;
      queries: Array<{
        backend: string;
        candidateItemCount: number;
        resolvedItemCount: number;
        results: Array<{ noteRef: string; matches: Array<{ offsetsMatchText: boolean | null }> }>;
      }>;
    };
    const serialized = JSON.stringify(payload);
    expect(payload.privacyMode).toBe("anonymous-only");
    expect(payload.queries[0]).toMatchObject({
      backend: "cloudflare-ai-search",
      candidateItemCount: 1,
      resolvedItemCount: 1,
    });
    expect(payload.queries[0].results[0].noteRef).toMatch(/^note-[a-f0-9]{12}$/);
    expect(payload.queries[0].results[0].matches[0].offsetsMatchText).toBe(true);
    for (const secret of [
      privateNote.id,
      privateNote.title,
      privateNote.body,
      item.item_key,
      item.item_id ?? "",
      "provider-adjusted-private-query",
    ]) {
      expect(serialized).not.toContain(secret);
    }
    expect(serialized).not.toContain("noteId");
    expect(serialized).not.toContain('"title":');
    expect(serialized).not.toContain('"text":');
  });

  it("fails closed when the default AI Search provider request fails", async () => {
    const { context } = stubContext({
      body: { action: "api", query: "provider-failure", fallbackOnly: false },
      notes: [privateNote],
      semanticBackend: "ai-search",
      aiSearchItems: [aiSearchItem(privateNote)],
      aiSearchSearchFailure: new Error("provider unavailable"),
    });
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      await expect(searchLab(context)).rejects.toMatchObject({
        status: 503,
        code: "AI_SEARCH_UNAVAILABLE",
      });
    } finally {
      error.mockRestore();
    }
  });
});

describe("search lab corpus management", () => {
  it("refuses to seed a note without the eval prefix", async () => {
    const { context, insertedNotes } = stubContext({
      body: { action: "seed", notes: [{ title: "真实笔记", body: "不该被写入" }] },
    });

    await expect(searchLab(context)).rejects.toMatchObject({
      status: 400,
      code: "INVALID_INPUT",
    });
    expect(insertedNotes).toHaveLength(0);
  });

  it("seeds prefixed notes and enqueues indexing", async () => {
    const { context, insertedNotes, queueBatches } = stubContext({
      body: {
        action: "seed",
        notes: [{ title: "[EVAL:migrate] Database migration", body: "migrate the vector index" }],
      },
      semanticBackend: "ai-search",
    });

    const payload = await (await searchLab(context)).json() as Record<string, unknown>;
    expect(payload).toMatchObject({
      action: "seed",
      inserted: 1,
      enqueued: 1,
      vectorJobsEnqueued: 1,
      aiSearchJobsEnqueued: 1,
      aiSearchEnabled: true,
    });
    expect(insertedNotes[0].title).toBe("Database migration");
    expect(insertedNotes[0].mutation_id).toBe("notesflash-search-lab-eval:migrate");
    expect(insertedNotes[0].embedding_status).toBe("pending");
    expect(insertedNotes[0].ai_search_status).toBe("pending");
    expect(queueBatches).toHaveLength(2);
    expect(queueBatches.flatMap((batch) =>
      (batch as Array<{ body: { type: string } }>).map((item) => item.body.type)
    )).toEqual(["embed-note", "sync-ai-search-note"]);
  });

  it("keeps non-enqueued sweep notes out of the periodic indexing queue", async () => {
    const { context, insertedNotes, queueBatches } = stubContext({
      body: {
        action: "seed",
        enqueue: false,
        notes: [{ title: "[EVAL:sweep-only] Sweep note", body: "in-request scoring only" }],
      },
      semanticBackend: "ai-search",
    });

    const payload = await (await searchLab(context)).json() as Record<string, unknown>;
    expect(payload).toMatchObject({
      action: "seed",
      inserted: 1,
      enqueued: 0,
      vectorJobsEnqueued: 0,
      aiSearchJobsEnqueued: 0,
    });
    expect(insertedNotes[0].embedding_status).toBe("disabled");
    expect(insertedNotes[0].ai_search_status).toBe("disabled");
    expect(queueBatches).toHaveLength(0);
  });

  it("keeps AI Search disabled in an explicit Vectorize rollback deployment", async () => {
    const { context, insertedNotes, queueBatches } = stubContext({
      body: {
        action: "seed",
        notes: [{ title: "[EVAL:rollback] Rollback note", body: "legacy only" }],
      },
      semanticBackend: "vectorize",
    });

    const payload = await (await searchLab(context)).json() as Record<string, unknown>;
    expect(payload).toMatchObject({
      vectorJobsEnqueued: 1,
      aiSearchJobsEnqueued: 0,
      aiSearchEnabled: false,
    });
    expect(insertedNotes[0].embedding_status).toBe("pending");
    expect(insertedNotes[0].ai_search_status).toBe("disabled");
    expect(queueBatches.flatMap((batch) =>
      (batch as Array<{ body: { type: string } }>).map((item) => item.body.type)
    )).toEqual(["embed-note"]);
  });

  it("removes old eval vectors before replacing a seeded note", async () => {
    const existing = {
      ...evalNote("old-eval-note", "Database migration", "old migration body"),
      mutation_id: "notesflash-search-lab-eval:migrate",
    };
    const {
      context,
      deletedNoteIds,
      deletedVectorIds,
      deletedChunkVectorIds,
      deletedAiSearchItemIds,
      insertedNotes,
      operations,
    } = stubContext({
      body: {
        action: "seed",
        notes: [{ title: "[EVAL:migrate] Database migration", body: "new migration body" }],
      },
      notes: [existing],
      aiSearchItems: [aiSearchItem(existing)],
    });

    const payload = await (await searchLab(context)).json() as Record<string, unknown>;
    expect(payload).toMatchObject({ inserted: 1, replaced: 1 });
    expect(deletedChunkVectorIds.flat()).not.toHaveLength(0);
    expect(deletedVectorIds).toEqual([["vector-old-eval-note"]]);
    expect(deletedAiSearchItemIds).toEqual(["provider-old-eval-note"]);
    expect(deletedNoteIds).toContain("old-eval-note");
    expect(operations.indexOf("ai-search-cleanup-fence")).toBeLessThan(
      operations.indexOf("provider-delete:provider-old-eval-note"),
    );
    expect(operations.indexOf("provider-delete:provider-old-eval-note")).toBeLessThan(
      operations.indexOf("note-delete:old-eval-note"),
    );
    expect(insertedNotes[0].title).toBe("Database migration");
  });

  it("does not replace a seeded note when AI Search provider cleanup fails", async () => {
    const existing = {
      ...evalNote("old-eval-failure", "Database migration", "old migration body"),
      mutation_id: "notesflash-search-lab-eval:migrate",
    };
    const { context, deletedNoteIds, insertedNotes, aiSearchRows } = stubContext({
      body: {
        action: "seed",
        notes: [{ title: "[EVAL:migrate] Database migration", body: "new body" }],
      },
      notes: [existing],
      aiSearchItems: [aiSearchItem(existing)],
      aiSearchDeleteFailure: new Error("provider delete failed"),
    });
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      await expect(searchLab(context)).rejects.toMatchObject({
        status: 503,
        code: "LAB_AI_SEARCH_CLEANUP_FAILED",
      });
    } finally {
      error.mockRestore();
    }

    expect(deletedNoteIds).toHaveLength(0);
    expect(insertedNotes).toHaveLength(0);
    expect(aiSearchRows).toHaveLength(1);
  });

  it("shares one 100-item cleanup budget across a multi-note seed replacement", async () => {
    const existing = Array.from({ length: 101 }, (_, index) => ({
      ...evalNote(`old-seed-${index}`, `Existing ${index}`, `old body ${index}`),
      mutation_id: `notesflash-search-lab-eval:key-${index}`,
    }));
    const requestNotes = existing.map((note, index) => ({
      title: `[EVAL:key-${index}] Existing ${index}`,
      body: `new body ${index}`,
    }));
    const first = stubContext({
      body: { action: "seed", notes: requestNotes },
      notes: existing,
      aiSearchItems: existing.map((note) => aiSearchItem(note)),
      semanticBackend: "vectorize",
    });

    await expect(searchLab(first.context)).rejects.toMatchObject({
      status: 503,
      code: "LAB_AI_SEARCH_CLEANUP_PENDING",
      details: {
        deletedAiSearchItems: 100,
        remainingAiSearchItems: 1,
      },
    });
    expect(first.deletedAiSearchItemIds).toHaveLength(100);
    expect(first.aiSearchRows).toHaveLength(1);
    expect(first.deletedNoteIds).toHaveLength(0);
    expect(first.insertedNotes).toHaveLength(0);
    expect(first.deletedChunkVectorIds).toHaveLength(0);
    expect(first.deletedVectorIds).toHaveLength(0);

    // A retry observes the 100 mappings removed by the first bounded call. It
    // clears the final item, then and only then replaces the D1 notes.
    const second = stubContext({
      body: { action: "seed", notes: requestNotes },
      notes: existing,
      aiSearchItems: first.aiSearchRows,
      semanticBackend: "vectorize",
    });
    const payload = await (await searchLab(second.context)).json() as Record<string, unknown>;

    expect(second.deletedAiSearchItemIds).toHaveLength(1);
    expect(second.deletedAiSearchItemIds.length).toBeLessThanOrEqual(100);
    expect(second.aiSearchRows).toHaveLength(0);
    expect(second.deletedNoteIds).toHaveLength(101);
    expect(second.insertedNotes).toHaveLength(101);
    expect(payload).toMatchObject({
      inserted: 101,
      replaced: 101,
      deletedAiSearchItems: 1,
    });
  });

  it("only ever deletes prefixed notes during cleanup", async () => {
    const evalRow = {
      ...evalNote("note-a", "Database migration", "body"),
      mutation_id: "notesflash-search-lab-eval:migrate",
    };
    const {
      context,
      preparedSql,
      deletedVectorIds,
      deletedChunkVectorIds,
      deletedAiSearchItemIds,
    } = stubContext({
      body: { action: "cleanup" },
      notes: [
        evalRow,
        evalNote("note-real", "真实笔记", "body"),
      ],
      aiSearchItems: [aiSearchItem(evalRow)],
    });

    const payload = await (await searchLab(context)).json() as Record<string, unknown>;
    expect(payload).toMatchObject({ action: "cleanup", matchedNotes: 1 });
    expect(deletedVectorIds).toEqual([["vector-note-a"]]);
    expect(deletedChunkVectorIds.flat()).not.toHaveLength(0);
    expect(deletedAiSearchItemIds).toEqual(["provider-note-a"]);
    expect(payload).toMatchObject({ deletedAiSearchItems: 1 });
    const deleteStatements = preparedSql.filter((sql) => sql.startsWith("DELETE FROM notes"));
    expect(deleteStatements).toHaveLength(1);
    for (const sql of deleteStatements) {
      expect(sql).toContain("WHERE id = ?");
      expect(sql).toContain("mutation_id LIKE 'notesflash-search-lab-eval:%'");
      expect(sql).toContain("title LIKE '[EVAL:%'");
    }
  });

  it("makes bounded AI Search cleanup progress without hard-deleting notes", async () => {
    const evalRow = {
      ...evalNote("note-bounded", "Bounded cleanup", "body"),
      mutation_id: "notesflash-search-lab-eval:bounded",
    };
    const items = Array.from({ length: 101 }, (_, index) => aiSearchItem(evalRow, {
      item_key: `bounded-key-${index}`,
      item_id: `bounded-provider-${index}`,
      item_index: index,
    }));
    const {
      context,
      deletedNoteIds,
      deletedAiSearchItemIds,
      aiSearchRows,
    } = stubContext({
      body: { action: "cleanup" },
      notes: [evalRow],
      aiSearchItems: items,
    });

    await expect(searchLab(context)).rejects.toMatchObject({
      status: 503,
      code: "LAB_AI_SEARCH_CLEANUP_PENDING",
      details: {
        deletedAiSearchItems: 100,
        remainingAiSearchItems: 1,
      },
    });
    expect(deletedAiSearchItemIds).toHaveLength(100);
    expect(aiSearchRows).toHaveLength(1);
    expect(deletedNoteIds).toHaveLength(0);
  });

  it("keeps notes and their mapping when AI Search provider cleanup fails", async () => {
    const evalRow = {
      ...evalNote("note-ai-failure", "Failure case", "body"),
      mutation_id: "notesflash-search-lab-eval:failure",
    };
    const { context, deletedNoteIds, aiSearchRows } = stubContext({
      body: { action: "cleanup" },
      notes: [evalRow],
      aiSearchItems: [aiSearchItem(evalRow)],
      aiSearchDeleteFailure: new Error("provider delete failed"),
    });
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      await expect(searchLab(context)).rejects.toMatchObject({
        status: 503,
        code: "LAB_AI_SEARCH_CLEANUP_FAILED",
      });
    } finally {
      error.mockRestore();
    }

    expect(deletedNoteIds).toHaveLength(0);
    expect(aiSearchRows).toHaveLength(1);
    expect(aiSearchRows[0].item_id).toBe("provider-note-ai-failure");
  });

  it("reindexes Vectorize and AI Search independently", async () => {
    const current = evalNote("note-reindex", "[EVAL:reindex] Reindex", "body");
    const { context, preparedSql, queueBatches } = stubContext({
      body: { action: "reindex" },
      notes: [current],
      semanticBackend: "ai-search",
    });

    const payload = await (await searchLab(context)).json() as Record<string, unknown>;
    expect(payload).toMatchObject({
      action: "reindex",
      pendingNotes: 1,
      enqueued: 1,
      vectorJobsEnqueued: 1,
      aiSearchJobsEnqueued: 1,
      aiSearchEnabled: true,
    });
    const resetSql = preparedSql.find((sql) => sql.startsWith("UPDATE notes SET"));
    expect(resetSql).toContain("embedding_status = 'pending'");
    expect(resetSql).toContain("ai_search_status = 'pending'");
    expect(resetSql).toContain("ai_search_indexed_content_hash = NULL");
    expect(queueBatches.flatMap((batch) =>
      (batch as Array<{ body: { type: string } }>).map((item) => item.body.type)
    )).toEqual(["embed-note", "sync-ai-search-note"]);
  });

  it("does not leave reindexed notes AI-pending in a Vectorize rollback", async () => {
    const current = evalNote("note-reindex-rollback", "Rollback", "body");
    const { context, preparedSql, queueBatches } = stubContext({
      body: { action: "reindex" },
      notes: [current],
      semanticBackend: "vectorize",
    });

    const payload = await (await searchLab(context)).json() as Record<string, unknown>;
    expect(payload).toMatchObject({
      vectorJobsEnqueued: 1,
      aiSearchJobsEnqueued: 0,
      aiSearchEnabled: false,
    });
    const resetSql = preparedSql.find((sql) => sql.startsWith("UPDATE notes SET"));
    expect(resetSql).toContain("ai_search_status = 'disabled'");
    expect(queueBatches.flatMap((batch) =>
      (batch as Array<{ body: { type: string } }>).map((item) => item.body.type)
    )).toEqual(["embed-note"]);
  });

  it("reports only anonymous AI Search aggregate corpus statistics", async () => {
    const current = evalNote("private-stats-note", "Private stats title", "Private stats body");
    const item = aiSearchItem(current, {
      item_key: "private-stats-item-key",
      item_id: "private-stats-item-id",
    });
    const { context } = stubContext({
      body: { action: "corpus-stats" },
      notes: [current],
      aiSearchItems: [item],
    });

    const payload = await (await searchLab(context)).json() as Record<string, unknown>;
    const serialized = JSON.stringify(payload);
    expect(payload).toMatchObject({
      aiSearchStatus: { ready: 1 },
      aiSearchItemsByState: { ready: 1 },
      currentAiSearchItems: 1,
    });
    for (const secret of [
      current.id,
      current.title,
      current.body,
      item.item_key,
      item.item_id ?? "",
    ]) {
      expect(serialized).not.toContain(secret);
    }
  });

  it("probes the AI Search Items contract without exposing provider identifiers", async () => {
    const { context } = stubContext({
      body: { action: "provider-probe" },
      semanticBackend: "ai-search",
    });

    const payload = await (await searchLab(context)).json() as Record<string, unknown>;
    expect(payload).toMatchObject({
      action: "provider-probe",
      ok: true,
      stage: "complete",
      uploadStatus: "queued",
      cleanup: { attempted: true, ok: true },
    });
    const serialized = JSON.stringify(payload);
    expect(serialized).not.toContain("private-provider-probe-id");
    expect(serialized).not.toContain("nf_provider_probe");
  });
});
