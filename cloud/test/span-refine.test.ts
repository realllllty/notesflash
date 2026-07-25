import { describe, expect, it, vi } from "vitest";

import { semanticConfig } from "../src/semantic-config";
import type { ChunkHit } from "../src/semantic-core";
import { DEFAULT_SPAN_REFINE, refineSpans, spanCandidates } from "../src/span-refine";
import type { Env } from "../src/types";

const chunkText = "每天检查健康接口是否返回 200。\n如果向量数量少于数据库记录数，就重新排队所有笔记重建索引。\n定时任务失败要人工重跑一次。";

function hit(overrides: Partial<ChunkHit> = {}): ChunkHit {
  return {
    noteId: "note-1",
    chunkId: "note-1:abc123:1",
    chunkIndex: 1,
    kind: "body",
    primaryLine: 1,
    lineStart: 1,
    lineEnd: 3,
    charStart: 100,
    charEnd: 100 + chunkText.length,
    score: 0.6,
    text: chunkText,
    ...overrides,
  };
}

/** Scores the candidate containing `needle` highest, everything else low. */
function env(needle: string, calls: { count: number } = { count: 0 }): Env {
  return {
    AI: {
      run: vi.fn(async (_model: string, input: Record<string, unknown>) => {
        calls.count += 1;
        const texts = input.text as string[];
        return {
          data: texts.map((text) => {
            const value = text.includes(needle) ? 0.95 : 0.2;
            const vector = new Array(768).fill(0);
            vector[0] = value;
            vector[1] = Math.sqrt(Math.max(0, 1 - value * value));
            return vector;
          }),
        };
      }),
    },
  } as unknown as Env;
}

const config = semanticConfig({} as Env);
const queryVector = (() => {
  const vector = new Array(768).fill(0);
  vector[0] = 1;
  return vector;
})();

describe("spanCandidates", () => {
  it("offers whole lines and clause splits, shortest first", () => {
    const candidates = spanCandidates(chunkText, 24);

    expect(candidates.length).toBeGreaterThan(3);
    for (const candidate of candidates) {
      expect(chunkText.slice(candidate.start, candidate.end)).toBe(candidate.text);
      expect(candidate.text).toBe(candidate.text.trim());
    }
    // Sorted by length so the most precise highlight wins ties.
    for (let index = 1; index < candidates.length; index += 1) {
      const previous = candidates[index - 1];
      const current = candidates[index];
      expect(previous.end - previous.start).toBeLessThanOrEqual(current.end - current.start);
    }
    expect(candidates.some((candidate) => candidate.text === "如果向量数量少于数据库记录数")).toBe(true);
  });

  it("respects the candidate cap and skips blank lines", () => {
    expect(spanCandidates(chunkText, 4)).toHaveLength(4);
    expect(spanCandidates("\n\n   \n", 10)).toEqual([]);
  });

  it("splits latin text on clause punctuation", () => {
    const text = "Rotate the image signing key if a signed URL leaks, then audit the device list.";
    const candidates = spanCandidates(text, 24);
    expect(candidates.some((candidate) => candidate.text.startsWith("then audit"))).toBe(true);
  });

  it("never splits inside a number or abbreviation", () => {
    const text = "Text embeddings cost $0.012 per million input tokens, e.g. for indexing.";
    for (const candidate of spanCandidates(text, 24)) {
      expect(candidate.text).not.toMatch(/\$0$/);
      expect(candidate.text).not.toMatch(/^012/);
    }
  });
});

describe("refineSpans", () => {
  it("narrows the match to the best sub-span and keeps offsets exact", async () => {
    const target = hit();
    const calls = { count: 0 };
    const stats = await refineSpans(
      env("向量数量", calls),
      config,
      queryVector,
      [{ matches: [target] }],
      { ...DEFAULT_SPAN_REFINE, enabled: true },
    );

    expect(stats.refinedCount).toBe(1);
    expect(calls.count).toBe(1);
    expect(target.text).toContain("向量数量");
    expect(target.text.length).toBeLessThan(chunkText.length);
    // Offsets remain absolute body offsets for the narrowed span.
    expect(target.charStart).toBe(100 + chunkText.indexOf(target.text as string));
    expect((target.charEnd as number) - (target.charStart as number)).toBe(
      (target.text as string).length,
    );
    // The anchor line follows the refined span.
    expect(target.primaryLine).toBe(2);
    expect(target.lineStart).toBe(2);
    expect(target.lineEnd).toBe(2);
  });

  it("keeps the chunk when no sub-span holds the score", async () => {
    const target = hit();
    const stats = await refineSpans(
      env("完全不存在的短语"),
      config,
      queryVector,
      [{ matches: [target] }],
      { ...DEFAULT_SPAN_REFINE, enabled: true },
    );

    expect(stats.refinedCount).toBe(0);
    expect(target.text).toBe(chunkText);
    expect(target.charStart).toBe(100);
  });

  it("does nothing when disabled, for short chunks, or without body matches", async () => {
    const calls = { count: 0 };
    const disabled = hit();
    expect(
      (await refineSpans(env("向量", calls), config, queryVector, [{ matches: [disabled] }], {
        ...DEFAULT_SPAN_REFINE,
        enabled: false,
      })).refinedCount,
    ).toBe(0);

    const short = hit({ text: "短行", charEnd: 102 });
    expect(
      (await refineSpans(env("短行", calls), config, queryVector, [{ matches: [short] }], {
        ...DEFAULT_SPAN_REFINE,
        enabled: true,
      })).refinedCount,
    ).toBe(0);

    const titleOnly = hit({ kind: "title", charStart: null, charEnd: null });
    expect(
      (await refineSpans(env("标题", calls), config, queryVector, [{ matches: [titleOnly] }], {
        ...DEFAULT_SPAN_REFINE,
        enabled: true,
      })).refinedCount,
    ).toBe(0);
    expect(calls.count).toBe(0);
  });

  it("keeps the match when Workers AI fails", async () => {
    const target = hit();
    const failing = {
      AI: {
        run: vi.fn(async () => {
          throw new Error("Workers AI unavailable");
        }),
      },
    } as unknown as Env;

    const stats = await refineSpans(failing, config, queryVector, [{ matches: [target] }], {
      ...DEFAULT_SPAN_REFINE,
      enabled: true,
    });

    expect(stats.refinedCount).toBe(0);
    expect(target.text).toBe(chunkText);
  });

  it("limits refinement to the configured number of notes", async () => {
    const first = hit({ noteId: "note-1" });
    const second = hit({ noteId: "note-2" });
    const third = hit({ noteId: "note-3" });

    const stats = await refineSpans(
      env("向量数量"),
      config,
      queryVector,
      [{ matches: [first] }, { matches: [second] }, { matches: [third] }],
      { ...DEFAULT_SPAN_REFINE, enabled: true, maxNotes: 2 },
    );

    expect(stats.refinedCount).toBe(2);
    expect(third.text).toBe(chunkText);
  });
});
