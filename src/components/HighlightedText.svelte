<script lang="ts">
  import { normalizeText } from '../lib/text';

  export let text = '';
  export let query = '';

  type Segment = { value: string; match: boolean };

  $: segments = splitText(text, query);

  function splitText(value: string, search: string): Segment[] {
    const normalizedSearch = normalizeText(search);
    if (!normalizedSearch) return [{ value, match: false }];

    const normalizedValue = value.normalize('NFKC').toLocaleLowerCase();
    const result: Segment[] = [];
    let cursor = 0;
    let index = normalizedValue.indexOf(normalizedSearch, cursor);

    while (index >= 0) {
      if (index > cursor) result.push({ value: value.slice(cursor, index), match: false });
      result.push({ value: value.slice(index, index + search.length), match: true });
      cursor = index + search.length;
      index = normalizedValue.indexOf(normalizedSearch, cursor);
    }

    if (cursor < value.length) result.push({ value: value.slice(cursor), match: false });
    return result.length > 0 ? result : [{ value, match: false }];
  }
</script>

{#each segments as segment}
  {#if segment.match}<mark>{segment.value}</mark>{:else}{segment.value}{/if}
{/each}
