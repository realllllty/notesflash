import { describe, expect, it, vi } from "vitest";

import { searchLab } from "../src/lab";
import type { RequestContext } from "../src/types";

const LAB_TOKEN = "lab-token-for-tests";
/** sha256("lab-token-for-tests"), computed by the same helper the Worker uses. */
const LAB_TOKEN_SHA256 = "b7df400949abfe63870eecc49dcde0a11286fe6d39c80db36ee441de044daa89";

interface StubNote {
  id: string;
  title: string;
  body: string;
  content_hash: string;
  embedding_vector_id?: string | null;
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
  const vectors = options.vectors ?? {};
  const cacheRows = new Map<string, string>();
  const insertedNotes: StubNote[] = [];
  const deletedNoteIds: string[] = [];
  const preparedSql: string[] = [];
  const queueBatches: unknown[] = [];
  const deletedVectorIds: string[][] = [];

  const aiRun = vi.fn(async (model: string, input: Record<string, unknown>) => {
    const texts = (input.text ?? input.queries ?? input.documents) as string[];
    return { data: texts.map((text) => stubVector(text, vectors, modelDimensions(model))) };
  });

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
          return null;
        },
        async all() {
          if (sql.includes("FROM notes") && sql.includes("content_hash")) {
            return { results: notes };
          }
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
            return { results: notes.filter((note) => note.title.startsWith("[EVAL")) };
          }
          if (sql.includes("GROUP BY embedding_status")) {
            return { results: [{ status: "ready", count: notes.length }] };
          }
          return { results: [] };
        },
        async run() {
          if (sql.startsWith("INSERT INTO notes")) {
            insertedNotes.push({
              id: String(bound[0]),
              title: String(bound[1]),
              body: String(bound[2]),
              content_hash: String(bound[3]),
            });
          }
          if (sql.startsWith("DELETE FROM notes")) deletedNoteIds.push(String(bound[0] ?? "all"));
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
      INDEX_QUEUE: {
        sendBatch: vi.fn(async (batch: unknown) => {
          queueBatches.push(batch);
        }),
      },
      LAB_ENABLED: options.labEnabled ?? "true",
      LAB_TOKEN_SHA256: options.labTokenSha256 ?? LAB_TOKEN_SHA256,
    },
    request,
    url: new URL(request.url),
    requestId: "test-request",
  } as unknown as RequestContext;

  return { context, aiRun, insertedNotes, deletedNoteIds, preparedSql, queueBatches, deletedVectorIds };
}

function evalNote(id: string, title: string, body: string): StubNote {
  return { id, title, body, content_hash: `hash-${id}`, embedding_vector_id: `vector-${id}` };
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

  it("accepts a paired device token even when the lab token is unset", async () => {
    const { context } = stubContext({
      body: { action: "whoami" },
      token: "device-session-token",
      labEnabled: "false",
      labTokenSha256: "",
      devicePrincipal: true,
    });

    const payload = await (await searchLab(context)).json() as Record<string, unknown>;
    expect(payload).toMatchObject({ actor: "device", labConfigured: false });
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

  it("returns matched text only when explicitly requested", async () => {
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

    const payload = await (await searchLab(context)).json() as {
      strategies: Array<{ queries: Array<{ results: Array<{ noteId?: string; title?: string; matches: Array<{ text?: string }> }> }> }>;
    };
    const best = payload.strategies[0].queries[0].results[0];

    expect(best.noteId).toBe("note-a");
    expect(best.title).toContain("[EVAL:migrate]");
    expect(best.matches[0].text).toContain("migrate the vector index");
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
    });

    const payload = await (await searchLab(context)).json() as Record<string, unknown>;
    expect(payload).toMatchObject({ action: "seed", inserted: 1, enqueued: 1 });
    expect(insertedNotes[0].title).toBe("[EVAL:migrate] Database migration");
    expect(queueBatches).toHaveLength(1);
  });

  it("only ever deletes prefixed notes during cleanup", async () => {
    const { context, preparedSql, deletedVectorIds } = stubContext({
      body: { action: "cleanup" },
      notes: [
        evalNote("note-a", "[EVAL:migrate] Database migration", "body"),
        evalNote("note-real", "真实笔记", "body"),
      ],
    });

    const payload = await (await searchLab(context)).json() as Record<string, unknown>;
    expect(payload).toMatchObject({ action: "cleanup", matchedNotes: 1 });
    expect(deletedVectorIds).toEqual([["vector-note-a"]]);
    const deleteStatements = preparedSql.filter((sql) => sql.startsWith("DELETE FROM notes"));
    expect(deleteStatements).toHaveLength(1);
    for (const sql of deleteStatements) expect(sql).toContain("LIKE '[EVAL%'");
  });
});
