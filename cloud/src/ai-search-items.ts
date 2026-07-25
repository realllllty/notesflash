import { sha256Hex } from "./crypto";
import { isImageMarkerLine } from "./chunking";

/**
 * AI Search accepts files up to 4 MB. One million UTF-16 code units encode to
 * at most about 3 MB for BMP text (and about 2 MB for surrogate-pair emoji),
 * leaving room below the provider limit without measuring UTF-8 bytes in the
 * Queue hot path.
 */
export const AI_SEARCH_ITEM_MAX_CODE_UNITS = 1_000_000;

export interface AiSearchItemSource {
  id: string;
  title: string;
  body: string;
  version: number;
  contentHash: string;
}

export interface DesiredAiSearchItem {
  itemKey: string;
  itemIndex: number;
  kind: "title" | "body";
  rawLineIndex: number | null;
  lineNumber: number | null;
  charStart: number | null;
  charEnd: number | null;
  /** Exact title/body slice returned to the client after current-D1 validation. */
  text: string;
  /** Text uploaded to AI Search: one logical line or one bounded part of it. */
  indexText: string;
  indexTextHash: string;
  /** Items Workers binding accepts metadata values only as strings. */
  metadata: Record<string, string>;
}

function trimmedOffsets(body: string, start: number, end: number): { start: number; end: number } {
  let left = start;
  let right = end;
  while (left < right && /\s/.test(body[left])) left += 1;
  while (right > left && /\s/.test(body[right - 1])) right -= 1;
  return { start: left, end: right };
}

function boundedTextRanges(
  body: string,
  start: number,
  end: number,
): Array<{ start: number; end: number }> {
  const ranges: Array<{ start: number; end: number }> = [];
  let cursor = start;
  while (cursor < end) {
    let partEnd = Math.min(cursor + AI_SEARCH_ITEM_MAX_CODE_UNITS, end);
    // Do not cut a Unicode surrogate pair between provider items.
    if (partEnd < end) {
      const left = body.charCodeAt(partEnd - 1);
      const right = body.charCodeAt(partEnd);
      if (left >= 0xd800 && left <= 0xdbff && right >= 0xdc00 && right <= 0xdfff) {
        partEnd -= 1;
      }
    }
    ranges.push({ start: cursor, end: partEnd });
    cursor = partEnd;
  }
  return ranges;
}

/**
 * Build immutable AI Search items for one note.
 *
 * The provider key includes a hash of the exact uploaded text. An old Queue
 * job can therefore never overwrite a newer line with the same line number,
 * while an unchanged line can be reused across note generations.
 */
export async function buildAiSearchItems(
  source: AiSearchItemSource,
  maxItems = 2_000,
): Promise<DesiredAiSearchItem[]> {
  const items: DesiredAiSearchItem[] = [];
  const noteToken = (await sha256Hex(source.id)).slice(0, 20);

  const append = async (
    kind: "title" | "body",
    rawLineIndex: number | null,
    charStart: number | null,
    charEnd: number | null,
    text: string,
    partIndex: number | null = null,
  ) => {
    if (items.length >= maxItems) {
      throw new Error(`AI Search item limit ${maxItems} exceeded for one note.`);
    }
    const indexText = text;
    const indexTextHash = await sha256Hex(indexText.normalize("NFKC"));
    const itemIndex = items.length;
    const lineToken = rawLineIndex === null
      ? "title"
      : partIndex === null
      ? `body_${rawLineIndex}`
      : `body_${rawLineIndex}_part_${partIndex}`;
    const itemKey = `nf_${noteToken}_${lineToken}_${indexTextHash}.txt`;
    items.push({
      itemKey,
      itemIndex,
      kind,
      rawLineIndex,
      lineNumber: rawLineIndex === null ? null : rawLineIndex + 1,
      charStart,
      charEnd,
      text,
      indexText,
      indexTextHash,
      metadata: {
        kind,
        raw_line_index: String(rawLineIndex ?? -1),
        index_hash: indexTextHash,
      },
    });
  };

  const title = source.title.trim();
  if (title.length > 0) await append("title", null, null, null, title);

  let offset = 0;
  const lines = source.body.split("\n");
  for (let rawLineIndex = 0; rawLineIndex < lines.length; rawLineIndex += 1) {
    const raw = lines[rawLineIndex];
    const lineStart = offset;
    const lineEnd = lineStart + raw.length;
    offset = lineEnd + 1;
    if (raw.trim().length === 0 || isImageMarkerLine(raw)) continue;
    const trimmed = trimmedOffsets(source.body, lineStart, lineEnd);
    const ranges = boundedTextRanges(source.body, trimmed.start, trimmed.end);
    for (let partIndex = 0; partIndex < ranges.length; partIndex += 1) {
      const range = ranges[partIndex];
      const text = source.body.slice(range.start, range.end);
      if (text.length === 0) continue;
      await append(
        "body",
        rawLineIndex,
        range.start,
        range.end,
        text,
        ranges.length > 1 ? partIndex : null,
      );
    }
  }

  return items;
}

export function currentLineSlice(
  body: string,
  rawLineIndex: number,
): { text: string; charStart: number; charEnd: number; lineNumber: number } | null {
  if (!Number.isSafeInteger(rawLineIndex) || rawLineIndex < 0) return null;
  const lines = body.split("\n");
  if (rawLineIndex >= lines.length) return null;
  let start = 0;
  for (let index = 0; index < rawLineIndex; index += 1) start += lines[index].length + 1;
  const end = start + lines[rawLineIndex].length;
  const raw = body.slice(start, end);
  if (raw.trim().length === 0 || isImageMarkerLine(raw)) return null;
  const trimmed = trimmedOffsets(body, start, end);
  return {
    text: body.slice(trimmed.start, trimmed.end),
    charStart: trimmed.start,
    charEnd: trimmed.end,
    lineNumber: rawLineIndex + 1,
  };
}
