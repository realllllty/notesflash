import type { SearchHit } from './types';

export interface QuickNoteDraft {
  title: string;
  body: string;
  hasBodySeparator: boolean;
}

export function parseQuickNoteInput(value: string): QuickNoteDraft {
  const separator = value.search(/\s/);
  if (separator < 0) {
    return { title: value.trim(), body: '', hasBodySeparator: false };
  }

  return {
    title: value.slice(0, separator).trim(),
    body: value.slice(separator + 1).replace(/^\s+/, '').trimEnd(),
    hasBodySeparator: true
  };
}

export function isImeComposing(event: Pick<KeyboardEvent, 'isComposing' | 'keyCode'>): boolean {
  return event.isComposing || event.keyCode === 229;
}

export function normalizeText(value: string): string {
  return value
    .normalize('NFKC')
    .toLocaleLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function firstMatchingLine(noteText: string, query: string): string {
  const normalizedQuery = normalizeText(query);
  const lines = noteText.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);

  if (!normalizedQuery) return lines[0] ?? '';

  return lines.find((line) => normalizeText(line).includes(normalizedQuery)) ?? lines[0] ?? '';
}

export function makeSnippet(title: string, body: string, query: string, maxLength = 180): string {
  const combined = `${title}\n${body}`.trim();
  const line = firstMatchingLine(combined, query) || combined;
  if (line.length <= maxLength) return line;
  return `${line.slice(0, maxLength).trimEnd()}…`;
}

export function characterNgrams(value: string, size = 2): Map<string, number> {
  const normalized = normalizeText(value).replace(/\s/g, '');
  const result = new Map<string, number>();

  if (normalized.length < size) {
    if (normalized) result.set(normalized, 1);
    return result;
  }

  for (let index = 0; index <= normalized.length - size; index += 1) {
    const gram = normalized.slice(index, index + size);
    result.set(gram, (result.get(gram) ?? 0) + 1);
  }

  return result;
}

export function cosineSimilarity(left: Map<string, number>, right: Map<string, number>): number {
  if (left.size === 0 || right.size === 0) return 0;

  let dot = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;

  for (const value of left.values()) leftMagnitude += value * value;
  for (const value of right.values()) rightMagnitude += value * value;

  for (const [key, value] of left) {
    dot += value * (right.get(key) ?? 0);
  }

  if (leftMagnitude === 0 || rightMagnitude === 0) return 0;
  return dot / (Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude));
}

export function mergeSearchHits(lexical: SearchHit[], semantic: SearchHit[]): SearchHit[] {
  const merged = new Map<string, SearchHit>();

  lexical.forEach((hit, index) => {
    merged.set(hit.note.id, {
      ...hit,
      lexicalRank: index + 1,
      score: reciprocalRank(index + 1, 1)
    });
  });

  semantic.forEach((hit, index) => {
    const existing = merged.get(hit.note.id);
    if (existing) {
      merged.set(hit.note.id, {
        ...existing,
        matchType: 'both',
        semanticRank: index + 1,
        score: existing.score + reciprocalRank(index + 1, 0.72)
      });
      return;
    }

    merged.set(hit.note.id, {
      ...hit,
      semanticRank: index + 1,
      score: reciprocalRank(index + 1, 0.72)
    });
  });

  return [...merged.values()].sort((a, b) => b.score - a.score);
}

function reciprocalRank(rank: number, weight: number): number {
  return weight / (60 + rank);
}

export function formatRelativeTime(timestamp: number, now = Date.now()): string {
  const seconds = Math.max(0, Math.floor((now - timestamp) / 1000));
  if (seconds < 45) return '刚刚';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} 分钟前`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} 小时前`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)} 天前`;

  return new Intl.DateTimeFormat('zh-CN', {
    month: 'short',
    day: 'numeric',
    year: new Date(timestamp).getFullYear() === new Date(now).getFullYear() ? undefined : 'numeric'
  }).format(timestamp);
}
