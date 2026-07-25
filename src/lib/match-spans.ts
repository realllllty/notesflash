import type { SearchMatch } from './types';

/** Inclusive-exclusive character range inside one logical line. */
export interface LineSpan {
  start: number;
  end: number;
}

/**
 * Start offset of every logical line inside the raw note body.
 *
 * Semantic matches carry offsets into the whole body, while rendering works one
 * logical line at a time, so highlighting needs to translate between the two.
 */
export function bodyLineOffsets(body: string): number[] {
  const offsets: number[] = [];
  let offset = 0;
  for (const line of body.split('\n')) {
    offsets.push(offset);
    offset += line.length + 1;
  }
  return offsets;
}

/**
 * Map semantic matches onto per-line highlight spans.
 *
 * A chunk can cover several lines, so each covered line receives the part of the
 * range that falls inside it. Matches without offsets (or from a stale body)
 * are skipped rather than highlighting the wrong text.
 */
export function matchSpansByLine(
  body: string,
  matches: readonly SearchMatch[] | undefined
): Map<number, LineSpan[]> {
  const spans = new Map<number, LineSpan[]>();
  if (!matches || matches.length === 0) return spans;

  const lines = body.split('\n');
  const offsets = bodyLineOffsets(body);

  for (const match of matches) {
    if (match.kind !== 'body') continue;
    if (match.charStart === null || match.charEnd === null) continue;
    if (match.charEnd <= match.charStart || match.charEnd > body.length) continue;

    const firstLine = (match.lineStart ?? (match.rawLineIndex ?? 0) + 1) - 1;
    const lastLine = (match.lineEnd ?? (match.rawLineIndex ?? 0) + 1) - 1;
    for (let lineIndex = firstLine; lineIndex <= lastLine; lineIndex += 1) {
      if (lineIndex < 0 || lineIndex >= lines.length) continue;
      const lineStart = offsets[lineIndex];
      const lineEnd = lineStart + lines[lineIndex].length;
      const start = Math.max(match.charStart, lineStart) - lineStart;
      const end = Math.min(match.charEnd, lineEnd) - lineStart;
      if (end <= start) continue;

      const existing = spans.get(lineIndex) ?? [];
      existing.push({ start, end });
      spans.set(lineIndex, mergeSpans(existing));
    }
  }

  return spans;
}

/** True when any semantic match points at the note title. */
export function hasTitleMatch(matches: readonly SearchMatch[] | undefined): boolean {
  return (matches ?? []).some((match) => match.kind === 'title');
}

export function mergeSpans(spans: readonly LineSpan[]): LineSpan[] {
  const sorted = [...spans].sort((left, right) => left.start - right.start || left.end - right.end);
  const merged: LineSpan[] = [];
  for (const span of sorted) {
    const last = merged[merged.length - 1];
    if (last && span.start <= last.end) {
      last.end = Math.max(last.end, span.end);
      continue;
    }
    merged.push({ ...span });
  }
  return merged;
}
