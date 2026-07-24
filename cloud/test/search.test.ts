import { describe, expect, it, vi } from "vitest";

import { migrateRerankerDiagnostic, semanticSearch } from "../src/search";
import type { NoteRow, RequestContext } from "../src/types";

interface ContextOptions {
  literal?: boolean;
  query: string;
  notes?: NoteRow[];
  rerankerOutput?: unknown;
  rerankerError?: Error;
  rerankerMinimumScore?: string;
  bodyExcerptCharacters?: string;
  limit?: number;
}

function note(id: string, title: string, body: string): NoteRow {
  return {
    rowid: Number.parseInt(id.replace(/\D/g, ""), 10) || 1,
    id,
    title,
    body,
    version: 1,
    content_hash: `hash-${id}`,
    mutation_id: null,
    created_at: 1,
    updated_at: 2,
    last_opened_at: null,
    pinned: 0,
    archived: 0,
    deleted_at: null,
    embedding_status: "ready",
    embedding_model: "@cf/baai/bge-m3",
    embedded_content_hash: `hash-${id}`,
    embedding_vector_id: `vector-${id}`,
    embedding_updated_at: 3,
    embedding_error_code: null,
  };
}

function context(options: ContextOptions) {
  const allNotes = options.notes ?? [];
  const currentNotes = allNotes
    .filter((row) => row.deleted_at === null)
    .sort((left, right) => left.id.localeCompare(right.id));
  const defaultRerankerOutput = {
    response: currentNotes.map((_, id) => ({ id, score: 0.9 - id * 0.05 })),
  };
  const rerankerOutput = options.rerankerOutput === undefined
    ? defaultRerankerOutput
    : options.rerankerOutput;
  const aiRun = vi.fn(async (model: string) => {
    if (model !== "@cf/baai/bge-reranker-base") {
      throw new Error(`Semantic search must not call ${model}`);
    }
    if (options.rerankerError) throw options.rerankerError;
    return rerankerOutput;
  });
  const vectorQuery = vi.fn(async () => {
    throw new Error("Semantic search must not call Vectorize.");
  });
  const preparedSql: string[] = [];

  const db = {
    prepare(sql: string) {
      preparedSql.push(sql);
      let boundValues: unknown[] = [];
      return {
        bind(...values: unknown[]) {
          boundValues = values;
          return this;
        },
        async first() {
          if (sql.includes("FROM notes_fts")) return options.literal ? { found: 1 } : null;
          if (sql.includes("instr(lower(title)")) return options.literal ? { found: 1 } : null;
          if (sql.includes("COUNT(*) AS count FROM notes")) return { count: currentNotes.length };
          return null;
        },
        async all() {
          if (sql.includes("substr(body, 1, ?) AS body_excerpt")) {
            const maximumCharacters = Number(boundValues[0]);
            return {
              results: currentNotes.map((row) => ({
                id: row.id,
                title: row.title,
                body_excerpt: [...row.body].slice(0, maximumCharacters).join(""),
                migration_target: row.title.includes("迁移") || row.body.includes("迁移") ? 1 : 0,
              })),
            };
          }
          if (sql.includes("AND id IN")) {
            const selectedIds = new Set(boundValues.map(String));
            return { results: currentNotes.filter((row) => selectedIds.has(row.id)) };
          }
          if (sql.includes("FROM note_images")) return { results: [] };
          return { results: [] };
        },
      };
    },
  };

  const request = new Request("https://notes.example/api/search/semantic", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query: options.query, limit: options.limit ?? 30 }),
  });
  const requestContext = {
    env: {
      DB: db,
      AI: { run: aiRun },
      VECTOR_INDEX: { query: vectorQuery },
      RERANKER_MIN_SCORE: options.rerankerMinimumScore ?? "0.05",
      RERANKER_BODY_EXCERPT_CHARS: options.bodyExcerptCharacters ?? "1200",
      SEMANTIC_TOP_K: "8",
    },
    request,
    url: new URL(request.url),
    requestId: "test-request",
    principal: { deviceId: "device-1", deviceName: "test", sessionId: "session-1" },
  } as unknown as RequestContext;

  return { requestContext, aiRun, vectorQuery, preparedSql };
}

describe("semantic all-note reranker search", () => {
  it("short-circuits before the all-note scan when a literal result exists", async () => {
    const { requestContext, aiRun, vectorQuery, preparedSql } = context({
      literal: true,
      query: "迁移-literal-short-circuit",
      notes: [note("note-1", "数据库迁移", "正文")],
    });

    const response = await semanticSearch(requestContext);
    const payload = await response.json() as Record<string, unknown>;

    expect(payload).toMatchObject({
      strategy: "lexical-first",
      semanticSkipped: true,
      reason: "literal-match-exists",
      topK: 8,
      results: [],
    });
    expect(aiRun).not.toHaveBeenCalled();
    expect(vectorQuery).not.toHaveBeenCalled();
    expect(preparedSql.some((sql) => sql.includes("substr(body, 1, ?)"))).toBe(false);
  });

  it("returns a note that could not have been a vector candidate", async () => {
    const ready = note("note-1", "Ready note", "ordinary text");
    const pending = note("note-2", "Pending note", "still compared");
    pending.embedding_status = "pending";
    const missedByVector = note("note-3", "数据库下线迁移", "需要迁移服务端配置");
    missedByVector.embedding_status = "failed";
    missedByVector.embedding_model = null;
    missedByVector.embedded_content_hash = null;
    missedByVector.embedding_vector_id = null;
    const deleted = note("note-4", "Deleted", "must not be compared");
    deleted.deleted_at = 10;
    const query = "migrate-all-notes-directly";
    const { requestContext, aiRun, vectorQuery, preparedSql } = context({
      query,
      notes: [ready, pending, missedByVector, deleted],
      limit: 1,
      rerankerOutput: { response: [{ id: 2, score: 0.97 }] },
    });

    const response = await semanticSearch(requestContext);
    const payload = await response.json() as {
      rankingStrategy: string;
      comparisonScope: string;
      rerankerModel: string;
      rerankerMinimumScore: number;
      bodyExcerptCharacters: number;
      comparedNoteCount: number;
      scoredNoteCount: number;
      matchedNoteCount: number;
      topRerankerScore: number;
      results: Array<{ id: string; body: string; score: number }>;
    };

    expect(aiRun).toHaveBeenCalledTimes(1);
    expect(aiRun).toHaveBeenCalledWith("@cf/baai/bge-reranker-base", {
      query,
      contexts: [
        { text: "Ready note\n\nordinary text" },
        { text: "Pending note\n\nstill compared" },
        { text: "数据库下线迁移\n\n需要迁移服务端配置" },
      ],
      top_k: 1,
    });
    expect(vectorQuery).not.toHaveBeenCalled();
    expect(payload).toMatchObject({
      rankingStrategy: "direct-bge-reranker",
      comparisonScope: "all-current-non-deleted-notes",
      rerankerModel: "@cf/baai/bge-reranker-base",
      rerankerMinimumScore: 0.05,
      bodyExcerptCharacters: 1200,
      comparedNoteCount: 3,
      scoredNoteCount: 1,
      matchedNoteCount: 1,
      topRerankerScore: 0.97,
    });
    expect(payload.results).toEqual([
      expect.objectContaining({
        id: "note-3",
        body: "需要迁移服务端配置",
        score: 0.97,
      }),
    ]);

    const scanSql = preparedSql.find((sql) => sql.includes("substr(body, 1, ?)"));
    expect(scanSql).toContain("WHERE deleted_at IS NULL");
    expect(scanSql).not.toMatch(/embedding_|\bLIMIT\b|\bIN\s*\(/i);
    expect(payload).not.toHaveProperty("retrievalModel");
    expect(payload).not.toHaveProperty("candidateCount");
    expect(payload).not.toHaveProperty("retrievedCandidateCount");
    expect(response.headers.get("server-timing")).toContain("notes;dur=");
    expect(response.headers.get("server-timing")).toContain("reranker;dur=");
    expect(response.headers.get("server-timing")).toContain("hydrate;dur=");
    expect(response.headers.get("server-timing")).not.toContain("embedding;");
    expect(response.headers.get("server-timing")).not.toContain("vector;");
  });

  it("sends only the configured body excerpt while returning the complete note", async () => {
    const longBody = "0123456789ABCDEFGHIJ";
    const emojiBody = "😀123456789XYZ";
    const query = "bounded-body-excerpt-query";
    const { requestContext, aiRun, vectorQuery } = context({
      query,
      notes: [
        note("note-1", "Long title", longBody),
        note("note-2", "Emoji title", emojiBody),
      ],
      bodyExcerptCharacters: "10",
      rerankerOutput: { response: [{ id: 0, score: 0.9 }, { id: 1, score: 0.8 }] },
    });

    const response = await semanticSearch(requestContext);
    const payload = await response.json() as { results: Array<{ id: string; body: string }> };

    expect(aiRun).toHaveBeenCalledWith("@cf/baai/bge-reranker-base", {
      query,
      contexts: [
        { text: "Long title\n\n0123456789" },
        { text: "Emoji title\n\n😀123456789" },
      ],
      top_k: 2,
    });
    expect(payload.results).toEqual([
      expect.objectContaining({ id: "note-1", body: longBody }),
      expect.objectContaining({ id: "note-2", body: emojiBody }),
    ]);
    expect(vectorQuery).not.toHaveBeenCalled();
  });

  it("keeps calibrated cross-language migration matches while filtering low-score noise", async () => {
    const { requestContext, vectorQuery } = context({
      query: "migrate",
      notes: [
        note(
          "note-1",
          "cloud-service-center-39078 [Story] resouce-base库下线迁移",
          "acc-resource-fe_1-0-2872_BRANCH\n\n服务端配置管理写\n\n服务端配置管理读\n\n采集规则配置写\n配置管理读写",
        ),
        note("note-2", "Unrelated deployment", "ordinary release checklist"),
      ],
      rerankerOutput: {
        response: [
          { id: 0, score: 0.06876970827579498 },
          { id: 1, score: 0.004878689534962177 },
        ],
      },
    });

    const response = await semanticSearch(requestContext);
    const payload = await response.json() as {
      rerankerMinimumScore: number;
      results: Array<{ id: string; score: number }>;
    };

    expect(payload.rerankerMinimumScore).toBe(0.05);
    expect(payload.results).toEqual([
      expect.objectContaining({ id: "note-1", score: 0.06876970827579498 }),
    ]);
    expect(vectorQuery).not.toHaveBeenCalled();
  });

  it("keeps the authenticated migration diagnostic anonymous and aggregate-only", async () => {
    const sensitiveTitle = "cloud-service-center-39078 [Story] resouce-base库下线迁移";
    const sensitiveBody = "服务端配置管理写\n服务端配置管理读";
    const { requestContext, vectorQuery } = context({
      query: "unused-diagnostic-request-body",
      notes: [
        note("a-private-note-id", sensitiveTitle, sensitiveBody),
        note("z-other-private-id", "Unrelated", "ordinary release checklist"),
      ],
      rerankerOutput: { response: [{ id: 0, score: 0.06876970827579498 }] },
    });

    const response = await migrateRerankerDiagnostic(requestContext);
    const payload = await response.json() as Record<string, unknown>;
    const serialized = JSON.stringify(payload);

    expect(payload).toMatchObject({
      query: "migrate",
      configuredThreshold: 0.05,
      comparedNoteCount: 2,
      migrationTargetCount: 1,
      migrationTargetsInNormalTopK: 1,
      migrationTargetScores: [0.06876970827579498],
    });
    expect(serialized).not.toContain(sensitiveTitle);
    expect(serialized).not.toContain(sensitiveBody);
    expect(serialized).not.toContain("a-private-note-id");
    expect(serialized).not.toContain("z-other-private-id");
    expect(vectorQuery).not.toHaveBeenCalled();
  });

  it("requires a device principal for the migration diagnostic", async () => {
    const { requestContext, aiRun } = context({
      query: "unauthenticated-diagnostic",
      notes: [note("note-1", "数据库迁移", "正文")],
    });
    requestContext.principal = undefined;

    await expect(migrateRerankerDiagnostic(requestContext)).rejects.toMatchObject({
      status: 401,
      code: "AUTH_REQUIRED",
    });
    expect(aiRun).not.toHaveBeenCalled();
  });

  it("uses only reranker scores for ordering and threshold filtering", async () => {
    const { requestContext, vectorQuery } = context({
      query: "reranker-only-order-query",
      rerankerMinimumScore: "0.6",
      notes: [
        note("note-1", "A", "boundary"),
        note("note-2", "B", "below threshold"),
        note("note-3", "C", "highest score"),
      ],
      rerankerOutput: {
        response: [
          { id: 0, score: 0.6 },
          { id: 2, score: 0.95 },
          { id: 1, score: 0.59 },
        ],
      },
    });

    const response = await semanticSearch(requestContext);
    const payload = await response.json() as { results: Array<{ id: string; score: number }> };

    expect(payload.results).toEqual([
      expect.objectContaining({ id: "note-3", score: 0.95 }),
      expect.objectContaining({ id: "note-1", score: 0.6 }),
    ]);
    expect(vectorQuery).not.toHaveBeenCalled();
  });

  it("does not invoke Workers AI for an empty note collection", async () => {
    const { requestContext, aiRun, vectorQuery } = context({
      query: "empty-note-collection-query",
      notes: [],
    });

    const response = await semanticSearch(requestContext);
    const payload = await response.json() as Record<string, unknown>;

    expect(aiRun).not.toHaveBeenCalled();
    expect(vectorQuery).not.toHaveBeenCalled();
    expect(payload).toMatchObject({
      comparedNoteCount: 0,
      scoredNoteCount: 0,
      matchedNoteCount: 0,
      topRerankerScore: null,
      results: [],
    });
  });

  it("returns an explicit error when the reranker is unavailable", async () => {
    const { requestContext, vectorQuery } = context({
      query: "direct-reranker-unavailable-query",
      notes: [note("note-1", "Reranker outage", "no fallback")],
      rerankerError: new Error("Workers AI unavailable"),
    });

    await expect(semanticSearch(requestContext)).rejects.toMatchObject({
      status: 503,
      code: "RERANKER_UNAVAILABLE",
    });
    expect(vectorQuery).not.toHaveBeenCalled();
  });

  it("rejects a non-numeric reranker threshold before scanning notes", async () => {
    const { requestContext, aiRun, vectorQuery, preparedSql } = context({
      query: "invalid-reranker-threshold-query",
      rerankerMinimumScore: "0.5-invalid",
      notes: [note("note-1", "Unused", "Unused")],
    });

    await expect(semanticSearch(requestContext)).rejects.toMatchObject({
      status: 500,
      code: "INVALID_RERANKER_CONFIGURATION",
    });
    expect(aiRun).not.toHaveBeenCalled();
    expect(vectorQuery).not.toHaveBeenCalled();
    expect(preparedSql.some((sql) => sql.includes("substr(body, 1, ?)"))).toBe(false);
  });

  it.each(["", "0", "1.5", "4001"])(
    "rejects invalid body excerpt configuration %j",
    async (bodyExcerptCharacters) => {
      const { requestContext, aiRun, vectorQuery } = context({
        query: `invalid-body-excerpt-${bodyExcerptCharacters || "empty"}`,
        bodyExcerptCharacters,
        notes: [note("note-1", "Unused", "Unused")],
      });

      await expect(semanticSearch(requestContext)).rejects.toMatchObject({
        status: 500,
        code: "INVALID_RERANKER_CONFIGURATION",
      });
      expect(aiRun).not.toHaveBeenCalled();
      expect(vectorQuery).not.toHaveBeenCalled();
    },
  );

  it.each([
    ["missing response", {}],
    ["non-array response", { response: "invalid" }],
    ["non-object result", { response: [null] }],
    ["missing id", { response: [{ score: 0.9 }] }],
    ["missing score", { response: [{ id: 0 }] }],
    ["fractional context id", { response: [{ id: 0.5, score: 0.9 }] }],
    ["negative context id", { response: [{ id: -1, score: 0.9 }] }],
    ["out-of-range context id", { response: [{ id: 1, score: 0.9 }] }],
    ["duplicate context id", { response: [{ id: 0, score: 0.9 }, { id: 0, score: 0.8 }] }],
    ["non-finite score", { response: [{ id: 0, score: Number.NaN }] }],
  ])("rejects malformed reranker output: %s", async (label, rerankerOutput) => {
    const { requestContext, vectorQuery } = context({
      query: `malformed-direct-reranker-${label}`,
      notes: [note("note-1", "Malformed reranker", label)],
      rerankerOutput,
    });

    await expect(semanticSearch(requestContext)).rejects.toMatchObject({
      status: 502,
      code: "INVALID_RERANKER_RESPONSE",
    });
    expect(vectorQuery).not.toHaveBeenCalled();
  });

  it("accepts an empty reranker response as an empty semantic result", async () => {
    const { requestContext, vectorQuery } = context({
      query: "empty-direct-reranker-response-query",
      notes: [note("note-1", "No reranker result", "valid empty response")],
      rerankerOutput: { response: [] },
    });

    const response = await semanticSearch(requestContext);
    const payload = await response.json() as Record<string, unknown>;

    expect(payload).toMatchObject({ scoredNoteCount: 0, matchedNoteCount: 0, results: [] });
    expect(vectorQuery).not.toHaveBeenCalled();
  });
});
