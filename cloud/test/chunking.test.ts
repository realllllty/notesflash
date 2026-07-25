import { describe, expect, it } from "vitest";

import {
  buildIdentifiedNoteChunks,
  buildNoteChunks,
  chunkVectorId,
  DEFAULT_CHUNKING,
  resolveChunkingOptions,
} from "../src/chunking";

function bodyChunks(title: string, body: string, options = DEFAULT_CHUNKING) {
  return buildNoteChunks({ title, body }, options).filter((chunk) => chunk.kind === "body");
}

/** Every body chunk must be an exact slice of the original body. */
function expectExactOffsets(body: string, chunks: ReturnType<typeof bodyChunks>) {
  for (const chunk of chunks) {
    expect(chunk.charStart).not.toBeNull();
    expect(chunk.charEnd).not.toBeNull();
    expect(body.slice(chunk.charStart as number, chunk.charEnd as number)).toBe(chunk.text);
    expect(chunk.text).toBe(chunk.text.trim());
    expect(chunk.primaryLine).not.toBeNull();
    expect(chunk.primaryLine as number).toBeGreaterThanOrEqual(chunk.lineStart as number);
    expect(chunk.primaryLine as number).toBeLessThanOrEqual(chunk.lineEnd as number);
  }
}

describe("buildNoteChunks", () => {
  it("emits a title chunk and keeps body offsets exact", () => {
    const body = "第一行内容\n第二行内容";
    const chunks = buildNoteChunks({ title: "部署笔记", body });

    expect(chunks[0]).toMatchObject({
      chunkIndex: 0,
      kind: "title",
      primaryLine: null,
      charStart: null,
      charEnd: null,
      text: "部署笔记",
    });
    expectExactOffsets(body, chunks.filter((chunk) => chunk.kind === "body"));
  });

  it("merges consecutive short lines and overlaps one line between windows", () => {
    const lines = Array.from({ length: 9 }, (_, index) => `这是第 ${index + 1} 行的说明文字，包含足够多的中文字符。`);
    const body = lines.join("\n");
    const chunks = bodyChunks("窗口测试", body);

    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect((chunk.lineEnd as number) - (chunk.lineStart as number) + 1).toBeLessThanOrEqual(
        DEFAULT_CHUNKING.maxLines,
      );
      expect(chunk.text.length).toBeLessThanOrEqual(DEFAULT_CHUNKING.maxChars);
    }
    // Overlap keeps a phrase that crosses a boundary inside at least one chunk.
    expect(chunks[1].lineStart as number).toBeLessThanOrEqual(chunks[0].lineEnd as number);
    expectExactOffsets(body, chunks);
  });

  it("never merges across a blank line", () => {
    const body = "上半段的内容说明\n\n下半段的内容说明";
    const chunks = bodyChunks("段落边界", body);

    expect(chunks).toHaveLength(2);
    expect(chunks[0].text).toBe("上半段的内容说明");
    expect(chunks[1].text).toBe("下半段的内容说明");
    expectExactOffsets(body, chunks);
  });

  it("skips image marker lines and never merges across them", () => {
    const body = "配图前的说明\n[[notesflash-image:abc-123]]\n配图后的说明";
    const chunks = bodyChunks("图片行", body);

    expect(chunks.map((chunk) => chunk.text)).toEqual(["配图前的说明", "配图后的说明"]);
    for (const chunk of chunks) expect(chunk.text).not.toContain("notesflash-image");
    expectExactOffsets(body, chunks);
  });

  it("splits an over-long single line into sentence-sized chunks", () => {
    const sentence = "这是一句用于测试超长行切分的中文句子，长度足够触发切分逻辑。";
    const body = sentence.repeat(60);
    const chunks = bodyChunks("超长行", body);

    expect(chunks.length).toBeGreaterThan(3);
    for (const chunk of chunks) {
      expect(chunk.text.length).toBeLessThanOrEqual(DEFAULT_CHUNKING.maxChars);
      expect(chunk.lineStart).toBe(1);
      expect(chunk.lineEnd).toBe(1);
    }
    expectExactOffsets(body, chunks);
  });

  it("hard-splits a long line without sentence punctuation", () => {
    const body = "a".repeat(1_500);
    const chunks = bodyChunks("无标点", body);

    expect(chunks.length).toBeGreaterThan(3);
    for (const chunk of chunks) {
      expect(chunk.text.length).toBeLessThanOrEqual(DEFAULT_CHUNKING.maxChars);
    }
    expectExactOffsets(body, chunks);
  });

  it("handles mixed CJK and Latin content", () => {
    const body = [
      "部署流程 deploy pipeline",
      "先执行 wrangler d1 migrations apply DB --remote",
      "再执行 wrangler deploy",
    ].join("\n");
    const chunks = bodyChunks("混排", body);

    expect(chunks.length).toBeGreaterThanOrEqual(1);
    expect(chunks.some((chunk) => chunk.text.includes("wrangler deploy"))).toBe(true);
    expectExactOffsets(body, chunks);
  });

  it("folds a trailing scrap line into the previous window", () => {
    const body = `${"说明文字".repeat(20)}\n好的`;
    const chunks = bodyChunks("尾部碎片", body);

    expect(chunks).toHaveLength(1);
    expect(chunks[0].lineEnd).toBe(2);
    expect(chunks[0].text.endsWith("好的")).toBe(true);
    expectExactOffsets(body, chunks);
  });

  it("keeps a note with an empty body searchable through its title", () => {
    const chunks = buildNoteChunks({ title: "只有标题", body: "" });
    expect(chunks).toHaveLength(1);
    expect(chunks[0].kind).toBe("title");
  });

  it("emits only body chunks when the note has no title", () => {
    const chunks = buildNoteChunks({ title: "   ", body: "正文第一行" });
    expect(chunks.map((chunk) => chunk.kind)).toEqual(["body"]);
  });

  it("applies title context to embedText only", () => {
    const body = "余弦阈值需要按语料标定";
    const withContext = bodyChunks("语义搜索", body, {
      ...DEFAULT_CHUNKING,
      titleContext: true,
    })[0];
    const withoutContext = bodyChunks("语义搜索", body, {
      ...DEFAULT_CHUNKING,
      titleContext: false,
    })[0];

    expect(withContext.embedText).toBe("语义搜索\n余弦阈值需要按语料标定");
    expect(withoutContext.embedText).toBe("余弦阈值需要按语料标定");
    expect(withContext.text).toBe(withoutContext.text);
    expect(withContext.charStart).toBe(withoutContext.charStart);
  });

  it("produces stable chunk indexes and short vector IDs", () => {
    const source = {
      noteId: "0f9c2b7a-1d2e-4f3a-8b5c-6d7e8f901234",
      title: "行级索引",
      body: Array.from({ length: 12 }, (_, index) => `第 ${index} 行的内容说明文字`).join("\n"),
      contentHash: "a".repeat(64),
    };

    const first = buildIdentifiedNoteChunks(source);
    const second = buildIdentifiedNoteChunks(source);
    expect(first.map((chunk) => chunk.chunkId)).toEqual(second.map((chunk) => chunk.chunkId));
    for (const chunk of first) {
      expect(new TextEncoder().encode(chunk.chunkId).length).toBeLessThanOrEqual(64);
      expect(chunk.chunkId).toBe(chunkVectorId(source.noteId, source.contentHash, chunk.chunkIndex));
    }
  });
});

describe("resolveChunkingOptions", () => {
  it("returns defaults for an empty override", () => {
    expect(resolveChunkingOptions(undefined)).toEqual(DEFAULT_CHUNKING);
  });

  it("rejects invalid values", () => {
    expect(() => resolveChunkingOptions({ targetChars: 4 })).toThrow(/targetChars/);
    expect(() => resolveChunkingOptions({ maxLines: 0 })).toThrow(/maxLines/);
    expect(() => resolveChunkingOptions({ targetChars: 900, maxChars: 400 })).toThrow(/maxChars/);
    expect(() => resolveChunkingOptions({ overlapLines: 3, maxLines: 3 })).toThrow(/overlapLines/);
    expect(() => resolveChunkingOptions({ titleContext: "yes" as unknown as boolean })).toThrow(
      /titleContext/,
    );
  });
});
