<script lang="ts">
  import { Image as ImageIcon, Sparkles } from '@lucide/svelte';
  import { createEventDispatcher } from 'svelte';
  import { parseNoteContent } from '../lib/note-content';
  import { formatRelativeTime } from '../lib/text';
  import type { SearchHit } from '../lib/types';
  import HighlightedText from './HighlightedText.svelte';
  import ImageGallery from './ImageGallery.svelte';

  export let hit: SearchHit;
  export let query = '';
  export let selected = false;
  export let optionIndex = 0;

  const dispatch = createEventDispatcher<{ edit: void }>();

  $: contentBlocks = parseNoteContent(hit.note.body, hit.note.images);
</script>

<article
  id={`search-option-${optionIndex}`}
  class:selected
  class="note-card scroll-mt-24 px-3 py-4 sm:px-4"
  aria-current={selected ? 'true' : undefined}
>
  <header class="mb-2 flex items-start gap-3">
    <div
      class="min-w-0 flex-1 cursor-text text-left"
      role="button"
      tabindex="0"
      aria-label={`编辑 ${hit.note.title}`}
      on:click={() => dispatch('edit')}
      on:keydown={(event) => (event.key === 'Enter' || event.key === ' ') && dispatch('edit')}
    >
      <h2 class="break-words text-[15px] font-semibold leading-6 tracking-[-0.01em]">
        <HighlightedText text={hit.note.title || '无标题'} {query} />
      </h2>
      <div class="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-base-content/42">
        <time>{formatRelativeTime(hit.note.updatedAt)}</time>
        {#if hit.matchType === 'semantic' || hit.matchType === 'both'}
          <span class="inline-flex items-center gap-1 text-primary/75">
            <Sparkles size={11} /> {hit.matchType === 'both' ? '关键词 + 语义' : '语义相关'}
          </span>
        {/if}
        {#if hit.note.images.length > 0}
          <span class="inline-flex items-center gap-1">
            <ImageIcon size={11} /> {hit.note.images.length}
          </span>
        {/if}
      </div>
    </div>
  </header>

  <div>
    {#each contentBlocks as block (block.key)}
      {#if block.type === 'text'}
        <div
          class="note-prose min-h-6 cursor-text text-[14px] text-base-content/78"
          role="button"
          tabindex="0"
          aria-label={`编辑 ${hit.note.title} 的正文`}
          on:click={() => dispatch('edit')}
          on:keydown={(event) => (event.key === 'Enter' || event.key === ' ') && dispatch('edit')}
        >
          {#if block.text}<HighlightedText text={block.text} {query} />{/if}
        </div>
      {:else if block.type === 'image'}
        <ImageGallery images={[block.image]} />
      {/if}
    {/each}
  </div>
</article>

<style>
  .note-card {
    border-radius: 0;
    transition: box-shadow 120ms ease, border-radius 120ms ease;
  }

  .note-card.selected {
    border-radius: var(--radius-box);
    box-shadow: inset 0 0 0 1.5px color-mix(in oklab, var(--color-primary) 72%, transparent);
  }
</style>
