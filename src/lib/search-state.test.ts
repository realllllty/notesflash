import { describe, expect, it } from 'vitest';
import { canCreateFromCompletedSearch, type CompletedSearchState } from './search-state';

const completed: CompletedSearchState = {
  query: '新笔记',
  pending: false,
  visibleHitCount: 0,
  targetCount: 0,
  generation: 4,
  lexicalSuccessfulGeneration: 4,
  semanticExpected: true,
  semanticSuccessfulGeneration: 4
};

describe('completed search creation gate', () => {
  it('allows Enter only after a successful empty search', () => {
    expect(canCreateFromCompletedSearch(completed)).toBe(true);
  });

  it('blocks Enter while a request is pending', () => {
    expect(canCreateFromCompletedSearch({ ...completed, pending: true })).toBe(false);
  });

  it('blocks Enter after lexical or semantic failure', () => {
    expect(canCreateFromCompletedSearch({ ...completed, lexicalSuccessfulGeneration: 0 })).toBe(false);
    expect(canCreateFromCompletedSearch({ ...completed, semanticSuccessfulGeneration: 0 })).toBe(false);
  });

  it('blocks Enter when a note-level hit or line target still exists', () => {
    expect(canCreateFromCompletedSearch({ ...completed, visibleHitCount: 1 })).toBe(false);
    expect(canCreateFromCompletedSearch({ ...completed, targetCount: 1 })).toBe(false);
  });

  it('does not require semantic success when semantic search was not enabled', () => {
    expect(canCreateFromCompletedSearch({
      ...completed,
      semanticExpected: false,
      semanticSuccessfulGeneration: 0
    })).toBe(true);
  });
});
