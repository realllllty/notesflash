import { imageIdFromMarker } from './note-content';
import { normalizeText } from './text';
import type { SearchHit } from './types';

export type SearchLineSource = 'title' | 'body' | 'semantic';

/**
 * A keyboard-navigation target within a note-level search result.
 *
 * SearchHit intentionally remains note-level so a note is rendered only once.
 * These targets form a separate, flattened view over the matching logical lines.
 */
export interface SearchLineTarget {
  key: string;
  noteId: string;
  hitIndex: number;
  source: SearchLineSource;
  /** Zero-based index in the serialized body split on `\n`. */
  rawLineIndex: number | null;
  /** One-based body line number. Titles do not have a body line number. */
  lineNumber: number | null;
  text: string;
  /** True when this is a location fallback rather than a literal line match. */
  semanticOnly: boolean;
}

interface CandidateLine {
  key: string;
  noteId: string;
  hitIndex: number;
  source: SearchLineSource;
  rawLineIndex: number | null;
  lineNumber: number | null;
  text: string;
}

/**
 * Expand ranked, note-level hits into ranked logical-line navigation targets.
 * A note remains a single card, while every literal matching line can be visited.
 */
export function collectSearchLineTargets(
  hits: readonly SearchHit[],
  query: string
): SearchLineTarget[] {
  const normalizedQuery = normalizeText(query);
  if (!normalizedQuery) return [];

  return hits.flatMap<SearchLineTarget>((hit, hitIndex): SearchLineTarget[] => {
    const candidates = candidateLines(hit, hitIndex);
    const literalMatches = candidates.filter((line) =>
      normalizeText(line.text).includes(normalizedQuery)
    );

    if (literalMatches.length > 0) {
      return literalMatches.map((line) => ({ ...line, semanticOnly: false }));
    }

    // A lexical hit without a literal line is stale or invalid and must not
    // turn into an arbitrary visible match. Only semantic-capable hits may
    // use a location fallback.
    if (hit.matchType === 'lexical') return [];

    return [semanticFallback(hit, hitIndex)];
  });
}

/** Move to the next/previous line target, wrapping at either end. */
export function moveActiveMatchKey(
  targets: readonly SearchLineTarget[],
  activeKey: string | null,
  direction: 'next' | 'previous'
): string | null {
  if (targets.length === 0) return null;

  const currentIndex = activeKey === null
    ? -1
    : targets.findIndex((target) => target.key === activeKey);

  if (currentIndex < 0) {
    return direction === 'next' ? targets[0].key : targets[targets.length - 1].key;
  }

  const offset = direction === 'next' ? 1 : -1;
  const nextIndex = (currentIndex + offset + targets.length) % targets.length;
  return targets[nextIndex].key;
}

/**
 * Keep an active target stable while asynchronous lexical/semantic results merge.
 * If the exact line disappeared, prefer another target in the same note.
 */
export function retainActiveMatchKey(
  targets: readonly SearchLineTarget[],
  activeKey: string | null,
  previousTarget: SearchLineTarget | null = null
): string | null {
  if (activeKey === null) return null;
  if (targets.some((target) => target.key === activeKey)) return activeKey;
  if (!previousTarget) return null;

  const sameNote = targets.filter((target) => target.noteId === previousTarget.noteId);
  if (sameNote.length === 0) return null;

  if (previousTarget.source === 'title') {
    return sameNote.find((target) => target.source === 'title')?.key ?? sameNote[0].key;
  }

  const previousLine = previousTarget.rawLineIndex ?? 0;
  const closestBodyLine = sameNote
    .filter((target) => target.source === 'body' && target.rawLineIndex !== null)
    .sort((left, right) =>
      Math.abs((left.rawLineIndex ?? 0) - previousLine) -
      Math.abs((right.rawLineIndex ?? 0) - previousLine)
    )[0];
  return closestBodyLine?.key ?? sameNote[0].key;
}

export function activeSearchLineTarget(
  targets: readonly SearchLineTarget[],
  activeKey: string | null
): SearchLineTarget | null {
  if (activeKey === null) return null;
  return targets.find((target) => target.key === activeKey) ?? null;
}

function candidateLines(hit: SearchHit, hitIndex: number): CandidateLine[] {
  const noteId = hit.note.id;
  const candidates: CandidateLine[] = [
    {
      key: targetKey(noteId, 'title', null),
      noteId,
      hitIndex,
      source: 'title',
      rawLineIndex: null,
      lineNumber: null,
      text: hit.note.title
    }
  ];
  const validImageIds = new Set(hit.note.images.map((image) => image.id));

  hit.note.body.split('\n').forEach((text, rawLineIndex) => {
    const markerImageId = imageIdFromMarker(text);
    if (markerImageId && validImageIds.has(markerImageId)) return;

    candidates.push({
      key: targetKey(noteId, 'body', rawLineIndex),
      noteId,
      hitIndex,
      source: 'body',
      rawLineIndex,
      lineNumber: rawLineIndex + 1,
      text
    });
  });

  return candidates;
}

function semanticFallback(hit: SearchHit, hitIndex: number): SearchLineTarget {
  const firstBodyLine = hit.note.body
    .split('\n')
    .find((line) => !imageIdFromMarker(line) && normalizeText(line));
  return {
    key: targetKey(hit.note.id, 'semantic', null),
    noteId: hit.note.id,
    hitIndex,
    source: 'semantic',
    rawLineIndex: null,
    lineNumber: null,
    text: hit.note.title || firstBodyLine || '无标题',
    semanticOnly: true
  };
}

function targetKey(
  noteId: string,
  source: SearchLineSource,
  rawLineIndex: number | null
): string {
  if (source === 'title') return `${noteId}:title`;
  if (source === 'semantic') return `${noteId}:semantic`;
  return `${noteId}:body:${rawLineIndex ?? 0}`;
}
