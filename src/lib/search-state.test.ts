import { describe, expect, it } from 'vitest';
import {
  canCreateFromCompletedSearch,
  shouldRunSemanticFallback,
  type CompletedSearchState
} from './search-state';

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

describe('semantic fallback policy', () => {
  it('runs only after an empty literal result', () => {
    expect(shouldRunSemanticFallback('migrate', true, 0)).toBe(true);
    expect(shouldRunSemanticFallback('migrate', true, 1)).toBe(false);
  });

  it('supports two-character Chinese queries and ignores one-character noise', () => {
    expect(shouldRunSemanticFallback('迁移', true, 0)).toBe(true);
    expect(shouldRunSemanticFallback('迁', true, 0)).toBe(false);
  });

  it('does not run when semantic search is disabled', () => {
    expect(shouldRunSemanticFallback('migrate', false, 0)).toBe(false);
  });
});
