import { describe, expect, it, vi } from "vitest";

import { deleteNote } from "../src/notes";
import { consumeIndexQueue, retryPendingIndexes } from "../src/queue";
import type { Env, IndexJob, NoteRow, RequestContext } from "../src/types";

function note(overrides: Partial<NoteRow> = {}): NoteRow {
  return {
    rowid: 1,
    id: "note-1",
    title: "标题",
    body: "正文",
    version: 2,
    content_hash: "hash-current",
    mutation_id: null,
    created_at: 1,
    updated_at: 2,
    last_opened_at: null,
    pinned: 0,
    archived: 0,
    deleted_at: null,
    embedding_status: "pending",
    embedding_model: null,
    embedded_content_hash: null,
    embedding_vector_id: null,
    embedding_updated_at: null,
    embedding_error_code: null,
    ai_search_status: "pending",
    ai_search_indexed_content_hash: null,
    ai_search_updated_at: null,
    ai_search_error_code: null,
    ...overrides,
  };
}

describe("AI Search queue failure handling", () => {
  it("retries a provider job even when recording its failed status also fails", async () => {
    const current = note();
    const statusFailure = new Error("D1 status update unavailable");
    const db = {
      prepare(sql: string) {
        let bound: unknown[] = [];
        return {
          bind(...values: unknown[]) {
            bound = values;
            return this;
          },
          async first() {
            if (sql.includes("SELECT * FROM notes WHERE id = ?")) {
              return bound[0] === current.id ? current : null;
            }
            return null;
          },
          async all() {
            return { results: [] };
          },
          async run() {
            if (sql.includes("ai_search_status = 'failed'")) throw statusFailure;
            return { meta: { changes: 1 } };
          },
        };
      },
    };
    const env = {
      DB: db,
      AI_SEARCH: {
        list: vi.fn(async () => {
          throw new Error("AI Search provider unavailable");
        }),
      },
      SEMANTIC_BACKEND: "ai-search",
    } as unknown as Env;
    const retry = vi.fn();
    const ack = vi.fn();
    const job: IndexJob = {
      type: "sync-ai-search-note",
      eventId: "event-1",
      noteId: current.id,
      version: current.version,
      contentHash: current.content_hash,
      createdAt: 1,
    };
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      await consumeIndexQueue({
        messages: [{ id: "message-1", body: job, ack, retry }],
      } as unknown as MessageBatch<IndexJob>, env);
    } finally {
      error.mockRestore();
    }

    expect(ack).not.toHaveBeenCalled();
    expect(retry).toHaveBeenCalledOnce();
    expect(retry).toHaveBeenCalledWith({ delaySeconds: 15 });
  });
});

interface RepairHarnessOptions {
  aiSendFailure?: boolean;
  invalidAiConfig?: boolean;
  semanticBackend?: "ai-search" | "vectorize";
  aiSearchEnabled?: "true" | "false";
  deletedAiRepair?: boolean;
}

function repairHarness(options: RepairHarnessOptions = {}) {
  const sqlSeen: string[] = [];
  const embedRepair = { id: "embed-note", version: 3, content_hash: "embed-hash" };
  const aiRepair = { id: "ai-note", version: 4, content_hash: "ai-hash" };
  const deletedAiRepair = { id: "deleted-ai-note", version: 5, content_hash: "deleted-hash" };

  function statement(sql: string) {
    sqlSeen.push(sql);
    let bound: unknown[] = [];
    return {
      bind(...values: unknown[]) {
        bound = values;
        return this;
      },
      async first() {
        if (sql.includes("SELECT COUNT(*) AS count") && sql.includes("FROM note_chunks")) {
          return { count: 0 };
        }
        return null;
      },
      async all() {
        if (sql.includes("embedding_status = 'pending'")) return { results: [embedRepair] };
        if (sql.includes("SELECT DISTINCT n.id, n.version, n.content_hash") &&
            sql.includes("ai_search_items")) {
          return { results: options.deletedAiRepair ? [deletedAiRepair] : [] };
        }
        if (sql.includes("ai_search_status = 'pending'")) return { results: [aiRepair] };
        return { results: [] };
      },
      async run() {
        return { meta: { changes: 1 }, bound };
      },
    };
  }

  const sentBatches: unknown[][] = [];
  const sendBatch = vi.fn(async (messages: unknown[]) => {
    sentBatches.push(messages);
    if (options.aiSendFailure && sentBatches.length === 2) {
      throw new Error("AI repair queue unavailable");
    }
  });
  const env = {
    DB: {
      prepare: (sql: string) => statement(sql),
      async batch(statements: Array<{ run: () => Promise<unknown> }>) {
        const results = [];
        for (const item of statements) results.push(await item.run());
        return results;
      },
    },
    IMAGES: { delete: vi.fn() },
    CHUNK_INDEX: {
      describe: vi.fn(async () => ({ vectorCount: 0 })),
      query: vi.fn(async () => ({ matches: [] })),
      deleteByIds: vi.fn(),
    },
    INDEX_QUEUE: {
      send: vi.fn(),
      sendBatch,
    },
    SEMANTIC_BACKEND: options.semanticBackend ?? "ai-search",
    AI_SEARCH_ENABLED: options.aiSearchEnabled,
    AI_SEARCH_MAX_RESULTS: options.invalidAiConfig ? "invalid" : undefined,
  } as unknown as Env;
  return { env, sqlSeen, sentBatches, sendBatch };
}

describe("scheduled index repair isolation", () => {
  it("submits Vectorize repair first and contains a later AI Search sendBatch failure", async () => {
    const test = repairHarness({ aiSendFailure: true });
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      await expect(retryPendingIndexes(test.env)).resolves.toBeUndefined();
    } finally {
      error.mockRestore();
    }

    expect(test.sendBatch).toHaveBeenCalledTimes(2);
    expect(test.sentBatches[0]).toEqual([
      { body: expect.objectContaining({ type: "embed-note", noteId: "embed-note" }) },
    ]);
    expect(test.sentBatches[1]).toEqual([
      { body: expect.objectContaining({ type: "sync-ai-search-note", noteId: "ai-note" }) },
    ]);

    const aiRepairSql = test.sqlSeen.find((sql) => sql.includes("ai_search_status = 'pending'"));
    expect(aiRepairSql).toBeDefined();
    expect(aiRepairSql).toMatch(
      /ai_search_status = 'failed' AND COALESCE\(ai_search_updated_at, 0\) < \?/,
    );
    expect(aiRepairSql).toMatch(
      /ai_search_status = 'processing' AND COALESCE\(ai_search_updated_at, 0\) < \?/,
    );
    expect(aiRepairSql).toMatch(
      /ai_search_status = 'ready'[\s\S]*ai_search_indexed_content_hash IS NULL/,
    );
  });

  it("still completes Vectorize repair when optional AI Search configuration is invalid", async () => {
    const test = repairHarness({ invalidAiConfig: true });
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      await expect(retryPendingIndexes(test.env)).resolves.toBeUndefined();
    } finally {
      error.mockRestore();
    }

    expect(test.sendBatch).toHaveBeenCalledOnce();
    expect(test.sentBatches[0]).toEqual([
      { body: expect.objectContaining({ type: "embed-note", noteId: "embed-note" }) },
    ]);
  });

  it("repairs deleted AI Search artifacts after live maintenance is disabled", async () => {
    const test = repairHarness({
      semanticBackend: "vectorize",
      aiSearchEnabled: "false",
      deletedAiRepair: true,
    });

    await expect(retryPendingIndexes(test.env)).resolves.toBeUndefined();

    expect(test.sendBatch).toHaveBeenCalledTimes(2);
    expect(test.sentBatches[1]).toEqual([
      {
        body: expect.objectContaining({
          type: "sync-ai-search-note",
          noteId: "deleted-ai-note",
        }),
      },
    ]);
    expect(test.sqlSeen.some((sql) => sql.includes("ai_search_status = 'pending'"))).toBe(false);
  });
});

describe("AI Search deletion cleanup scheduling", () => {
  it("enqueues cleanup even when the active semantic backend is Vectorize", async () => {
    const current = note({ embedding_vector_id: "legacy-vector" });
    const sent: IndexJob[] = [];
    const db = {
      prepare(sql: string) {
        let bound: unknown[] = [];
        return {
          bind(...values: unknown[]) {
            bound = values;
            return this;
          },
          async first() {
            if (sql.startsWith("SELECT * FROM notes WHERE id = ?")) {
              return bound[0] === current.id ? current : null;
            }
            return null;
          },
          async run() {
            return { meta: { changes: sql.includes("UPDATE notes") ? 1 : 0 } };
          },
        };
      },
    };
    const env = {
      DB: db,
      INDEX_QUEUE: {
        send: vi.fn(async (job: IndexJob) => {
          sent.push(job);
        }),
      },
      SEMANTIC_BACKEND: "vectorize",
      AI_SEARCH_ENABLED: "false",
    } as unknown as Env;
    const request = new Request("https://notes.example/api/notes/note-1?baseVersion=2", {
      method: "DELETE",
    });
    const context: RequestContext = {
      env,
      request,
      url: new URL(request.url),
      requestId: "request-1",
      principal: { deviceId: "device-1", deviceName: "Mac", sessionId: "session-1" },
    };

    const response = await deleteNote(context, current.id);

    expect(response.status).toBe(200);
    expect(sent).toEqual([
      expect.objectContaining({ type: "delete-vector", noteId: current.id }),
      expect.objectContaining({ type: "sync-ai-search-note", noteId: current.id }),
    ]);
  });
});
