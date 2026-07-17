import { describe, expect, it, vi } from 'vitest';
import {
  bodyWithoutImageMarkers,
  contentImages,
  ensureEditableTextBlocks,
  imageIdFromMarker,
  imageMarker,
  logicalNoteLines,
  nearestTextPositionForRawLine,
  parseNoteContent,
  serializeNoteContent,
  splitTextForBlockInsertion,
  textPositionForRawLine
} from './note-content';
import type { ImageAsset } from './types';

const image: ImageAsset = {
  id: 'image-1',
  url: '/image.png',
  name: 'image.png',
  mimeType: 'image/png'
};

describe('note content blocks', () => {
  it('keeps an image at its position between text blocks', () => {
    vi.stubGlobal('crypto', { randomUUID: () => Math.random().toString(36) });
    const body = `第一行\n${imageMarker(image.id)}\n第二行`;
    const blocks = parseNoteContent(body, [image]);

    expect(blocks.map((block) => block.type)).toEqual(['text', 'image', 'text']);
    expect(serializeNoteContent(blocks)).toBe(body);
    expect(contentImages(blocks)).toEqual([image]);
    expect(bodyWithoutImageMarkers(body)).toBe('第一行\n第二行');
    vi.unstubAllGlobals();
  });

  it('shows images from older notes after their text', () => {
    vi.stubGlobal('crypto', { randomUUID: () => Math.random().toString(36) });
    const blocks = parseNoteContent('旧正文', [image]);

    expect(blocks.map((block) => block.type)).toEqual(['text', 'image', 'text']);
    expect(serializeNoteContent(blocks)).toBe(`旧正文\n${imageMarker(image.id)}\n`);
    vi.unstubAllGlobals();
  });

  it('recognizes only complete image marker lines', () => {
    expect(imageIdFromMarker(imageMarker(image.id))).toBe(image.id);
    expect(imageIdFromMarker(`前缀 ${imageMarker(image.id)}`)).toBeNull();
    expect(imageIdFromMarker('[[notesflash-image:bad id]]')).toBeNull();
  });

  it.each([
    imageMarker(image.id),
    `${imageMarker(image.id)}\n正文`,
    `正文\n${imageMarker(image.id)}`,
    `${imageMarker(image.id)}\n`,
    `\n${imageMarker(image.id)}`,
    `${imageMarker(image.id)}\n${imageMarker(image.id)}`,
    `第一行\n\n${imageMarker(image.id)}\n\n最后一行`
  ])('round-trips referenced image markers without adding blank lines: %j', (body) => {
    vi.stubGlobal('crypto', { randomUUID: () => Math.random().toString(36) });
    expect(serializeNoteContent(parseNoteContent(body, [image]))).toBe(body);
    vi.unstubAllGlobals();
  });

  it('numbers logical text, empty and image lines and keeps textarea offsets', () => {
    vi.stubGlobal('crypto', { randomUUID: () => Math.random().toString(36) });
    const body = `第一行\n\n第二行较长\n${imageMarker(image.id)}\n尾行`;
    const blocks = parseNoteContent(body, [image]);
    const lines = logicalNoteLines(blocks);

    expect(lines.map((line) => [line.type, line.rawLineIndex, line.displayLineNumber])).toEqual([
      ['text', 0, 1],
      ['text', 1, 2],
      ['text', 2, 3],
      ['image', 3, 4],
      ['text', 4, 5]
    ]);
    expect(lines.map((line) => (line.type === 'text' ? line.text : imageMarker(line.image.id)))).toEqual(
      body.split('\n')
    );

    const first = textPositionForRawLine(blocks, 0);
    const empty = textPositionForRawLine(blocks, 1);
    const third = textPositionForRawLine(blocks, 2);
    expect(first && [first.startOffset, first.endOffset]).toEqual([0, 3]);
    expect(empty && [empty.startOffset, empty.endOffset]).toEqual([4, 4]);
    expect(third && [third.startOffset, third.endOffset]).toEqual([5, 10]);
    expect(textPositionForRawLine(blocks, 3)).toBeNull();
    expect(nearestTextPositionForRawLine(blocks, 3)?.rawLineIndex).toBe(4);
    vi.unstubAllGlobals();
  });

  it('keeps transient image-adjacent editor slots out of serialized content and line numbers', () => {
    vi.stubGlobal('crypto', { randomUUID: () => Math.random().toString(36) });
    const body = `${imageMarker(image.id)}\n${imageMarker(image.id)}`;
    const blocks = ensureEditableTextBlocks(parseNoteContent(body, [image]));

    expect(blocks.map((block) => block.type)).toEqual(['text', 'image', 'text', 'image', 'text']);
    expect(serializeNoteContent(blocks)).toBe(body);
    expect(logicalNoteLines(blocks).map((line) => line.type)).toEqual(['image', 'image']);
    vi.unstubAllGlobals();
  });

  it('inserts a block at newline boundaries without manufacturing an empty line', () => {
    expect(splitTextForBlockInsertion('第一行\n第二行', 4, 4)).toEqual({
      before: '第一行',
      after: '第二行'
    });
    expect(splitTextForBlockInsertion('第一行\n\n第二行', 5, 5)).toEqual({
      before: '第一行\n',
      after: '第二行'
    });
  });
});
