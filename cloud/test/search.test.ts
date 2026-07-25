import { describe, expect, it, vi } from "vitest";

import { buildIdentifiedNoteChunks, DEFAULT_CHUNKING, resolveChunkingOptions } from "../src/chunking";
import { searchIndexStatus, semanticSearch } from "../src/search";
import type { NoteRow, RequestContext } from "../src/types";

interface ContextOptions {
  query: string;
  literal?: boolean;
  notes?: NoteRow[];
  /**
   * Cosine score per chunk, keyed by a substring of the chunk text. The first
   * matching key wins; anything unmatched scores `defaultScore`. Keying on text
   * keeps these tests independent of how chunk windows happen to split.
   */
  scores?: Record<string, number>;
  defaultScore?: number;
  /** Chunk ids returned by Vectorize but stale in D1. */
  staleChunkIds?: string[];
  vectorError?: Error;
  embeddingError?: Error;
  env?: Record<string, string>;
  limit?: number;
  fallbackOnly?: boolean;
}

function note(id: string, title: string, body: string): NoteRow {
  return {
    rowid: Number.parseInt(id.replace(/\D/g, ""), 10) || 1,
    id,
    title,
    body,
    version: 1,
    content_hash: `hash${id.replace(/\W/g, "")}`,
    mutation_id: null,
    created_at: 1,
    updated_at: 2,
    last_opened_at: null,
    pinned: 0,
    archived: 0,
    deleted_at: null,
    embedding_status: "ready",
    embedding_model: "@cf/google/embeddinggemma-300m",
    embedded_content_hash: `hash${id.replace(/\W/g, "")}`,
    embedding_vector_id: null,
    embedding_updated_at: 3,
    embedding_error_code: null,
  };
}

function chunkRowsFor(notes: NoteRow[], chunking = DEFAULT_CHUNKING) {
  return notes.flatMap((row) =>
    buildIdentifiedNoteChunks(
      { noteId: row.id, title: row.title, body: row.body, contentHash: row.content_hash },
      chunking,
    ).map((chunk) => ({
      chunk_id: chunk.chunkId,
      note_id: row.id,
      content_hash: row.content_hash,
      chunk_index: chunk.chunkIndex,
      kind: chunk.kind,
      primary_line: chunk.primaryLine,
      line_start: chunk.lineStart,
      line_end: chunk.lineEnd,
      char_start: chunk.charStart,
      char_end: chunk.charEnd,
      text: chunk.text,
      created_at: 4,
      note_title: row.title,
      note_body: row.body,
      note: row,
      chunk,
    }))
  );
}

function context(options: ContextOptions) {
  const allNotes = options.notes ?? [];
  const liveNotes = allNotes.filter((row) => row.deleted_at === null);
  const env = options.env ?? {};
  // Fixtures use the same chunk shape the Worker will resolve from the
  // environment, so a chunk id in Vectorize always resolves in D1.
  const chunking = resolveChunkingOptions({
    maxLines: env.SEMANTIC_CHUNK_MAX_LINES === undefined
      ? undefined
      : Number(env.SEMANTIC_CHUNK_MAX_LINES),
    overlapLines: env.SEMANTIC_CHUNK_OVERLAP_LINES === undefined
      ? undefined
      : Number(env.SEMANTIC_CHUNK_OVERLAP_LINES),
  });
  const chunkRows = chunkRowsFor(allNotes, chunking);
  const defaultScore = options.defaultScore ?? 0.1;
  const scoreForText = (text: string) => {
    for (const [needle, score] of Object.entries(options.scores ?? {})) {
      if (text.includes(needle)) return score;
    }
    return defaultScore;
  };

  const embed = vi.fn(async (_model: string, input: Record<string, unknown>) => {
    if (options.embeddingError) throw options.embeddingError;
    const texts = (input.text ?? input.queries ?? input.documents) as string[];
    const isQuery = input.queries !== undefined ||
      (typeof texts[0] === "string" && texts[0].startsWith("task: search result | query: "));
    // A two-dimension stub: the query is the unit vector [1, 0, ...] and each
    // document vector encodes its intended cosine similarity directly.
    return {
      data: texts.map((text) => {
        const value = isQuery ? 1 : scoreForText(text);
        const vector = new Array(768).fill(0);
        vector[0] = value;
        vector[1] = isQuery ? 0 : Math.sqrt(Math.max(0, 1 - value * value));
        return vector;
      }),
    };
  });

  const vectorQuery = vi.fn(async () => {
    if (options.vectorError) throw options.vectorError;
    return {
      matches: chunkRows
        .filter((row) => row.note.embedding_status === "ready")
        .map((row) => ({ id: row.chunk_id, score: scoreForText(row.chunk.text) }))
        .sort((left, right) => right.score - left.score),
    };
  });

  const preparedSql: string[] = [];
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
          if (sql.includes("FROM notes_fts")) return options.literal ? { found: 1 } : null;
          if (sql.includes("instr(lower(title)")) return options.literal ? { found: 1 } : null;
          if (sql.includes("embedding_status != 'ready'")) {
            return { count: liveNotes.filter((row) => row.embedding_status !== "ready").length };
          }
          if (sql.includes("FROM note_chunks c")) {
            return {
              count: chunkRows.filter((row) => row.note.deleted_at === null).length,
            };
          }
          if (sql.includes("SUM(CASE WHEN embedding_status")) {
            return {
              notes: liveNotes.length,
              ready: liveNotes.filter((row) => row.embedding_status === "ready").length,
              pending: liveNotes.filter((row) => row.embedding_status === "pending").length,
              failed: 0,
            };
          }
          return null;
        },
        async all() {
          if (sql.includes("FROM note_chunks c")) {
            const ids = new Set(bound.map(String));
            return {
              results: chunkRows.filter((row) =>
                ids.has(row.chunk_id) &&
                row.note.deleted_at === null &&
                !options.staleChunkIds?.includes(row.chunk_id)
              ),
            };
          }
          if (sql.includes("embedding_status != 'ready'")) {
            const pendingRows = liveNotes.filter((row) => row.embedding_status !== "ready");
            return {
              results: pendingRows.map((row) => ({
                id: row.id,
                title: row.title,
                body: row.body,
                content_hash: row.content_hash,
              })),
            };
          }
          if (sql.includes("AND id IN")) {
            const ids = new Set(bound.map(String));
            return { results: liveNotes.filter((row) => ids.has(row.id)) };
          }
          if (sql.includes("FROM note_images")) return { results: [] };
          return { results: [] };
        },
        async run() {
          return { meta: { changes: 1 } };
        },
      };
    },
  };

  const request = new Request("https://notes.example/api/search/semantic", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      query: options.query,
      limit: options.limit,
      fallbackOnly: options.fallbackOnly,
    }),
  });

  const requestContext = {
    env: {
      DB: db,
      AI: { run: embed },
      CHUNK_INDEX: {
        query: vectorQuery,
        describe: vi.fn(async () => ({ vectorCount: chunkRows.length })),
      },
      VECTOR_INDEX: { query: vi.fn(), deleteByIds: vi.fn() },
      ...options.env,
    },
    request,
    url: new URL(request.url),
    requestId: "test-request",
    principal: { deviceId: "device-1", deviceName: "test", sessionId: "session-1" },
  } as unknown as RequestContext;

  return { requestContext, embed, vectorQuery, preparedSql, chunkRows };
}

const crossLanguageNote = note(
  "note-en",
  "Legacy data migration runbook",
  "Owner: platform team\nStatus: in review\nWe migrate the legacy notes into the new schema.",
);
const unrelatedNote = note("note-lunch", "午餐记录", "今天吃了牛肉面，汤头偏咸。");

describe("chunk-level semantic search", () => {
  it("skips Workers AI and Vectorize when a literal match exists", async () => {
    const { requestContext, embed, vectorQuery } = context({
      literal: true,
      query: "literal-short-circuit-query",
      notes: [crossLanguageNote],
    });

    const payload = await (await semanticSearch(requestContext)).json() as Record<string, unknown>;

    expect(payload).toMatchObject({
      strategy: "lexical-first",
      semanticSkipped: true,
      reason: "literal-match-exists",
      results: [],
    });
    expect(embed).not.toHaveBeenCalled();
    expect(vectorQuery).not.toHaveBeenCalled();
  });

  it("returns the matched line with character offsets", async () => {
    const { requestContext } = context({
      query: "cross-language-line-query",
      notes: [crossLanguageNote, unrelatedNote],
      scores: { "We migrate the legacy notes": 0.62, "牛肉面": 0.12 },
    });

    const payload = await (await semanticSearch(requestContext)).json() as {
      rankingStrategy: string;
      embeddingModel: string;
      results: Array<{
        id: string;
        score: number;
        matches: Array<{
          kind: string;
          lineNumber: number;
          rawLineIndex: number;
          charStart: number;
          charEnd: number;
          text: string;
          score: number;
        }>;
      }>;
    };

    expect(payload.rankingStrategy).toBe("chunk-vector-recall");
    expect(payload.embeddingModel).toBe("@cf/google/embeddinggemma-300m");
    expect(payload.results).toHaveLength(1);
    const [result] = payload.results;
    expect(result.id).toBe("note-en");
    expect(result.score).toBeCloseTo(0.62, 6);
    const [match] = result.matches;
    expect(match.kind).toBe("body");
    expect(match.lineNumber).toBe(3);
    expect(match.rawLineIndex).toBe(2);
    expect(crossLanguageNote.body.slice(match.charStart, match.charEnd)).toBe(match.text);
    expect(match.text).toContain("We migrate the legacy notes");
  });

  it("returns nothing when every chunk is below the absolute floor", async () => {
    const { requestContext } = context({
      query: "below-absolute-floor-query",
      notes: [crossLanguageNote, unrelatedNote],
      scores: { "We migrate the legacy notes": 0.24 },
      defaultScore: 0.2,
    });

    const payload = await (await semanticSearch(requestContext)).json() as {
      results: unknown[];
      topChunkScore: number;
      effectiveFloor: number;
      matchedChunkCount: number;
    };

    expect(payload.results).toEqual([]);
    expect(payload.matchedChunkCount).toBe(0);
    expect(payload.topChunkScore).toBeCloseTo(0.24, 6);
    expect(payload.effectiveFloor).toBeCloseTo(0.3, 6);
  });

  it("suppresses a weak tail behind a clearly better chunk", async () => {
    const { requestContext } = context({
      query: "relative-floor-query",
      notes: [crossLanguageNote, unrelatedNote],
      scores: { "We migrate the legacy notes": 0.8, "牛肉面": 0.45 },
    });

    const payload = await (await semanticSearch(requestContext)).json() as {
      effectiveFloor: number;
      results: Array<{ id: string }>;
    };

    expect(payload.effectiveFloor).toBeCloseTo(0.48, 6);
    expect(payload.results.map((result) => result.id)).toEqual(["note-en"]);
  });

  it("drops chunks that no longer match the current note content", async () => {
    const chunks = buildIdentifiedNoteChunks(
      {
        noteId: crossLanguageNote.id,
        title: crossLanguageNote.title,
        body: crossLanguageNote.body,
        contentHash: crossLanguageNote.content_hash,
      },
      DEFAULT_CHUNKING,
    );
    const bodyChunk = chunks.find((chunk) => chunk.text.includes("We migrate the legacy notes"));
    const { requestContext } = context({
      query: "stale-chunk-query",
      notes: [crossLanguageNote],
      scores: { "We migrate the legacy notes": 0.9 },
      staleChunkIds: [bodyChunk?.chunkId ?? ""],
    });

    const payload = await (await semanticSearch(requestContext)).json() as {
      candidateChunkCount: number;
      resolvedChunkCount: number;
      results: unknown[];
    };

    expect(payload.candidateChunkCount).toBeGreaterThan(payload.resolvedChunkCount);
    // Only the low-scoring title chunk survives, so nothing clears the floor.
    expect(payload.results).toEqual([]);
  });

  it("scores a freshly saved note before the indexer reaches it", async () => {
    const pendingNote = note(
      "note-pending",
      "刚保存的笔记",
      "第一行说明\n配对码十分钟后过期，只能用一次。",
    );
    pendingNote.embedding_status = "pending";
    const { requestContext } = context({
      query: "pending-note-inline-query",
      notes: [pendingNote],
      scores: { "配对码十分钟后过期": 0.71 },
    });

    const payload = await (await semanticSearch(requestContext)).json() as {
      pendingIndexCount: number;
      pendingNotesScored: number;
      results: Array<{ id: string; matches: Array<{ lineNumber: number; text: string }> }>;
    };

    expect(payload.pendingIndexCount).toBe(1);
    expect(payload.pendingNotesScored).toBe(1);
    expect(payload.results[0].id).toBe("note-pending");
    expect(payload.results[0].matches[0].text).toContain("配对码");
    expect(payload.results[0].matches[0].lineNumber).toBe(2);
  });

  it("caps matched lines per note and keeps the strongest anchor", async () => {
    const multiLine = note(
      "note-multi",
      "运维手册",
      [
        "每天检查健康接口是否返回 200。",
        "每周确认队列没有堆积。",
        "如果向量数量少于数据库记录数，就重建索引。",
        "定时任务失败要人工重跑一次。",
        "配对码过期记录保留一天。",
      ].join("\n"),
    );
    const { requestContext } = context({
      query: "max-matches-per-note-query",
      notes: [multiLine],
      scores: {
        "每周确认队列": 0.9,
        "向量数量少于数据库记录数": 0.88,
        "定时任务失败": 0.86,
        "配对码过期记录": 0.84,
      },
      env: {
        SEMANTIC_MAX_MATCHES_PER_NOTE: "2",
        SEMANTIC_CHUNK_MAX_LINES: "1",
        SEMANTIC_CHUNK_OVERLAP_LINES: "0",
      },
    });

    const payload = await (await semanticSearch(requestContext)).json() as {
      matchedChunkCount: number;
      results: Array<{ score: number; matches: Array<{ score: number; lineNumber: number }> }>;
    };

    expect(payload.matchedChunkCount).toBe(4);
    expect(payload.results[0].matches).toHaveLength(2);
    expect(payload.results[0].matches.map((match) => match.lineNumber)).toEqual([2, 3]);
    // The exposed score is the best chunk cosine; the multi-chunk bonus only
    // influences ordering, so it never inflates what the client displays.
    expect(payload.results[0].score).toBeCloseTo(0.9, 6);
  });

  it("honours the requested and configured note limits", async () => {
    const notes = [crossLanguageNote, unrelatedNote, note("note-3", "第三条", "内容三")];
    const { requestContext } = context({
      query: "note-limit-query",
      notes,
      scores: { "We migrate the legacy notes": 0.8, "牛肉面": 0.79, "内容三": 0.78 },
      limit: 1,
      env: { SEMANTIC_RELATIVE_MIN_RATIO: "0" },
    });

    const payload = await (await semanticSearch(requestContext)).json() as {
      topK: number;
      results: unknown[];
    };

    expect(payload.topK).toBe(1);
    expect(payload.results).toHaveLength(1);
  });

  it("reports a Vectorize outage as a service error", async () => {
    const { requestContext } = context({
      query: "vector-outage-query",
      notes: [crossLanguageNote],
      vectorError: new Error("Vectorize unavailable"),
    });

    await expect(semanticSearch(requestContext)).rejects.toMatchObject({
      status: 503,
      code: "VECTOR_SEARCH_UNAVAILABLE",
    });
  });

  it("reports a Workers AI outage as a service error", async () => {
    const { requestContext, vectorQuery } = context({
      query: "embedding-outage-query",
      notes: [crossLanguageNote],
      embeddingError: new Error("Workers AI unavailable"),
    });

    await expect(semanticSearch(requestContext)).rejects.toMatchObject({
      status: 503,
      code: "EMBEDDING_UNAVAILABLE",
    });
    expect(vectorQuery).not.toHaveBeenCalled();
  });

  it("rejects invalid configuration before calling Workers AI", async () => {
    const { requestContext, embed, vectorQuery } = context({
      query: "invalid-config-query",
      notes: [crossLanguageNote],
      env: { SEMANTIC_MIN_COSINE: "not-a-number" },
    });

    await expect(semanticSearch(requestContext)).rejects.toMatchObject({
      status: 500,
      code: "INVALID_SEMANTIC_CONFIGURATION",
    });
    expect(embed).not.toHaveBeenCalled();
    expect(vectorQuery).not.toHaveBeenCalled();
  });

  it("rejects an unsupported embedding model", async () => {
    const { requestContext } = context({
      query: "unsupported-model-query",
      notes: [crossLanguageNote],
      env: { EMBEDDING_MODEL: "@cf/openai/not-real" },
    });

    await expect(semanticSearch(requestContext)).rejects.toMatchObject({
      status: 400,
      code: "UNSUPPORTED_EMBEDDING_MODEL",
    });
  });

  it("exposes Server-Timing for each retrieval stage", async () => {
    const { requestContext } = context({
      query: "server-timing-query",
      notes: [crossLanguageNote],
      scores: { "note-en:2": 0.7 },
    });

    const response = await semanticSearch(requestContext);
    const timing = response.headers.get("server-timing") ?? "";

    for (const stage of ["embedding;", "vector;", "resolve;", "pending;", "hydrate;", "total;"]) {
      expect(timing).toContain(stage);
    }
    expect(timing).not.toContain("reranker;");
  });
});

describe("search index status", () => {
  it("reports chunk coverage and configuration", async () => {
    const pendingNote = note("note-pending", "待索引", "正文");
    pendingNote.embedding_status = "pending";
    const { requestContext } = context({
      query: "status-query",
      notes: [crossLanguageNote, pendingNote],
    });

    const payload = await (await searchIndexStatus(requestContext)).json() as Record<string, unknown>;

    expect(payload).toMatchObject({
      strategy: "chunk-vector-recall",
      comparisonScope: "line-level-chunks",
      embeddingModel: "@cf/google/embeddinggemma-300m",
      embeddingDimensions: 768,
      minCosine: 0.3,
      relativeMinRatio: 0.6,
      currentNoteCount: 2,
      readyNoteCount: 1,
      pendingNoteCount: 1,
    });
    expect(payload.currentChunkCount).toBeGreaterThan(0);
    expect(payload.indexedVectorCount).toBeGreaterThan(0);
  });
});
