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

export const MIN_SEMANTIC_QUERY_LENGTH = 2;

/**
 * Semantic search is a fallback, never a parallel requirement for a literal hit.
 * Count Unicode code points so a two-character Chinese query is eligible.
 */
export function shouldRunSemanticFallback(
  query: string,
  enabled: boolean,
  lexicalHitCount: number
): boolean {
  return enabled && [...query.trim()].length >= MIN_SEMANTIC_QUERY_LENGTH && lexicalHitCount === 0;
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
