<script lang="ts">
  import type { LineSpan } from '../lib/match-spans';
  import { mergeSpans } from '../lib/match-spans';
  import { normalizeText } from '../lib/text';

  export let text = '';
  export let query = '';
  /** Character ranges matched semantically; highlighted with the rainbow ink. */
  export let spans: readonly LineSpan[] = [];

  type Segment = { value: string; match: boolean; semantic: boolean };

  $: segments = splitText(text, query, spans);

  function literalRanges(value: string, search: string): LineSpan[] {
    const normalizedSearch = normalizeText(search);
    if (!normalizedSearch) return [];

    const normalizedValue = value.normalize('NFKC').toLocaleLowerCase();
    const ranges: LineSpan[] = [];
    let cursor = 0;
    let index = normalizedValue.indexOf(normalizedSearch, cursor);
    while (index >= 0) {
      ranges.push({ start: index, end: index + search.length });
      cursor = index + search.length;
      index = normalizedValue.indexOf(normalizedSearch, cursor);
    }
    return ranges;
  }

  /**
   * Literal query hits and semantic spans are rendered together. Literal ranges
   * win on overlap because an exact match is the more precise statement.
   */
  function splitText(value: string, search: string, semanticSpans: readonly LineSpan[]): Segment[] {
    const literal = literalRanges(value, search);
    const semantic = mergeSpans(
      semanticSpans
        .map((span) => ({
          start: Math.max(0, Math.min(span.start, value.length)),
          end: Math.max(0, Math.min(span.end, value.length))
        }))
        .filter((span) => span.end > span.start)
    );
    if (literal.length === 0 && semantic.length === 0) {
      return [{ value, match: false, semantic: false }];
    }

    const marks = [
      ...literal.map((span) => ({ ...span, semantic: false })),
      ...semantic.map((span) => ({ ...span, semantic: true }))
    ].sort((left, right) => left.start - right.start || right.end - left.end);

    const result: Segment[] = [];
    let cursor = 0;
    for (const mark of marks) {
      const start = Math.max(mark.start, cursor);
      if (start >= mark.end) continue;
      if (start > cursor) {
        result.push({ value: value.slice(cursor, start), match: false, semantic: false });
      }
      result.push({ value: value.slice(start, mark.end), match: true, semantic: mark.semantic });
      cursor = mark.end;
    }
    if (cursor < value.length) {
      result.push({ value: value.slice(cursor), match: false, semantic: false });
    }
    return result;
  }
</script>

{#each segments as segment}
  {#if segment.match}<mark class:semantic-mark={segment.semantic}>{segment.value}</mark>{:else}{segment.value}{/if}
{/each}
