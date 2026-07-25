import { describe, expect, it } from "vitest";

import {
  AI_SEARCH_ITEM_MAX_CODE_UNITS,
  buildAiSearchItems,
  currentLineSlice,
} from "../src/ai-search-items";

describe("AI Search line item builder", () => {
  it("indexes the title and non-empty logical body lines with exact UTF-16 offsets", async () => {
    const body = [
      "  第一行 😀  ",
      "",
      "[[notesflash-image:saved_image-1]]",
      "  recovery entry  ",
    ].join("\n");

    const items = await buildAiSearchItems({
      id: "private-note-id",
      title: "  恢复说明  ",
      body,
      version: 7,
      contentHash: "current-content-hash",
    });

    expect(items.map((item) => ({
      kind: item.kind,
      rawLineIndex: item.rawLineIndex,
      lineNumber: item.lineNumber,
      text: item.text,
      indexText: item.indexText,
    }))).toEqual([
      {
        kind: "title",
        rawLineIndex: null,
        lineNumber: null,
        text: "恢复说明",
        indexText: "恢复说明",
      },
      {
        kind: "body",
        rawLineIndex: 0,
        lineNumber: 1,
        text: "第一行 😀",
        indexText: "第一行 😀",
      },
      {
        kind: "body",
        rawLineIndex: 3,
        lineNumber: 4,
        text: "recovery entry",
        indexText: "recovery entry",
      },
    ]);

    for (const item of items) {
      expect(item.metadata).toMatchObject({
        kind: item.kind,
        raw_line_index: String(item.rawLineIndex ?? -1),
        index_hash: item.indexTextHash,
      });
      expect(Object.values(item.metadata).every((value) => typeof value === "string")).toBe(true);
      expect(item.metadata).not.toHaveProperty("note_id");
      expect(item.itemKey).toMatch(/^nf_[a-f0-9]{20}_(?:title|body_\d+)_[a-f0-9]{64}\.txt$/);
      expect(item.itemKey).not.toContain("private-note-id");
    }

    const firstBody = items[1];
    const lastBody = items[2];
    expect(body.slice(firstBody.charStart ?? -1, firstBody.charEnd ?? -1)).toBe(firstBody.text);
    expect(body.slice(lastBody.charStart ?? -1, lastBody.charEnd ?? -1)).toBe(lastBody.text);
    expect(firstBody.charEnd! - firstBody.charStart!).toBe("第一行 😀".length);
  });

  it("uses immutable text-derived keys so a stale job cannot overwrite changed line content", async () => {
    const base = {
      id: "note-stable",
      title: "标题",
      version: 1,
      contentHash: "hash-v1",
    };
    const oldItems = await buildAiSearchItems({ ...base, body: "旧入口" });
    const sameItems = await buildAiSearchItems({
      ...base,
      version: 2,
      contentHash: "hash-v2",
      body: "旧入口",
    });
    const changedItems = await buildAiSearchItems({
      ...base,
      version: 3,
      contentHash: "hash-v3",
      body: "新入口",
    });

    expect(sameItems.map((item) => item.itemKey)).toEqual(oldItems.map((item) => item.itemKey));
    expect(changedItems[0].itemKey).toBe(oldItems[0].itemKey);
    expect(changedItems[1].itemKey).not.toBe(oldItems[1].itemKey);
  });

  it("reconstructs only current searchable body lines", () => {
    const body = [
      "  迁移入口 😀  ",
      "   ",
      "[[notesflash-image:image_1]]",
      "最后一行",
    ].join("\n");

    expect(currentLineSlice(body, 0)).toEqual({
      text: "迁移入口 😀",
      charStart: 2,
      charEnd: 9,
      lineNumber: 1,
    });
    expect(currentLineSlice(body, 3)).toMatchObject({ text: "最后一行", lineNumber: 4 });
    expect(currentLineSlice(body, 1)).toBeNull();
    expect(currentLineSlice(body, 2)).toBeNull();
    expect(currentLineSlice(body, -1)).toBeNull();
    expect(currentLineSlice(body, 1.5)).toBeNull();
    expect(currentLineSlice(body, Number.MAX_SAFE_INTEGER + 1)).toBeNull();
    expect(currentLineSlice(body, 4)).toBeNull();
  });

  it("splits a legal very long logical line below the provider file limit without cutting emoji", async () => {
    const body = `${"a".repeat(AI_SEARCH_ITEM_MAX_CODE_UNITS - 1)}😀尾`;
    const items = await buildAiSearchItems({
      id: "long-line",
      title: "标题",
      body,
      version: 1,
      contentHash: "long-hash",
    });
    const parts = items.filter((item) => item.kind === "body");

    expect(parts).toHaveLength(2);
    expect(parts.map((item) => item.rawLineIndex)).toEqual([0, 0]);
    expect(parts[0].text.endsWith("\ud83d")).toBe(false);
    expect(parts[1].text.startsWith("😀")).toBe(true);
    expect(parts.map((item) => item.text).join("")).toBe(body);
    expect(parts[0].itemKey).toContain("_body_0_part_0_");
    expect(parts[1].itemKey).toContain("_body_0_part_1_");
    for (const part of parts) {
      expect(body.slice(part.charStart ?? -1, part.charEnd ?? -1)).toBe(part.text);
    }
  });

  it("enforces the per-note item ceiling before producing a partial manifest", async () => {
    await expect(buildAiSearchItems({
      id: "too-many-lines",
      title: "标题",
      body: "第一行\n第二行",
      version: 1,
      contentHash: "hash",
    }, 2)).rejects.toThrow("AI Search item limit 2 exceeded");
  });
});
