import { describe, expect, it, vi } from "vitest";

import { buildIdentifiedNoteChunks, DEFAULT_CHUNKING } from "../src/chunking";
import { consumeIndexQueue } from "../src/queue";
import type { EmbedNoteJob, Env, IndexJob, NoteRow } from "../src/types";

function note(overrides: Partial<NoteRow> = {}): NoteRow {
  return {
    rowid: 1,
    id: "note-1",
    title: "运维手册",
    body: "每天检查健康接口。\n如果向量数量少于数据库记录数，就重建索引。",
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
    ...overrides,
  };
}

interface HarnessOptions {
  notes?: NoteRow[];
  /** Existing chunk rows keyed by chunk id. */
  chunkRows?: Array<{ chunk_id: string; note_id: string; content_hash: string }>;
  embeddingError?: Error;
  updateChanges?: number;
}

function harness(options: HarnessOptions = {}) {
  const notes = options.notes ?? [note()];
  const chunkRows = [...(options.chunkRows ?? [])];
  const executed: Array<{ sql: string; bound: unknown[] }> = [];
  const upserted: Array<Array<{ id: string }>> = [];
  const deletedVectorIds: string[][] = [];
  const legacyDeletes: string[][] = [];
  const enqueued: IndexJob[] = [];
  const statusUpdates: string[] = [];

  const embed = vi.fn(async (_model: string, input: Record<string, unknown>) => {
    if (options.embeddingError) throw options.embeddingError;
    const texts = (input.text ?? input.documents ?? input.queries) as string[];
    return { data: texts.map(() => new Array(768).fill(0.1)) };
  });

  function statement(sql: string) {
    let bound: unknown[] = [];
    return {
      bind(...values: unknown[]) {
        bound = values;
        return this;
      },
      async first() {
        executed.push({ sql, bound });
        if (sql.includes("SELECT * FROM notes")) {
          return notes.find((row) =>
            row.id === bound[0] && row.version === bound[1] && row.content_hash === bound[2]
          ) ?? null;
        }
        if (sql.includes("SELECT content_hash, deleted_at FROM notes")) {
          const row = notes.find((item) => item.id === bound[0]);
          return row ? { content_hash: row.content_hash, deleted_at: row.deleted_at } : null;
        }
        if (sql.includes("embedding_vector_id = ?")) return null;
        return null;
      },
      async all() {
        executed.push({ sql, bound });
        if (sql.includes("SELECT chunk_id FROM note_chunks")) {
          const noteId = String(bound[0]);
          const keepHash = bound.length > 1 ? String(bound[1]) : null;
          return {
            results: chunkRows.filter((row) =>
              row.note_id === noteId && (keepHash === null || row.content_hash !== keepHash)
            ),
          };
        }
        return { results: [] };
      },
      async run() {
        executed.push({ sql, bound });
        if (sql.startsWith("INSERT INTO note_chunks")) {
          chunkRows.push({
            chunk_id: String(bound[0]),
            note_id: String(bound[1]),
            content_hash: String(bound[2]),
          });
        }
        if (sql.startsWith("DELETE FROM note_chunks WHERE note_id")) {
          const noteId = String(bound[0]);
          for (let index = chunkRows.length - 1; index >= 0; index -= 1) {
            if (chunkRows[index].note_id === noteId) chunkRows.splice(index, 1);
          }
        }
        if (sql.startsWith("DELETE FROM note_chunks WHERE chunk_id")) {
          const chunkId = String(bound[0]);
          const index = chunkRows.findIndex((row) => row.chunk_id === chunkId);
          if (index >= 0) chunkRows.splice(index, 1);
        }
        if (sql.includes("embedding_status = 'processing'")) statusUpdates.push("processing");
        if (sql.includes("embedding_status = 'ready'")) {
          statusUpdates.push("ready");
          return { meta: { changes: options.updateChanges ?? 1 } };
        }
        if (sql.includes("embedding_status = 'failed'")) statusUpdates.push("failed");
        return { meta: { changes: 1 } };
      },
    };
  }

  const env = {
    DB: {
      prepare: (sql: string) => statement(sql),
      async batch(statements: Array<{ run: () => Promise<unknown> }>) {
        for (const item of statements) await item.run();
        return statements.map(() => ({ meta: { changes: 1 } }));
      },
    },
    AI: { run: embed },
    CHUNK_INDEX: {
      upsert: vi.fn(async (vectors: Array<{ id: string }>) => {
        upserted.push(vectors);
      }),
      deleteByIds: vi.fn(async (ids: string[]) => {
        deletedVectorIds.push(ids);
      }),
    },
    VECTOR_INDEX: {
      deleteByIds: vi.fn(async (ids: string[]) => {
        legacyDeletes.push(ids);
      }),
    },
    INDEX_QUEUE: {
      send: vi.fn(async (job: IndexJob) => {
        enqueued.push(job);
      }),
    },
  } as unknown as Env;

  async function run(jobs: IndexJob[]) {
    const acked: string[] = [];
    const retried: string[] = [];
    await consumeIndexQueue(
      {
        messages: jobs.map((body, index) => ({
          id: `message-${index}`,
          body,
          ack: () => acked.push(`message-${index}`),
          retry: () => retried.push(`message-${index}`),
        })),
      } as unknown as MessageBatch<IndexJob>,
      env,
    );
    return { acked, retried };
  }

  return {
    env,
    run,
    embed,
    chunkRows,
    executed,
    upserted,
    deletedVectorIds,
    legacyDeletes,
    enqueued,
    statusUpdates,
  };
}

function embedJob(overrides: Partial<EmbedNoteJob> = {}): EmbedNoteJob {
  return {
    type: "embed-note",
    eventId: "event-1",
    noteId: "note-1",
    version: 2,
    contentHash: "hash-current",
    createdAt: 1,
    ...overrides,
  };
}

describe("chunk indexing", () => {
  it("embeds every chunk, upserts vectors, and records line anchors", async () => {
    const target = note();
    const test = harness({ notes: [target] });

    const { acked, retried } = await test.run([embedJob()]);

    expect(retried).toHaveLength(0);
    expect(acked).toHaveLength(1);

    const expected = buildIdentifiedNoteChunks(
      {
        noteId: target.id,
        title: target.title,
        body: target.body,
        contentHash: target.content_hash,
      },
      DEFAULT_CHUNKING,
    );
    expect(test.embed).toHaveBeenCalledTimes(1);
    expect(test.upserted.flat().map((vector) => vector.id)).toEqual(
      expected.map((chunk) => chunk.chunkId),
    );
    expect(test.chunkRows.map((row) => row.chunk_id)).toEqual(
      expected.map((chunk) => chunk.chunkId),
    );
    expect(test.statusUpdates).toEqual(["processing", "ready"]);

    const inserts = test.executed.filter((entry) =>
      entry.sql.startsWith("INSERT INTO note_chunks")
    );
    const titleInsert = inserts[0];
    expect(titleInsert.bound[4]).toBe("title");
    const bodyInsert = inserts[1];
    expect(bodyInsert.bound[4]).toBe("body");
    expect(bodyInsert.bound[5]).toBeGreaterThanOrEqual(1);
  });

  it("replaces chunk rows for the note before marking it ready", async () => {
    const test = harness({
      notes: [note()],
      chunkRows: [{ chunk_id: "note-1:oldhas:0", note_id: "note-1", content_hash: "hash-old" }],
    });

    await test.run([embedJob()]);

    expect(test.chunkRows.some((row) => row.content_hash === "hash-old")).toBe(false);
    const deleteIndex = test.executed.findIndex((entry) =>
      entry.sql.startsWith("DELETE FROM note_chunks WHERE note_id")
    );
    const readyIndex = test.executed.findIndex((entry) =>
      entry.sql.includes("embedding_status = 'ready'")
    );
    expect(deleteIndex).toBeGreaterThanOrEqual(0);
    expect(deleteIndex).toBeLessThan(readyIndex);
  });

  it("queues stale chunk cleanup only after the note points at new chunks", async () => {
    const test = harness({ notes: [note()] });

    await test.run([embedJob()]);

    expect(test.enqueued).toEqual([
      expect.objectContaining({
        type: "delete-chunks",
        noteId: "note-1",
        keepContentHash: "hash-current",
      }),
    ]);
  });

  it("ignores a job whose version or hash no longer matches D1", async () => {
    const test = harness({ notes: [note()] });

    await test.run([embedJob({ contentHash: "hash-stale" })]);

    expect(test.embed).not.toHaveBeenCalled();
    expect(test.upserted).toHaveLength(0);
    expect(test.statusUpdates).toEqual([]);
  });

  it("does not queue cleanup when a newer job won the race", async () => {
    const test = harness({ notes: [note()], updateChanges: 0 });

    await test.run([embedJob()]);

    expect(test.upserted.flat().length).toBeGreaterThan(0);
    expect(test.enqueued).toHaveLength(0);
  });

  it("marks the note failed and retries when embedding fails", async () => {
    const test = harness({
      notes: [note()],
      embeddingError: new Error("Workers AI unavailable"),
    });

    const { retried } = await test.run([embedJob()]);

    expect(retried).toHaveLength(1);
    expect(test.statusUpdates).toContain("failed");
    expect(test.upserted).toHaveLength(0);
  });
});

describe("chunk cleanup", () => {
  it("removes only chunks from other content hashes for a live note", async () => {
    const test = harness({
      notes: [note()],
      chunkRows: [
        { chunk_id: "note-1:hashcu:0", note_id: "note-1", content_hash: "hash-current" },
        { chunk_id: "note-1:oldhas:0", note_id: "note-1", content_hash: "hash-old" },
      ],
    });

    await test.run([
      {
        type: "delete-chunks",
        eventId: "event-2",
        noteId: "note-1",
        chunkIds: [],
        keepContentHash: "hash-current",
        createdAt: 1,
      },
    ]);

    expect(test.deletedVectorIds).toEqual([["note-1:oldhas:0"]]);
    expect(test.chunkRows.map((row) => row.chunk_id)).toEqual(["note-1:hashcu:0"]);
  });

  it("removes every chunk of a deleted note and disables its index state", async () => {
    const test = harness({
      notes: [note({ deleted_at: 99 })],
      chunkRows: [
        { chunk_id: "note-1:hashcu:0", note_id: "note-1", content_hash: "hash-current" },
        { chunk_id: "note-1:hashcu:1", note_id: "note-1", content_hash: "hash-current" },
      ],
    });

    await test.run([
      {
        type: "delete-chunks",
        eventId: "event-3",
        noteId: "note-1",
        chunkIds: [],
        keepContentHash: null,
        createdAt: 1,
      },
    ]);

    expect(test.deletedVectorIds[0]).toEqual(["note-1:hashcu:0", "note-1:hashcu:1"]);
    expect(test.chunkRows).toHaveLength(0);
    expect(
      test.executed.some((entry) => entry.sql.includes("embedding_status = 'disabled'")),
    ).toBe(true);
  });

  it("is a no-op when nothing is stale", async () => {
    const test = harness({
      notes: [note()],
      chunkRows: [{ chunk_id: "note-1:hashcu:0", note_id: "note-1", content_hash: "hash-current" }],
    });

    await test.run([
      {
        type: "delete-chunks",
        eventId: "event-4",
        noteId: "note-1",
        chunkIds: [],
        keepContentHash: "hash-current",
        createdAt: 1,
      },
    ]);

    expect(test.deletedVectorIds).toHaveLength(0);
    expect(test.chunkRows).toHaveLength(1);
  });

  it("also clears chunks when a legacy delete-vector job arrives", async () => {
    const test = harness({
      notes: [note({ deleted_at: 99 })],
      chunkRows: [{ chunk_id: "note-1:hashcu:0", note_id: "note-1", content_hash: "hash-current" }],
    });

    await test.run([
      {
        type: "delete-vector",
        eventId: "event-5",
        noteId: "note-1",
        vectorId: "note-1:2:hashcurrent",
        createdAt: 1,
      },
    ]);

    expect(test.legacyDeletes).toEqual([["note-1:2:hashcurrent"]]);
    expect(test.deletedVectorIds).toEqual([["note-1:hashcu:0"]]);
    expect(test.chunkRows).toHaveLength(0);
  });
});
