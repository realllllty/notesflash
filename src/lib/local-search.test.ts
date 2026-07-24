import { describe, expect, it } from 'vitest';
import { searchLoadedNotes } from './local-search';
import type { Note } from './types';

describe('optimistic loaded-note search', () => {
  it('returns literal title and body matches immediately', () => {
    const notes = [
      note('title', '数据库迁移', '说明'),
      note('body', '发布记录', '执行 migrate 后校验数据'),
      note('none', '采购清单', '燕麦奶')
    ];

    expect(searchLoadedNotes(notes, '迁移').map((hit) => hit.note.id)).toEqual(['title']);
    expect(searchLoadedNotes(notes, 'migrate').map((hit) => hit.note.id)).toEqual(['body']);
  });

  it('does not pretend that cross-language similarity is a literal hit', () => {
    expect(searchLoadedNotes([note('migration', '数据库迁移', '')], 'migrate')).toEqual([]);
  });
});

function note(id: string, title: string, body: string): Note {
  return {
    id,
    title,
    body,
    images: [],
    version: 1,
    createdAt: 1,
    updatedAt: 1,
    embeddingStatus: 'ready'
  };
}
