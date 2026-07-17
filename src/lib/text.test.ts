import { describe, expect, it } from 'vitest';
import {
  characterNgrams,
  cosineSimilarity,
  firstMatchingLine,
  isImeComposing,
  makeSnippet,
  mergeSearchHits,
  normalizeText,
  parseQuickNoteInput
} from './text';
import type { Note, SearchHit } from './types';

describe('text helpers', () => {
  it('normalizes width, case and whitespace', () => {
    expect(normalizeText('  Ｃｌｏｕｄ  FLARE\nR2 ')).toBe('cloud flare r2');
  });

  it('splits a one-line quick draft into title and body at the first space', () => {
    expect(parseQuickNoteInput('周五同步 记录发布计划和负责人')).toEqual({
      title: '周五同步',
      body: '记录发布计划和负责人',
      hasBodySeparator: true
    });
    expect(parseQuickNoteInput('只有标题')).toEqual({
      title: '只有标题',
      body: '',
      hasBodySeparator: false
    });
    expect(parseQuickNoteInput('周五同步 ')).toEqual({
      title: '周五同步',
      body: '',
      hasBodySeparator: true
    });
  });

  it('recognizes IME composition keyboard events', () => {
    expect(isImeComposing({ isComposing: true, keyCode: 13 })).toBe(true);
    expect(isImeComposing({ isComposing: false, keyCode: 229 })).toBe(true);
    expect(isImeComposing({ isComposing: false, keyCode: 13 })).toBe(false);
  });

  it('finds the line containing a query', () => {
    expect(firstMatchingLine('第一行\nCloudflare R2 配置\n第三行', 'r2')).toBe('Cloudflare R2 配置');
  });

  it('builds character ngrams and cosine similarity', () => {
    const left = characterNgrams('对象存储');
    const close = characterNgrams('对象存储配置');
    const far = characterNgrams('周末采购');
    expect(cosineSimilarity(left, close)).toBeGreaterThan(cosineSimilarity(left, far));
  });

  it('keeps exact matching lines as snippets', () => {
    expect(makeSnippet('标题', '第一行\n这是需要找到的内容', '找到')).toBe('这是需要找到的内容');
  });

  it('merges lexical and semantic ranks without duplicates', () => {
    const note = makeNote('a');
    const lexical: SearchHit[] = [makeHit(note, 'lexical')];
    const semantic: SearchHit[] = [makeHit(note, 'semantic')];
    const merged = mergeSearchHits(lexical, semantic);
    expect(merged).toHaveLength(1);
    expect(merged[0].matchType).toBe('both');
    expect(merged[0].lexicalRank).toBe(1);
    expect(merged[0].semanticRank).toBe(1);
  });
});

function makeNote(id: string): Note {
  return {
    id,
    title: '标题',
    body: '正文',
    images: [],
    version: 1,
    createdAt: 1,
    updatedAt: 1,
    embeddingStatus: 'ready'
  };
}

function makeHit(note: Note, matchType: 'lexical' | 'semantic'): SearchHit {
  return { note, matchType, snippet: note.body, score: 1 };
}
