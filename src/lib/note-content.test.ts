import { describe, expect, it, vi } from 'vitest';
import {
  bodyWithoutImageMarkers,
  contentImages,
  imageMarker,
  parseNoteContent,
  serializeNoteContent
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
});
