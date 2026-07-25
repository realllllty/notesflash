/**
 * Line-anchored chunking for semantic search.
 *
 * Semantic recall used to embed a whole note, so a single relevant line was
 * diluted by everything around it and the response could not tell the client
 * which line matched. Every chunk produced here stays anchored to logical body
 * lines and carries exact character offsets, so the same structure drives
 * indexing, retrieval, and in-line highlighting.
 *
 * The module is intentionally pure: the queue consumer, the semantic query
 * path, and the search lab all call it with the same options object, which is
 * what makes a lab sweep representative of production behaviour.
 */

/** Mirrors `IMAGE_MARKER` in `src/lib/note-content.ts`; image lines never embed. */
const IMAGE_MARKER = /^\[\[notesflash-image:([A-Za-z0-9_-]+)\]\]$/;

/** Sentence-ish boundaries used before falling back to a hard character split. */
const SENTENCE_BOUNDARY = /[。．！？；!?;]|\.\s|\n/;

export interface ChunkingOptions {
  /** Preferred characters per chunk window. */
  targetChars: number;
  /** Hard ceiling per chunk; longer lines are split into several chunks. */
  maxChars: number;
  /** A window shorter than this merges into its predecessor when possible. */
  minChars: number;
  /** Logical lines re-used by the next window so a match never straddles a gap. */
  overlapLines: number;
  /** Maximum logical lines inside one window. */
  maxLines: number;
  /** Prefix the note title into the embedded text for extra context. */
  titleContext: boolean;
  /** Emit a separate title-only chunk. */
  includeTitleChunk: boolean;
}

export const DEFAULT_CHUNKING: ChunkingOptions = {
  targetChars: 220,
  maxChars: 400,
  minChars: 24,
  overlapLines: 1,
  maxLines: 3,
  titleContext: true,
  includeTitleChunk: true,
};

const LIMITS = {
  targetChars: { min: 16, max: 2_000 },
  maxChars: { min: 32, max: 4_000 },
  minChars: { min: 0, max: 500 },
  overlapLines: { min: 0, max: 3 },
  maxLines: { min: 1, max: 12 },
} as const;

export type ChunkKind = "title" | "body";

export interface NoteChunk {
  chunkIndex: number;
  kind: ChunkKind;
  /** 1-based body line the UI should scroll to; null for the title chunk. */
  primaryLine: number | null;
  /** 1-based inclusive body line range; null for the title chunk. */
  lineStart: number | null;
  lineEnd: number | null;
  /** Character offsets into the raw note body; null for the title chunk. */
  charStart: number | null;
  charEnd: number | null;
  /** Exact `body.slice(charStart, charEnd)` (or the title for a title chunk). */
  text: string;
  /** Text handed to the embedding model, which may include title context. */
  embedText: string;
}

export interface IdentifiedNoteChunk extends NoteChunk {
  chunkId: string;
}

export interface ChunkSource {
  noteId: string;
  title: string;
  body: string;
  contentHash: string;
}

interface Segment {
  lineIndex: number;
  charStart: number;
  charEnd: number;
  text: string;
  /** True when the owning line was split because it exceeded `maxChars`. */
  split: boolean;
}

interface Window {
  segments: Segment[];
}

function clampInteger(
  value: unknown,
  fallback: number,
  bounds: { min: number; max: number },
  name: string,
): number {
  if (value === undefined) return fallback;
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new Error(`${name} must be an integer.`);
  }
  if (value < bounds.min || value > bounds.max) {
    throw new Error(`${name} must be between ${bounds.min} and ${bounds.max}.`);
  }
  return value;
}

function requireBoolean(value: unknown, fallback: boolean, name: string): boolean {
  if (value === undefined) return fallback;
  if (typeof value !== "boolean") throw new Error(`${name} must be a boolean.`);
  return value;
}

/**
 * Validate and normalize partial chunking options. Throws a plain `Error`; the
 * HTTP layer decides how to surface an invalid lab or environment value.
 */
export function resolveChunkingOptions(
  partial: Partial<ChunkingOptions> | undefined,
  base: ChunkingOptions = DEFAULT_CHUNKING,
): ChunkingOptions {
  const options: ChunkingOptions = {
    targetChars: clampInteger(partial?.targetChars, base.targetChars, LIMITS.targetChars, "targetChars"),
    maxChars: clampInteger(partial?.maxChars, base.maxChars, LIMITS.maxChars, "maxChars"),
    minChars: clampInteger(partial?.minChars, base.minChars, LIMITS.minChars, "minChars"),
    overlapLines: clampInteger(
      partial?.overlapLines,
      base.overlapLines,
      LIMITS.overlapLines,
      "overlapLines",
    ),
    maxLines: clampInteger(partial?.maxLines, base.maxLines, LIMITS.maxLines, "maxLines"),
    titleContext: requireBoolean(partial?.titleContext, base.titleContext, "titleContext"),
    includeTitleChunk: requireBoolean(
      partial?.includeTitleChunk,
      base.includeTitleChunk,
      "includeTitleChunk",
    ),
  };

  if (options.maxChars < options.targetChars) {
    throw new Error("maxChars must be greater than or equal to targetChars.");
  }
  if (options.overlapLines >= options.maxLines) {
    throw new Error("overlapLines must be smaller than maxLines.");
  }
  return options;
}

export function isImageMarkerLine(line: string): boolean {
  return IMAGE_MARKER.test(line);
}

/** Deterministic chunk ID; stays inside Vectorize's 64-byte ID limit. */
export function chunkVectorId(noteId: string, contentHash: string, chunkIndex: number): string {
  return `${noteId}:${contentHash.slice(0, 6)}:${chunkIndex}`;
}

function trimmedOffsets(body: string, start: number, end: number): { start: number; end: number } {
  let trimmedStart = start;
  let trimmedEnd = end;
  while (trimmedStart < trimmedEnd && /\s/.test(body[trimmedStart])) trimmedStart += 1;
  while (trimmedEnd > trimmedStart && /\s/.test(body[trimmedEnd - 1])) trimmedEnd -= 1;
  return { start: trimmedStart, end: trimmedEnd };
}

/**
 * Split one over-long line into sentence-ish pieces, then hard-split anything
 * that is still too long. Offsets stay exact, so highlighting keeps working.
 */
function splitLine(
  body: string,
  lineIndex: number,
  lineStart: number,
  lineEnd: number,
  maxChars: number,
): Segment[] {
  const text = body.slice(lineStart, lineEnd);
  if (text.length <= maxChars) {
    return [{ lineIndex, charStart: lineStart, charEnd: lineEnd, text, split: false }];
  }

  const sentences: Array<{ start: number; end: number }> = [];
  let cursor = 0;
  let sentenceStart = 0;
  while (cursor < text.length) {
    const rest = text.slice(cursor);
    const match = rest.match(SENTENCE_BOUNDARY);
    if (!match || match.index === undefined) break;
    const boundaryEnd = cursor + match.index + match[0].length;
    sentences.push({ start: sentenceStart, end: boundaryEnd });
    sentenceStart = boundaryEnd;
    cursor = boundaryEnd;
  }
  if (sentenceStart < text.length) sentences.push({ start: sentenceStart, end: text.length });

  // Pack sentences up to maxChars, then hard-split any sentence that is still
  // too long. A small overlap keeps a phrase that crosses a hard boundary
  // retrievable from at least one chunk.
  const hardOverlap = Math.min(40, Math.floor(maxChars / 4));
  const pieces: Array<{ start: number; end: number }> = [];
  let pending: { start: number; end: number } | null = null;

  const flushPending = () => {
    if (pending) pieces.push(pending);
    pending = null;
  };

  for (const sentence of sentences) {
    const length = sentence.end - sentence.start;
    if (length > maxChars) {
      flushPending();
      let start = sentence.start;
      while (start < sentence.end) {
        const end = Math.min(start + maxChars, sentence.end);
        pieces.push({ start, end });
        if (end >= sentence.end) break;
        start = Math.max(start + 1, end - hardOverlap);
      }
      continue;
    }
    if (pending && pending.end - pending.start + length <= maxChars) {
      pending = { start: pending.start, end: sentence.end };
      continue;
    }
    flushPending();
    pending = { start: sentence.start, end: sentence.end };
  }
  flushPending();

  return pieces
    .map((piece) => {
      const trimmed = trimmedOffsets(body, lineStart + piece.start, lineStart + piece.end);
      return {
        lineIndex,
        charStart: trimmed.start,
        charEnd: trimmed.end,
        text: body.slice(trimmed.start, trimmed.end),
        split: true,
      };
    })
    .filter((segment) => segment.text.length > 0);
}

/** Content segments in body order; blank and image-marker lines are skipped. */
function bodySegments(body: string, options: ChunkingOptions): Segment[] {
  const segments: Segment[] = [];
  let offset = 0;

  body.split("\n").forEach((line, lineIndex) => {
    const lineStart = offset;
    const lineEnd = offset + line.length;
    offset = lineEnd + 1;

    if (line.trim().length === 0 || isImageMarkerLine(line)) return;
    const trimmed = trimmedOffsets(body, lineStart, lineEnd);
    segments.push(...splitLine(body, lineIndex, trimmed.start, trimmed.end, options.maxChars));
  });

  return segments;
}

function windowLength(window: Window): number {
  const first = window.segments[0];
  const last = window.segments[window.segments.length - 1];
  return last.charEnd - first.charStart;
}

function mergeable(
  lastSegment: Segment,
  windowSize: number,
  candidate: Segment,
  options: ChunkingOptions,
): boolean {
  if (windowSize >= options.maxLines) return false;
  if (lastSegment.split || candidate.split) return false;
  // Only strictly consecutive content lines merge, so a chunk's character range
  // never silently swallows a blank line or an image marker.
  return candidate.lineIndex === lastSegment.lineIndex + 1;
}

function buildWindows(segments: Segment[], options: ChunkingOptions): Window[] {
  const windows: Window[] = [];
  let start = 0;
  /** Last segment index already contained in an emitted window. */
  let coveredUntil = -1;

  while (start < segments.length) {
    let end = start;
    while (end + 1 < segments.length) {
      const candidate = segments[end + 1];
      if (!mergeable(segments[end], end - start + 1, candidate, options)) break;
      if (candidate.charEnd - segments[start].charStart > options.maxChars) break;
      const length = segments[end].charEnd - segments[start].charStart;
      if (length >= options.targetChars && length >= options.minChars) break;
      end += 1;
    }

    // An overlap-started window that cannot extend past the previous window adds
    // no new coverage; emitting it would duplicate a line as its own chunk.
    const addsCoverage = end > coveredUntil;
    if (addsCoverage) {
      windows.push({ segments: segments.slice(start, end + 1) });
      coveredUntil = end;
    }

    if (end >= segments.length - 1) break;
    const consumed = end - start + 1;
    const advance = consumed <= options.overlapLines
      ? consumed
      : Math.max(1, consumed - options.overlapLines);
    const nextStart = start + advance;
    start = addsCoverage ? nextStart : Math.max(nextStart, coveredUntil + 1);
  }

  // A trailing scrap ("好的" on its own line) carries almost no signal; fold it
  // into the previous window when the shape allows it.
  for (let position = windows.length - 1; position > 0; position -= 1) {
    const window = windows[position];
    if (windowLength(window) >= options.minChars) continue;
    const previous = windows[position - 1];
    const previousLast = previous.segments[previous.segments.length - 1];
    const first = window.segments[0];
    if (!mergeable(previousLast, previous.segments.length, first, options)) continue;
    const last = window.segments[window.segments.length - 1];
    if (last.charEnd - previous.segments[0].charStart > options.maxChars) continue;
    previous.segments.push(...window.segments);
    windows.splice(position, 1);
  }

  return windows;
}

function primaryLineOf(window: Window): number {
  let best = window.segments[0];
  for (const segment of window.segments) {
    if (segment.charEnd - segment.charStart > best.charEnd - best.charStart) best = segment;
  }
  return best.lineIndex + 1;
}

function embedTextFor(title: string, text: string, options: ChunkingOptions): string {
  const trimmedTitle = title.trim();
  if (!options.titleContext || trimmedTitle.length === 0) return text;
  if (text.startsWith(trimmedTitle)) return text;
  return `${trimmedTitle}\n${text}`;
}

/**
 * Produce the ordered chunk list for a note. Chunk indexes are stable for the
 * same body and options, which keeps vector IDs and D1 rows idempotent.
 */
export function buildNoteChunks(
  source: Pick<ChunkSource, "title" | "body">,
  options: ChunkingOptions = DEFAULT_CHUNKING,
): NoteChunk[] {
  const chunks: NoteChunk[] = [];
  const title = source.title ?? "";
  const trimmedTitle = title.trim();

  if (options.includeTitleChunk && trimmedTitle.length > 0) {
    chunks.push({
      chunkIndex: 0,
      kind: "title",
      primaryLine: null,
      lineStart: null,
      lineEnd: null,
      charStart: null,
      charEnd: null,
      text: trimmedTitle,
      embedText: trimmedTitle.slice(0, options.maxChars),
    });
  }

  for (const window of buildWindows(bodySegments(source.body ?? "", options), options)) {
    const first = window.segments[0];
    const last = window.segments[window.segments.length - 1];
    const text = (source.body ?? "").slice(first.charStart, last.charEnd);
    chunks.push({
      chunkIndex: chunks.length,
      kind: "body",
      primaryLine: primaryLineOf(window),
      lineStart: first.lineIndex + 1,
      lineEnd: last.lineIndex + 1,
      charStart: first.charStart,
      charEnd: last.charEnd,
      text,
      embedText: embedTextFor(title, text, options),
    });
  }

  // A note with a body but no title chunk still needs at least one chunk.
  if (chunks.length === 0 && trimmedTitle.length > 0) {
    chunks.push({
      chunkIndex: 0,
      kind: "title",
      primaryLine: null,
      lineStart: null,
      lineEnd: null,
      charStart: null,
      charEnd: null,
      text: trimmedTitle,
      embedText: trimmedTitle.slice(0, options.maxChars),
    });
  }

  return chunks;
}

/** `buildNoteChunks` plus deterministic Vectorize IDs. */
export function buildIdentifiedNoteChunks(
  source: ChunkSource,
  options: ChunkingOptions = DEFAULT_CHUNKING,
): IdentifiedNoteChunk[] {
  return buildNoteChunks(source, options).map((chunk) => ({
    ...chunk,
    chunkId: chunkVectorId(source.noteId, source.contentHash, chunk.chunkIndex),
  }));
}
