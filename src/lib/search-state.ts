export interface CompletedSearchState {
  query: string;
  pending: boolean;
  visibleHitCount: number;
  targetCount: number;
  generation: number;
  lexicalSuccessfulGeneration: number;
  semanticExpected: boolean;
  semanticSuccessfulGeneration: number;
}

/** Enter may create only after every enabled search completed successfully. */
export function canCreateFromCompletedSearch(state: CompletedSearchState): boolean {
  return Boolean(state.query.trim()) &&
    !state.pending &&
    state.visibleHitCount === 0 &&
    state.targetCount === 0 &&
    state.lexicalSuccessfulGeneration === state.generation &&
    (!state.semanticExpected || state.semanticSuccessfulGeneration === state.generation);
}
