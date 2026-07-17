<script lang="ts">
  import { CornerDownLeft, Plus } from '@lucide/svelte';
  import { parseQuickNoteInput } from '../lib/text';

  export let query = '';
  export let selected = false;

  $: draft = parseQuickNoteInput(query);
</script>

<button
  id="search-option-0"
  type="button"
  aria-current={selected ? 'true' : undefined}
  class:selected
  class="quick-create group flex w-full items-center gap-3 rounded-box border border-dashed px-3 py-3 text-left transition"
  on:click
>
  <span class="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-content">
    <Plus size={18} />
  </span>
  <span class="min-w-0 flex-1">
    <span class="block text-sm font-medium">创建“{draft.title || '无标题'}”</span>
    <span class="block truncate text-xs text-base-content/48">
      {#if draft.hasBodySeparator}
        正文：{draft.body || '继续在搜索框中输入正文'}
      {:else}
        按 Space 继续输入正文
      {/if}
    </span>
  </span>
  <span class="hidden items-center gap-1 text-[11px] text-base-content/38 group-hover:flex sm:flex">
    <CornerDownLeft size={13} /> Enter
  </span>
</button>

<style>
  .quick-create {
    border-color: color-mix(in oklab, var(--color-primary) 25%, var(--color-base-300));
    background: color-mix(in oklab, var(--color-primary) 4%, var(--color-base-100));
  }

  .quick-create:hover,
  .quick-create.selected {
    border-color: color-mix(in oklab, var(--color-primary) 55%, var(--color-base-300));
    background: color-mix(in oklab, var(--color-primary) 9%, var(--color-base-100));
  }
</style>
