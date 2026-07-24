<script lang="ts">
  import { Image as ImageIcon } from '@lucide/svelte';
  import { createEventDispatcher } from 'svelte';
  import { logicalNoteLines, parseNoteContent } from '../lib/note-content';
  import { formatRelativeTime } from '../lib/text';
  import type { NoteLayoutMode, SearchHit } from '../lib/types';
  import HighlightedText from './HighlightedText.svelte';
  import ImageGallery from './ImageGallery.svelte';

  export let hit: SearchHit;
  export let query = '';
  export let selected = false;
  export let optionIndex = 0;
  export let activeRawLineIndex: number | null = null;
  export let activeTitle = false;
  export let layoutMode: NoteLayoutMode = 'flat';

  const dispatch = createEventDispatcher<{
    edit: { source: 'title' } | { source: 'body'; rawLineIndex: number };
  }>();

  $: contentBlocks = parseNoteContent(hit.note.body, hit.note.images);
  $: contentLines = logicalNoteLines(contentBlocks);
</script>

<article
  id={`search-option-${optionIndex}`}
  class:selected
  class:flat-card={layoutMode === 'flat'}
  class:deck-card={layoutMode === 'deck'}
  class="note-card scroll-mt-24 px-3 py-4 sm:px-4"
  aria-current={selected ? 'true' : undefined}
>
  <header
    id={`note-${hit.note.id}-title`}
    class={`note-card-header mb-2 flex items-start gap-3 ${activeTitle ? 'current-title-match' : ''}`}
    aria-current={activeTitle ? 'true' : undefined}
  >
    <div
      class="min-w-0 flex-1 cursor-text text-left outline-none"
      role="button"
      tabindex="0"
      aria-label={`编辑 ${hit.note.title}`}
      on:click={() => dispatch('edit', { source: 'title' })}
      on:keydown={(event) =>
        (event.key === 'Enter' || event.key === ' ') && dispatch('edit', { source: 'title' })}
    >
      <h2 class="break-words text-[15px] font-semibold leading-6 tracking-[-0.01em]">
        <HighlightedText text={hit.note.title || '无标题'} {query} />
      </h2>
      <div class="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-base-content/38">
        <time>{formatRelativeTime(hit.note.updatedAt)}</time>
        {#if hit.matchType === 'semantic' || hit.matchType === 'both'}
          <span class="semantic-tag inline-flex items-center gap-1.5 text-primary/72">
            <span class="semantic-dot" aria-hidden="true"></span>
            {hit.matchType === 'both' ? '关键词 + 语义' : '语义相关'}
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

  <div class="note-lines">
    {#each contentLines as line (line.rawLineIndex)}
      {#if line.type === 'text'}
        <div
          id={`note-${hit.note.id}-line-${line.rawLineIndex}`}
          data-body-line-index={line.rawLineIndex}
          class={`note-line cursor-text text-base-content/72 outline-none ${line.rawLineIndex === activeRawLineIndex ? 'current-match' : ''}`}
          role="button"
          tabindex="0"
          aria-current={line.rawLineIndex === activeRawLineIndex ? 'true' : undefined}
          aria-label={`编辑 ${hit.note.title} 的第 ${line.displayLineNumber} 行`}
          on:click={() => dispatch('edit', { source: 'body', rawLineIndex: line.rawLineIndex })}
          on:keydown={(event) =>
            (event.key === 'Enter' || event.key === ' ') &&
            dispatch('edit', { source: 'body', rawLineIndex: line.rawLineIndex })}
        >
          <span class="note-line-number" aria-hidden="true">{line.displayLineNumber}</span>
          <div class="note-line-content">
            {#if line.text}<HighlightedText text={line.text} {query} />{/if}
          </div>
        </div>
      {:else}
        <div
          id={`note-${hit.note.id}-line-${line.rawLineIndex}`}
          data-body-line-index={line.rawLineIndex}
          class={`note-line note-image-line ${line.rawLineIndex === activeRawLineIndex ? 'current-match' : ''}`}
        >
          <span class="note-line-number" aria-hidden="true">{line.displayLineNumber}</span>
          <div class="note-line-content note-image-content">
            <ImageGallery images={[line.image]} />
          </div>
        </div>
      {/if}
    {/each}
  </div>
</article>

<style>
  .note-card {
    border-radius: calc(var(--radius-box) * 0.72);
    border: 1px solid color-mix(in oklab, var(--color-base-content) 8%, transparent);
    background: color-mix(in oklab, var(--color-base-100) 97%, var(--color-base-200) 3%);
    box-shadow:
      inset 0 1px 0 color-mix(in oklab, white 52%, transparent),
      0 1px 2px color-mix(in oklab, var(--color-base-content) 4%, transparent),
      0 8px 22px color-mix(in oklab, var(--color-base-content) 5%, transparent);
    transition:
      border-color 150ms ease,
      box-shadow 150ms ease,
      background-color 150ms ease;
  }

  .note-card.deck-card {
    border-color: color-mix(in oklab, var(--color-base-content) 11%, transparent);
    background: var(--color-base-100);
    box-shadow:
      inset 0 1px 0 color-mix(in oklab, white 58%, transparent),
      0 2px 5px color-mix(
        in oklab,
        color-mix(in oklab, var(--color-base-content) 6%, transparent) var(--deck-shadow-strength, 100%),
        transparent
      ),
      0 16px 36px color-mix(
        in oklab,
        color-mix(in oklab, var(--color-base-content) 9%, transparent) var(--deck-shadow-strength, 100%),
        transparent
      );
  }

  .note-card.selected {
    background: color-mix(in oklab, var(--color-primary) 4%, transparent);
    box-shadow:
      inset 0 0 0 1px color-mix(in oklab, var(--color-primary) 26%, transparent),
      0 2px 5px color-mix(
        in oklab,
        color-mix(in oklab, var(--color-base-content) 5%, transparent) var(--deck-shadow-strength, 100%),
        transparent
      ),
      0 12px 28px color-mix(
        in oklab,
        color-mix(in oklab, var(--color-base-content) 7%, transparent) var(--deck-shadow-strength, 100%),
        transparent
      );
  }

  .note-card:not(.selected):hover {
    border-color: color-mix(in oklab, var(--color-base-content) 14%, transparent);
    background: color-mix(in oklab, var(--color-base-100) 91%, var(--color-base-200) 9%);
  }

  .note-card [role='button']:focus-visible {
    border-radius: 0.3rem;
    background: color-mix(in oklab, var(--color-base-content) 4%, transparent);
  }

  .note-card-header {
    position: relative;
    isolation: isolate;
    overflow: clip;
    border-radius: 0.35rem;
  }

  .semantic-dot {
    width: 5px;
    height: 5px;
    flex: none;
    border-radius: 999px;
    background: color-mix(in oklab, var(--color-primary) 72%, transparent);
    box-shadow: 0 0 0 3px color-mix(in oklab, var(--color-primary) 13%, transparent);
  }

  .note-image-content :global(.mt-3) {
    margin-top: 0;
  }
</style>
