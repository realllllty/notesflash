import { makeSnippet, normalizeText } from './text';
import type { Note, SearchHit } from './types';

/**
 * Optimistic in-memory literal search over notes already loaded for rendering.
 * The remote lexical request still follows as the source of truth, so changes
 * from another device are reconciled without delaying the first paint.
 */
export function searchLoadedNotes(
  notes: readonly Note[],
  query: string,
  limit = 30,
  now = Date.now()
): SearchHit[] {
  const normalizedQuery = normalizeText(query);
  if (!normalizedQuery) return [];

  const hits: SearchHit[] = [];
  for (const note of notes) {
    const title = normalizeText(note.title);
    const body = normalizeText(note.body);
    const titleIndex = title.indexOf(normalizedQuery);
    const bodyIndex = body.indexOf(normalizedQuery);
    if (titleIndex < 0 && bodyIndex < 0) continue;

    const score =
      (title === normalizedQuery ? 100 : 0) +
      (titleIndex === 0 ? 60 : titleIndex >= 0 ? 35 : 0) +
      (bodyIndex >= 0 ? 20 : 0) +
      Math.max(0, 8 - Math.floor((now - note.updatedAt) / 86400000));

    hits.push({
      note,
      matchType: 'lexical',
      snippet: makeSnippet(note.title, note.body, query),
      score
    });
  }

  return hits
    .sort((left, right) => right.score - left.score || right.note.updatedAt - left.note.updatedAt)
    .slice(0, limit);
}
