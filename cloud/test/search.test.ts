import { describe, expect, it, vi } from "vitest";

import { semanticSearch } from "../src/search";
import type { NoteRow, RequestContext } from "../src/types";

const note: NoteRow = {
  rowid: 1,
  id: "note-1",
  title: "resource-base 库下线迁移",
  body: "迁移服务端配置",
  version: 1,
  content_hash: "hash-1",
  mutation_id: null,
  created_at: 1,
  updated_at: 2,
  last_opened_at: null,
  pinned: 0,
  archived: 0,
  deleted_at: null,
  embedding_status: "ready",
  embedding_model: "@cf/baai/bge-m3",
  embedded_content_hash: "hash-1",
  embedding_vector_id: "vector-1",
  embedding_updated_at: 3,
  embedding_error_code: null,
};

function context(options: { literal: boolean; query: string; score?: number }) {
  const aiRun = vi.fn(async () => ({ data: [[0.1, 0.2, 0.3]] }));
  const vectorQuery = vi.fn(async () => ({
    matches: [{ id: "vector-1", score: options.score ?? 0.8 }],
    count: 1,
  }));

  const db = {
    prepare(sql: string) {
      return {
        bind() {
          return this;
        },
        async first() {
          if (sql.includes("FROM notes_fts")) return options.literal ? { found: 1 } : null;
          if (sql.includes("instr(lower(title)")) return options.literal ? { found: 1 } : null;
          return null;
        },
        async all() {
          if (sql.includes("embedding_vector_id IN")) return { results: [note] };
          if (sql.includes("FROM note_images")) return { results: [] };
          return { results: [] };
        },
      };
    },
  };

  const request = new Request("https://notes.example/api/search/semantic", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query: options.query, limit: 30 }),
  });
  const requestContext = {
    env: {
      DB: db,
      AI: { run: aiRun },
      VECTOR_INDEX: { query: vectorQuery },
      EMBEDDING_MODEL: "@cf/baai/bge-m3",
      EMBEDDING_DIMENSIONS: "3",
      SEMANTIC_MIN_SCORE: "0.45",
      SEMANTIC_TOP_K: "8",
    },
    request,
    url: new URL(request.url),
    requestId: "test-request",
    principal: { deviceId: "device-1", deviceName: "test", sessionId: "session-1" },
  } as unknown as RequestContext;

  return { requestContext, aiRun, vectorQuery };
}

describe("semantic fallback search", () => {
  it("does not invoke Workers AI when a literal result already exists", async () => {
    const { requestContext, aiRun, vectorQuery } = context({ literal: true, query: "迁移" });

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
  });

  it("returns a Chinese migration note for an English migrate vector match", async () => {
    const { requestContext, aiRun, vectorQuery } = context({ literal: false, query: "migrate" });

    const response = await semanticSearch(requestContext);
    const payload = await response.json() as {
      topK: number;
      results: Array<{ title: string; matchType: string }>;
    };

    expect(aiRun).toHaveBeenCalledTimes(1);
    expect(vectorQuery).toHaveBeenCalledWith([0.1, 0.2, 0.3], {
      topK: 16,
      returnMetadata: "none",
    });
    expect(payload.topK).toBe(8);
    expect(payload.results).toHaveLength(1);
    expect(payload.results[0]).toMatchObject({
      title: "resource-base 库下线迁移",
      matchType: "semantic",
    });
  });

  it("still rejects weak candidates instead of matching every query", async () => {
    const { requestContext } = context({
      literal: false,
      query: "unrelated-query-9d23",
      score: 0.44,
    });

    const response = await semanticSearch(requestContext);
    const payload = await response.json() as {
      minimumScore: number;
      topCandidateScore: number;
      results: unknown[];
    };

    expect(payload.minimumScore).toBe(0.45);
    expect(payload.topCandidateScore).toBe(0.44);
    expect(payload.results).toEqual([]);
  });
});
