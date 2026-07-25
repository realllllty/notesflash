import { describe, expect, it } from 'vitest';

import { bodyLineOffsets, hasTitleMatch, matchSpansByLine, mergeSpans } from './match-spans';
import type { SearchMatch } from './types';

const body = ['第一行说明', '配对码十分钟后过期，只能用一次。', '第三行内容'].join('\n');

function bodyMatch(overrides: Partial<SearchMatch> = {}): SearchMatch {
  return {
    kind: 'body',
    lineNumber: 2,
    rawLineIndex: 1,
    lineStart: 2,
    lineEnd: 2,
    charStart: body.indexOf('配对码'),
    charEnd: body.indexOf('配对码') + '配对码十分钟后过期，只能用一次。'.length,
    score: 0.6,
    text: '配对码十分钟后过期，只能用一次。',
    ...overrides
  };
}

describe('bodyLineOffsets', () => {
  it('reports the start offset of every logical line', () => {
    expect(bodyLineOffsets(body)).toEqual([0, 6, 23]);
    expect(bodyLineOffsets('')).toEqual([0]);
    expect(bodyLineOffsets('a\n\nb')).toEqual([0, 2, 3]);
  });
});

describe('matchSpansByLine', () => {
  it('maps a single-line match onto line-relative offsets', () => {
    const spans = matchSpansByLine(body, [bodyMatch()]);

    expect([...spans.keys()]).toEqual([1]);
    expect(spans.get(1)).toEqual([{ start: 0, end: 16 }]);
    const line = body.split('\n')[1];
    const span = spans.get(1)?.[0];
    expect(line.slice(span?.start, span?.end)).toBe('配对码十分钟后过期，只能用一次。');
  });

  it('splits a multi-line chunk across every covered line', () => {
    const spans = matchSpansByLine(body, [
      bodyMatch({ lineStart: 1, lineEnd: 3, charStart: 0, charEnd: body.length, rawLineIndex: 1 })
    ]);

    expect([...spans.keys()].sort()).toEqual([0, 1, 2]);
    expect(spans.get(0)).toEqual([{ start: 0, end: 5 }]);
    expect(spans.get(2)).toEqual([{ start: 0, end: 5 }]);
  });

  it('highlights only the covered part of a partially matched line', () => {
    const spans = matchSpansByLine(body, [
      bodyMatch({ lineStart: 2, lineEnd: 2, charStart: 6, charEnd: 9 })
    ]);
    expect(spans.get(1)).toEqual([{ start: 0, end: 3 }]);
  });

  it('merges overlapping matches on the same line', () => {
    const spans = matchSpansByLine(body, [
      bodyMatch({ charStart: 6, charEnd: 12 }),
      bodyMatch({ charStart: 10, charEnd: 16 })
    ]);
    expect(spans.get(1)).toEqual([{ start: 0, end: 10 }]);
  });

  it('ignores title matches, empty ranges, and offsets past the body', () => {
    expect(matchSpansByLine(body, [bodyMatch({ kind: 'title' })]).size).toBe(0);
    expect(matchSpansByLine(body, [bodyMatch({ charStart: 5, charEnd: 5 })]).size).toBe(0);
    expect(matchSpansByLine(body, [bodyMatch({ charEnd: body.length + 40 })]).size).toBe(0);
    expect(matchSpansByLine(body, [bodyMatch({ charStart: null, charEnd: null })]).size).toBe(0);
    expect(matchSpansByLine(body, undefined).size).toBe(0);
  });

  it('ignores a match that points past the end of the note', () => {
    const spans = matchSpansByLine(body, [
      bodyMatch({ lineStart: 9, lineEnd: 9, rawLineIndex: 8, charStart: 0, charEnd: 5 })
    ]);
    expect(spans.size).toBe(0);
  });
});

describe('hasTitleMatch', () => {
  it('detects a title match', () => {
    expect(hasTitleMatch([bodyMatch({ kind: 'title' })])).toBe(true);
    expect(hasTitleMatch([bodyMatch()])).toBe(false);
    expect(hasTitleMatch(undefined)).toBe(false);
  });
});

describe('mergeSpans', () => {
  it('merges touching and overlapping ranges', () => {
    expect(mergeSpans([{ start: 0, end: 4 }, { start: 4, end: 7 }])).toEqual([{ start: 0, end: 7 }]);
    expect(mergeSpans([{ start: 6, end: 9 }, { start: 0, end: 2 }])).toEqual([
      { start: 0, end: 2 },
      { start: 6, end: 9 }
    ]);
  });
});
