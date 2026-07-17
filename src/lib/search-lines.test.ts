import { describe, expect, it } from 'vitest';
import { imageMarker } from './note-content';
import {
  activeSearchLineTarget,
  collectSearchLineTargets,
  moveActiveMatchKey,
  retainActiveMatchKey,
  type SearchLineTarget
} from './search-lines';
import type { ImageAsset, Note, SearchHit } from './types';

describe('search line targets', () => {
  it('keeps every matching logical line in a note, in title then body order', () => {
    const hit = makeHit(makeNote('a', 'Cloud 标题', '第一行\ncloud 正文一\n第三行\n再次 CLOUD'));

    const targets = collectSearchLineTargets([hit], 'cloud');

    expect(targets.map(targetSummary)).toEqual([
      ['a:title', 'title', null, null, 'Cloud 标题'],
      ['a:body:1', 'body', 1, 2, 'cloud 正文一'],
      ['a:body:3', 'body', 3, 4, '再次 CLOUD']
    ]);
    expect(targets.every((target) => !target.semanticOnly)).toBe(true);
  });

  it('creates one target when the same logical line contains repeated matches', () => {
    const targets = collectSearchLineTargets(
      [makeHit(makeNote('a', '标题', 'Cloud cloud CLOUD'))],
      'cloud'
    );

    expect(targets).toHaveLength(1);
    expect(targets[0]).toMatchObject({ key: 'a:body:0', text: 'Cloud cloud CLOUD' });
  });

  it('treats a long visually wrapped line as one logical target', () => {
    const longLine = `${'很长的内容'.repeat(80)} 关键词 ${'继续换行显示'.repeat(80)}`;
    const targets = collectSearchLineTargets(
      [makeHit(makeNote('a', '标题', longLine))],
      '关键词'
    );

    expect(targets).toHaveLength(1);
    expect(targets[0]).toMatchObject({ rawLineIndex: 0, lineNumber: 1, text: longLine });
  });

  it('skips valid image marker rows but keeps missing-image markers as text', () => {
    const image = makeImage('saved-image');
    const note = makeNote(
      'a',
      '标题',
      `第一行\n${imageMarker(image.id)}\n${imageMarker('missing-image')}\n关键词`,
      [image]
    );

    const validMarkerQuery = collectSearchLineTargets([makeHit(note)], 'saved-image');
    const missingMarkerQuery = collectSearchLineTargets([makeHit(note)], 'missing-image');
    const textQuery = collectSearchLineTargets([makeHit(note)], '关键词');

    expect(validMarkerQuery).toHaveLength(0);
    expect(missingMarkerQuery).toHaveLength(1);
    expect(missingMarkerQuery[0]).toMatchObject({ rawLineIndex: 2, lineNumber: 3 });
    expect(textQuery[0]).toMatchObject({ rawLineIndex: 3, lineNumber: 4 });
  });

  it('preserves ranked note order while expanding lines within each note', () => {
    const first = makeHit(makeNote('first', '标题', '匹配 A\n匹配 B'));
    const second = makeHit(makeNote('second', '匹配标题', '匹配 C'));

    const targets = collectSearchLineTargets([first, second], '匹配');

    expect(targets.map((target) => [target.noteId, target.hitIndex, target.key])).toEqual([
      ['first', 0, 'first:body:0'],
      ['first', 0, 'first:body:1'],
      ['second', 1, 'second:title'],
      ['second', 1, 'second:body:0']
    ]);
  });

  it('uses one stable fallback location for a semantic-only hit', () => {
    const hit = makeHit(
      makeNote('semantic', '季度复盘', '第一行\n服务稳定性收益'),
      'semantic',
      '服务稳定性收益'
    );

    const targets = collectSearchLineTargets([hit], '完全不同的查询');

    expect(targets).toHaveLength(1);
    expect(targets[0]).toMatchObject({
      key: 'semantic:semantic',
      source: 'semantic',
      rawLineIndex: null,
      lineNumber: null,
      text: '季度复盘',
      semanticOnly: true
    });
  });

  it('does not invent a fallback line for a stale lexical hit', () => {
    const hit = makeHit(makeNote('lexical', '标题', '完全不相关的正文'));

    expect(collectSearchLineTargets([hit], '不存在的关键词')).toEqual([]);
  });

  it('does not add a semantic fallback when a both hit has literal lines', () => {
    const hit = makeHit(makeNote('both', '标题', '关键词一\n关键词二'), 'both', '标题');

    const targets = collectSearchLineTargets([hit], '关键词');

    expect(targets.map((target) => target.key)).toEqual(['both:body:0', 'both:body:1']);
    expect(targets.every((target) => !target.semanticOnly)).toBe(true);
  });

  it('moves next and previous across lines in the same note and wraps', () => {
    const targets = collectSearchLineTargets(
      [makeHit(makeNote('a', '标题', '匹配一\n匹配二')), makeHit(makeNote('b', '匹配三', '正文'))],
      '匹配'
    );

    expect(moveActiveMatchKey(targets, null, 'next')).toBe('a:body:0');
    expect(moveActiveMatchKey(targets, null, 'previous')).toBe('b:title');
    expect(moveActiveMatchKey(targets, 'a:body:0', 'next')).toBe('a:body:1');
    expect(moveActiveMatchKey(targets, 'a:body:1', 'next')).toBe('b:title');
    expect(moveActiveMatchKey(targets, 'b:title', 'next')).toBe('a:body:0');
    expect(moveActiveMatchKey(targets, 'a:body:0', 'previous')).toBe('b:title');
    expect(moveActiveMatchKey([], 'a:body:0', 'next')).toBeNull();
  });

  it('retains an exact active key after result reordering', () => {
    const original = targets('a:body:0', 'b:title');
    const reordered = targets('new:title', 'b:title', 'a:body:0');

    expect(retainActiveMatchKey(reordered, 'a:body:0', original[0])).toBe('a:body:0');
    expect(activeSearchLineTarget(reordered, 'a:body:0')?.noteId).toBe('a');
  });

  it('falls back to the closest line in the same note if the exact line disappears', () => {
    const previous = target('a:body:4');
    const current = [target('other:title'), target('a:body:2'), target('a:body:6')];

    expect(retainActiveMatchKey(current, previous.key, previous)).toBe('a:body:2');
    expect(retainActiveMatchKey([target('other:title')], previous.key, previous)).toBeNull();
  });
});

function targetSummary(target: SearchLineTarget): [string, string, number | null, number | null, string] {
  return [target.key, target.source, target.rawLineIndex, target.lineNumber, target.text];
}

function makeNote(id: string, title: string, body: string, images: ImageAsset[] = []): Note {
  return {
    id,
    title,
    body,
    images,
    version: 1,
    createdAt: 1,
    updatedAt: 1,
    embeddingStatus: 'ready'
  };
}

function makeImage(id: string): ImageAsset {
  return { id, url: `https://example.com/${id}.png`, name: id, mimeType: 'image/png' };
}

function makeHit(
  note: Note,
  matchType: 'lexical' | 'semantic' | 'both' = 'lexical',
  snippet = ''
): SearchHit {
  return { note, matchType, snippet, score: 1 };
}

function targets(...keys: string[]): SearchLineTarget[] {
  return keys.map(target);
}

function target(key: string): SearchLineTarget {
  const [noteId, source, rawLine = '0'] = key.split(':');
  const rawLineIndex = source === 'body' ? Number(rawLine) : null;
  return {
    key,
    noteId,
    hitIndex: 0,
    source: source as 'title' | 'body' | 'semantic',
    rawLineIndex,
    lineNumber: rawLineIndex === null ? null : rawLineIndex + 1,
    text: key,
    semanticOnly: false
  };
}
