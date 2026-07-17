import type { ImageAsset } from './types';

const IMAGE_MARKER = /^\[\[notesflash-image:([A-Za-z0-9_-]+)\]\]$/;

export function imageIdFromMarker(line: string): string | null {
  return line.match(IMAGE_MARKER)?.[1] ?? null;
}

export type NoteContentBlock =
  | { key: string; type: 'text'; text: string; transient?: boolean }
  | { key: string; type: 'image'; image: ImageAsset };

export interface LogicalTextLine {
  type: 'text';
  rawLineIndex: number;
  displayLineNumber: number;
  blockKey: string;
  blockIndex: number;
  blockLineIndex: number;
  startOffset: number;
  endOffset: number;
  text: string;
}

export interface LogicalImageLine {
  type: 'image';
  rawLineIndex: number;
  displayLineNumber: number;
  blockKey: string;
  blockIndex: number;
  image: ImageAsset;
}

export type LogicalNoteLine = LogicalTextLine | LogicalImageLine;

export type NumberedNoteContentBlock =
  | { type: 'text'; block: Extract<NoteContentBlock, { type: 'text' }>; lines: LogicalTextLine[] }
  | { type: 'image'; block: Extract<NoteContentBlock, { type: 'image' }>; line: LogicalImageLine };

export function imageMarker(imageId: string): string {
  return `[[notesflash-image:${imageId}]]`;
}

export function parseNoteContent(body: string, images: ImageAsset[]): NoteContentBlock[] {
  const imagesById = new Map(images.map((image) => [image.id, image]));
  const referencedImages = new Set<string>();
  const blocks: NoteContentBlock[] = [];
  const textLines: string[] = [];

  const pushText = () => {
    if (textLines.length === 0) return;
    blocks.push({ key: crypto.randomUUID(), type: 'text', text: textLines.join('\n') });
    textLines.length = 0;
  };

  for (const line of body.split('\n')) {
    const imageId = imageIdFromMarker(line);
    const image = imageId ? imagesById.get(imageId) : undefined;
    if (!imageId || !image) {
      textLines.push(line);
      continue;
    }

    pushText();
    blocks.push({ key: crypto.randomUUID(), type: 'image', image });
    referencedImages.add(image.id);
  }

  pushText();
  if (blocks.length === 0) {
    blocks.push({ key: crypto.randomUUID(), type: 'text', text: '' });
  }

  // Notes created by older versions stored every image as a trailing attachment.
  for (const image of images) {
    if (referencedImages.has(image.id)) continue;
    blocks.push({ key: crypto.randomUUID(), type: 'image', image });
    blocks.push({ key: crypto.randomUUID(), type: 'text', text: '' });
  }

  return blocks;
}

/**
 * Numbers the exact logical lines that serializeNoteContent writes. A browser
 * soft wrap never creates another item here; only a literal newline or an
 * image marker advances rawLineIndex.
 */
export function numberNoteContentBlocks(blocks: NoteContentBlock[]): NumberedNoteContentBlock[] {
  let rawLineIndex = 0;

  return blocks.map((block, blockIndex) => {
    if (block.type === 'image') {
      const line: LogicalImageLine = {
        type: 'image',
        rawLineIndex,
        displayLineNumber: rawLineIndex + 1,
        blockKey: block.key,
        blockIndex,
        image: block.image
      };
      rawLineIndex += 1;
      return { type: 'image', block, line };
    }

    if (block.transient && block.text === '') {
      return { type: 'text', block, lines: [] };
    }

    let startOffset = 0;
    const lines = block.text.split('\n').map((text, blockLineIndex): LogicalTextLine => {
      const line: LogicalTextLine = {
        type: 'text',
        rawLineIndex,
        displayLineNumber: rawLineIndex + 1,
        blockKey: block.key,
        blockIndex,
        blockLineIndex,
        startOffset,
        endOffset: startOffset + text.length,
        text
      };
      rawLineIndex += 1;
      startOffset = line.endOffset + 1;
      return line;
    });

    return { type: 'text', block, lines };
  });
}

export function logicalNoteLines(blocks: NoteContentBlock[]): LogicalNoteLine[] {
  return numberNoteContentBlocks(blocks).flatMap<LogicalNoteLine>((numbered): LogicalNoteLine[] =>
    numbered.type === 'text' ? numbered.lines : [numbered.line]
  );
}

export function textPositionForRawLine(
  blocks: NoteContentBlock[],
  rawLineIndex: number
): LogicalTextLine | null {
  const line = logicalNoteLines(blocks).find((candidate) => candidate.rawLineIndex === rawLineIndex);
  return line?.type === 'text' ? line : null;
}

/**
 * Returns the requested text line, or the closest editable line when the
 * requested logical line is an image. The following text line is preferred so
 * an image-line focus naturally continues below the image.
 */
export function nearestTextPositionForRawLine(
  blocks: NoteContentBlock[],
  rawLineIndex: number
): LogicalTextLine | null {
  const lines = logicalNoteLines(blocks);
  const exact = lines.find((line) => line.rawLineIndex === rawLineIndex);
  if (exact?.type === 'text') return exact;

  const following = lines.find(
    (line): line is LogicalTextLine => line.type === 'text' && line.rawLineIndex > rawLineIndex
  );
  if (following) return following;

  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = lines[index];
    if (line.type === 'text' && line.rawLineIndex < rawLineIndex) return line;
  }
  return lines.find((line): line is LogicalTextLine => line.type === 'text') ?? null;
}

export function serializeNoteContent(blocks: NoteContentBlock[]): string {
  return blocks
    .filter((block) => !(block.type === 'text' && block.transient && block.text === ''))
    .map((block) => (block.type === 'text' ? block.text : imageMarker(block.image.id)))
    .join('\n');
}

/**
 * Adds unsaved text entry points around adjacent/edge images. Empty transient
 * blocks are editor affordances only: they have no line number and serialize
 * to nothing until the user types in them.
 */
export function ensureEditableTextBlocks(blocks: NoteContentBlock[]): NoteContentBlock[] {
  const editable: NoteContentBlock[] = [];

  for (const block of blocks) {
    if (block.type === 'image' && editable.at(-1)?.type !== 'text') {
      editable.push(transientTextBlock());
    }
    editable.push(block);
  }

  if (editable.at(-1)?.type === 'image') editable.push(transientTextBlock());
  return editable;
}

export function splitTextForBlockInsertion(
  text: string,
  selectionStart: number,
  selectionEnd: number
): { before: string; after: string } {
  const rawBefore = text.slice(0, selectionStart);
  const rawAfter = text.slice(selectionEnd);
  return {
    before: rawBefore.endsWith('\n') ? rawBefore.slice(0, -1) : rawBefore,
    after: rawAfter.startsWith('\n') ? rawAfter.slice(1) : rawAfter
  };
}

function transientTextBlock(): Extract<NoteContentBlock, { type: 'text' }> {
  return { key: crypto.randomUUID(), type: 'text', text: '', transient: true };
}

export function contentImages(blocks: NoteContentBlock[]): ImageAsset[] {
  return blocks.flatMap((block) => (block.type === 'image' ? [block.image] : []));
}

export function bodyWithoutImageMarkers(body: string): string {
  return body
    .split('\n')
    .filter((line) => !IMAGE_MARKER.test(line))
    .join('\n');
}
