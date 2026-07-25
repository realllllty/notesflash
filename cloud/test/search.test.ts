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
  /** Scores returned by the contextual short-query view. */
  expandedScores?: Record<string, number>;
  expandedDefaultScore?: number;
  /** Chunk ids returned by Vectorize but stale in D1. */
  staleChunkIds?: string[];
  /** Allow selected current chunks to appear while a note is still pending. */
  indexedChunkNeedles?: string[];
  vectorError?: Error;
  expandedVectorError?: Error;
  embeddingError?: Error;
  /** Fail document embeddings while allowing the query embedding to succeed. */
  inlineEmbeddingError?: Error;
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
  const scoreForText = (
    text: string,
    scores = options.scores ?? {},
    fallback = defaultScore,
  ) => {
    for (const [needle, score] of Object.entries(scores)) {
      if (text.includes(needle)) return score;
    }
    return fallback;
  };

  const embed = vi.fn(async (_model: string, input: Record<string, unknown>) => {
    const texts = (input.text ?? input.queries ?? input.documents) as string[];
    const isQuery = input.queries !== undefined ||
      (typeof texts[0] === "string" && texts[0].startsWith("task: search result | query: "));
    if (options.embeddingError) throw options.embeddingError;
    if (!isQuery && options.inlineEmbeddingError) throw options.inlineEmbeddingError;
    // A two-dimension stub: the query is the unit vector [1, 0, ...] and each
    // document vector encodes its intended cosine similarity directly.
    return {
      data: texts.map((text) => {
        const vector = new Array(768).fill(0);
        if (isQuery) {
          const expanded = text.startsWith(
            "task: search result | query: notes related to ",
          );
          vector[expanded ? 1 : 0] = 1;
          return vector;
        }
        const rawScore = scoreForText(text);
        const expandedScore = scoreForText(
          text,
          options.expandedScores,
          options.expandedDefaultScore ?? defaultScore,
        );
        vector[0] = rawScore;
        vector[1] = expandedScore;
        vector[2] = Math.sqrt(Math.max(0, 1 - rawScore * rawScore - expandedScore * expandedScore));
        return vector;
      }),
    };
  });

  const vectorQuery = vi.fn(async (queryVector: number[], queryOptions?: { topK?: number }) => {
    if (options.vectorError) throw options.vectorError;
    const expanded = queryVector[1] === 1;
    if (expanded && options.expandedVectorError) throw options.expandedVectorError;
    return {
      matches: chunkRows
        .filter((row) =>
          row.note.embedding_status === "ready" ||
          options.indexedChunkNeedles?.some((needle) => row.chunk.text.includes(needle))
        )
        .map((row) => ({
          id: row.chunk_id,
          score: expanded
            ? scoreForText(
              row.chunk.text,
              options.expandedScores,
              options.expandedDefaultScore ?? defaultScore,
            )
            : scoreForText(row.chunk.text),
        }))
        .sort((left, right) => right.score - left.score || left.id.localeCompare(right.id))
        .slice(0, queryOptions?.topK ?? Number.POSITIVE_INFINITY),
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
          if (sql.includes("embedding_status IN ('pending', 'processing')")) {
            return {
              count: liveNotes.filter((row) =>
                row.embedding_status === "pending" || row.embedding_status === "processing"
              ).length,
            };
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
          if (sql.includes("embedding_status IN ('pending', 'processing')")) {
            const pendingRows = liveNotes.filter((row) =>
              row.embedding_status === "pending" || row.embedding_status === "processing"
            );
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
  it("ignores fallbackOnly=false and skips Workers AI and Vectorize on a literal match", async () => {
    const { requestContext, embed, vectorQuery } = context({
      literal: true,
      query: "literal-short-circuit-query",
      notes: [crossLanguageNote],
      fallbackOnly: false,
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

  it("rescues entry to the Chinese entrance line with one batched embedding call", async () => {
    const strong = note("note-strong", "Other semantic result", "A stronger raw-only match.");
    const entrance = note(
      "note-entrance",
      "恢复说明",
      "回收站保留三十天。\n目前恢复入口只有接口，没有界面。\n接口恢复说明位于文档末尾。",
    );
    const { requestContext, embed, vectorQuery } = context({
      query: "entry",
      notes: [strong, entrance],
      scores: {
        "stronger raw-only": 0.333,
        "目前恢复入口": 0.252,
        "接口恢复说明": 0.257,
      },
      expandedScores: {
        "stronger raw-only": 0.2,
        "目前恢复入口": 0.322,
        "接口恢复说明": 0.249,
      },
      env: {
        SEMANTIC_CHUNK_MAX_LINES: "1",
        SEMANTIC_CHUNK_OVERLAP_LINES: "0",
      },
    });

    const payload = await (await semanticSearch(requestContext)).json() as {
      shortQueryRescue: {
        eligible: boolean;
        applied: boolean;
        consensusChunkCount: number;
        addedNoteCount: number;
      };
      results: Array<{
        id: string;
        score: number;
        matches: Array<{ text: string; lineNumber: number; score: number }>;
      }>;
    };

    expect(payload.results.map((result) => result.id)).toEqual(["note-strong", "note-entrance"]);
    expect(payload.results[1].score).toBeCloseTo(0.252, 6);
    expect(payload.results[1].matches[0]).toMatchObject({ lineNumber: 2, score: 0.252 });
    expect(payload.results[1].matches[0].text).toContain("入口");
    expect(payload.shortQueryRescue).toMatchObject({
      eligible: true,
      applied: true,
      consensusChunkCount: 1,
      addedNoteCount: 1,
    });
    expect(vectorQuery).toHaveBeenCalledTimes(2);

    const queryInputs = embed.mock.calls
      .map((call) => call[1] as Record<string, unknown>)
      .map((input) => input.text)
      .filter((texts): texts is string[] =>
        Array.isArray(texts) && texts.some((text) => text.includes("query: entry"))
      );
    expect(queryInputs).toEqual([[
      "task: search result | query: entry",
      "task: search result | query: notes related to entry",
    ]]);
  });

  it("does not let an expanded-only match through the consensus gate", async () => {
    const entrance = note("note-expanded-only", "恢复说明", "目前恢复入口只有接口，没有界面。");
    const { requestContext } = context({
      query: "entry-expanded-only",
      notes: [entrance],
      scores: { "目前恢复入口": 0.22 },
      expandedScores: { "目前恢复入口": 0.9 },
      // Keep this synthetic query eligible despite its descriptive fixture name.
      env: { SEMANTIC_SHORT_QUERY_MAX_CODEPOINTS: "40" },
    });

    const payload = await (await semanticSearch(requestContext)).json() as {
      shortQueryRescue: { consensusChunkCount: number };
      results: unknown[];
    };
    expect(payload.results).toEqual([]);
    expect(payload.shortQueryRescue.consensusChunkCount).toBe(0);
  });

  it("keeps primary results when the optional expanded Vectorize lookup fails", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      const { requestContext, vectorQuery } = context({
        query: "entry-vector-degrade",
        notes: [crossLanguageNote],
        scores: { "We migrate the legacy notes": 0.62 },
        expandedVectorError: new Error("expanded lookup unavailable"),
        env: { SEMANTIC_SHORT_QUERY_MAX_CODEPOINTS: "40" },
      });

      const payload = await (await semanticSearch(requestContext)).json() as {
        shortQueryRescue: {
          attempted: boolean;
          applied: boolean;
          expandedIndexAvailable: boolean;
          expandedVectorizeFailed: boolean;
          addedNoteCount: number;
        };
        results: Array<{ id: string }>;
      };
      expect(payload.results.map((result) => result.id)).toEqual(["note-en"]);
      expect(payload.shortQueryRescue).toMatchObject({
        attempted: true,
        applied: false,
        expandedIndexAvailable: false,
        expandedVectorizeFailed: true,
        addedNoteCount: 0,
      });
      expect(vectorQuery).toHaveBeenCalledTimes(2);
    } finally {
      error.mockRestore();
    }
  });

  it("uses one query view when short-query rescue is disabled", async () => {
    const { requestContext, embed, vectorQuery } = context({
      query: "entry-disabled",
      notes: [crossLanguageNote],
      scores: { "We migrate the legacy notes": 0.62 },
      env: { SEMANTIC_SHORT_QUERY_RESCUE: "false" },
    });

    const payload = await (await semanticSearch(requestContext)).json() as {
      shortQueryRescue: { eligible: boolean; attempted: boolean; applied: boolean };
    };
    expect(payload.shortQueryRescue).toMatchObject({
      eligible: false,
      attempted: false,
      applied: false,
    });
    expect(vectorQuery).toHaveBeenCalledTimes(1);
    const queryBatch = embed.mock.calls
      .map((call) => (call[1] as Record<string, unknown>).text)
      .find((texts) => Array.isArray(texts) && texts.some((text) => String(text).includes("entry-disabled")));
    expect(queryBatch).toHaveLength(1);
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

  it("overfetches index candidates, removes stale ids, and restores the configured valid budget", async () => {
    const stale = note("note-stale", "Stale title", "stale top result");
    const first = note("note-valid-a", "Valid A", "first valid result");
    const second = note("note-valid-b", "Valid B", "second valid result");
    const third = note("note-valid-c", "Valid C", "third valid result");
    const staleBody = chunkRowsFor([stale]).find((row) => row.text.includes("stale top result"));
    const { requestContext, vectorQuery } = context({
      query: "stale overfetch regression query with context",
      notes: [stale, first, second, third],
      scores: {
        "stale top result": 0.99,
        "first valid result": 0.9,
        "second valid result": 0.8,
        "third valid result": 0.7,
      },
      defaultScore: 0.05,
      staleChunkIds: [staleBody?.chunk_id ?? ""],
      env: {
        SEMANTIC_CHUNK_TOP_K: "2",
        SEMANTIC_RELATIVE_MIN_RATIO: "0",
      },
    });

    const payload = await (await semanticSearch(requestContext)).json() as {
      candidateChunkCount: number;
      resolvedChunkCount: number;
      indexedUsedChunkCount: number;
      usedChunkCount: number;
      results: Array<{ id: string }>;
    };

    expect(vectorQuery).toHaveBeenCalledTimes(1);
    expect(vectorQuery.mock.calls[0][1]).toMatchObject({ topK: 4 });
    expect(payload).toMatchObject({
      candidateChunkCount: 4,
      resolvedChunkCount: 3,
      indexedUsedChunkCount: 2,
      usedChunkCount: 2,
    });
    expect(payload.results.map((result) => result.id)).toEqual(["note-valid-a", "note-valid-b"]);
  });

  it("caps Vectorize overfetch at the metadata-free query maximum", async () => {
    const { requestContext, vectorQuery } = context({
      query: "bounded overfetch maximum regression query",
      notes: [crossLanguageNote],
      scores: { "We migrate the legacy notes": 0.8 },
      env: { SEMANTIC_CHUNK_TOP_K: "60" },
    });

    await semanticSearch(requestContext);

    expect(vectorQuery).toHaveBeenCalledTimes(1);
    expect(vectorQuery.mock.calls[0][1]).toMatchObject({ topK: 100 });
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

  it("uses the same global chunk budget before and after pending notes become ready", async () => {
    const notes = [
      note("note-budget-a", "Budget A", "highest budget result"),
      note("note-budget-b", "Budget B", "second budget result"),
      note("note-budget-c", "Budget C", "third budget result"),
    ];
    const scores = {
      "highest budget result": 0.9,
      "second budget result": 0.8,
      "third budget result": 0.7,
    };
    const sharedEnv = {
      SEMANTIC_CHUNK_TOP_K: "2",
      SEMANTIC_RELATIVE_MIN_RATIO: "0",
    };

    const ready = context({
      query: "ready candidate budget regression query",
      notes,
      scores,
      expandedScores: {},
      defaultScore: 0.05,
      expandedDefaultScore: 0,
      env: sharedEnv,
    });
    const readyPayload = await (await semanticSearch(ready.requestContext)).json() as {
      usedChunkCount: number;
      results: Array<{ id: string; score: number }>;
    };

    const pendingNotes = notes.map((row) => ({ ...row, embedding_status: "pending" }));
    const pending = context({
      query: "pending candidate budget regression query",
      notes: pendingNotes,
      scores,
      expandedScores: {},
      defaultScore: 0.05,
      expandedDefaultScore: 0,
      env: sharedEnv,
    });
    const pendingPayload = await (await semanticSearch(pending.requestContext)).json() as {
      indexedUsedChunkCount: number;
      usedChunkCount: number;
      pendingNotesScored: number;
      results: Array<{ id: string; score: number }>;
    };

    expect(readyPayload.usedChunkCount).toBe(2);
    expect(pendingPayload).toMatchObject({
      indexedUsedChunkCount: 0,
      usedChunkCount: 2,
      pendingNotesScored: 3,
    });
    expect(pendingPayload.results.map((result) => result.id)).toEqual(
      readyPayload.results.map((result) => result.id),
    );
    expect(pendingPayload.results.map((result) => result.score)).toEqual(
      readyPayload.results.map((result) => result.score),
    );
    expect(readyPayload.results.map((result) => result.id)).toEqual([
      "note-budget-a",
      "note-budget-b",
    ]);
  });

  it("excludes failed and disabled notes from the inline freshness fallback", async () => {
    const ready = note("note-ready-only", "Ready", "indexed healthy result");
    const failed = note("note-failed", "Failed", "failed note must stay out of inline scoring");
    failed.embedding_status = "failed";
    const disabled = note("note-disabled", "Disabled", "disabled note must stay out of inline scoring");
    disabled.embedding_status = "disabled";
    const { requestContext, embed } = context({
      query: "status exclusion regression query with context",
      notes: [ready, failed, disabled],
      scores: { "indexed healthy result": 0.8 },
    });

    const payload = await (await semanticSearch(requestContext)).json() as {
      pendingIndexCount: number;
      pendingNotesScored: number;
      pendingFallback: { attempted: boolean; degraded: boolean };
      results: Array<{ id: string }>;
    };
    const embeddedText = JSON.stringify(embed.mock.calls.map((call) => call[1]));

    expect(payload).toMatchObject({
      pendingIndexCount: 0,
      pendingNotesScored: 0,
      pendingFallback: { attempted: false, degraded: false },
    });
    expect(payload.results.map((result) => result.id)).toEqual(["note-ready-only"]);
    expect(embeddedText).not.toContain("failed note must stay out");
    expect(embeddedText).not.toContain("disabled note must stay out");
  });

  it("keeps indexed results when inline pending-note embedding fails", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    try {
      const ready = note("note-indexed-survivor", "Indexed", "healthy indexed answer");
      const pending = note("note-inline-failure", "Pending", "inline document that fails");
      pending.embedding_status = "pending";
      const { requestContext } = context({
        query: "inline failure isolation regression query",
        notes: [ready, pending],
        scores: { "healthy indexed answer": 0.82 },
        inlineEmbeddingError: new Error("inline document embedding unavailable"),
      });

      const payload = await (await semanticSearch(requestContext)).json() as {
        pendingIndexCount: number;
        pendingNotesScored: number;
        pendingFallback: { attempted: boolean; degraded: boolean };
        results: Array<{ id: string }>;
      };

      expect(payload).toMatchObject({
        pendingIndexCount: 1,
        pendingNotesScored: 0,
        pendingFallback: { attempted: true, degraded: true },
      });
      expect(payload.results.map((result) => result.id)).toEqual(["note-indexed-survivor"]);
      expect(warn).toHaveBeenCalledOnce();
    } finally {
      warn.mockRestore();
    }
  });

  it("merges pending chunks with partial indexed coverage per chunk", async () => {
    const pending = note(
      "note-partial",
      "恢复说明",
      "目前恢复入口只有接口，没有界面。\n接口恢复说明位于文档末尾。",
    );
    pending.embedding_status = "processing";
    const { requestContext } = context({
      query: "entry-partial-index",
      notes: [pending],
      indexedChunkNeedles: ["接口恢复说明"],
      scores: {
        "目前恢复入口": 0.252,
        "接口恢复说明": 0.257,
      },
      expandedScores: {
        "目前恢复入口": 0.322,
        "接口恢复说明": 0.249,
      },
      env: {
        SEMANTIC_SHORT_QUERY_MAX_CODEPOINTS: "40",
        SEMANTIC_CHUNK_MAX_LINES: "1",
        SEMANTIC_CHUNK_OVERLAP_LINES: "0",
      },
    });

    const payload = await (await semanticSearch(requestContext)).json() as {
      shortQueryRescue: { consensusChunkCount: number; addedNoteCount: number };
      results: Array<{ id: string; matches: Array<{ text: string; lineNumber: number }> }>;
    };
    expect(payload.results[0].id).toBe("note-partial");
    expect(payload.results[0].matches[0]).toMatchObject({ lineNumber: 1 });
    expect(payload.results[0].matches[0].text).toContain("入口");
    expect(payload.shortQueryRescue).toMatchObject({
      consensusChunkCount: 1,
      addedNoteCount: 1,
    });
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

  it("narrows the highlighted span when refinement is enabled", async () => {
    const note = crossLanguageNote;
    const { requestContext } = context({
      query: "span-refine-enabled-query",
      notes: [note],
      scores: {
        "We migrate the legacy notes": 0.62,
        // The refinement pass scores this candidate at least as well as the
        // chunk, so the highlight narrows to the sentence.
        "We migrate the legacy notes into the new schema.": 0.7,
      },
      env: { SEMANTIC_SPAN_REFINE: "true" },
    });

    const payload = await (await semanticSearch(requestContext)).json() as {
      spanRefinement: { refinedMatchCount: number; candidateCount: number };
      results: Array<{
        matches: Array<{
          text: string;
          lineNumber: number;
          lineStart: number;
          lineEnd: number;
          charStart: number;
          charEnd: number;
        }>;
      }>;
    };

    expect(payload.spanRefinement.refinedMatchCount).toBe(1);
    expect(payload.spanRefinement.candidateCount).toBeGreaterThan(0);
    const [match] = payload.results[0].matches;
    expect(match.text).toBe("We migrate the legacy notes into the new schema.");
    expect(match).toMatchObject({ lineNumber: 3, lineStart: 3, lineEnd: 3 });
    expect(note.body.slice(match.charStart, match.charEnd)).toBe(match.text);
  });

  it("reports no refinement when the feature is off", async () => {
    const { requestContext } = context({
      query: "span-refine-disabled-query",
      notes: [crossLanguageNote],
      scores: { "We migrate the legacy notes": 0.62 },
    });

    const payload = await (await semanticSearch(requestContext)).json() as {
      spanRefinement: unknown;
    };
    expect(payload.spanRefinement).toBeNull();
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
