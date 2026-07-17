<script lang="ts">
  import { CornerDownLeft, Plus } from '@lucide/svelte';
  import { parseQuickNoteInput } from '../lib/text';

  export let query = '';
  export let selected = false;
  export let enterCreates = false;

  $: draft = parseQuickNoteInput(query);
</script>

<button
  id="quick-create-option"
  type="button"
  aria-current={selected ? 'true' : undefined}
  class:selected
  class="quick-create group flex w-full items-center gap-3 rounded-box border px-3 py-2.5 text-left"
  on:click
>
  <span class="create-icon flex size-8 shrink-0 items-center justify-center rounded-lg">
    <Plus size={17} strokeWidth={1.8} />
  </span>
  <span class="min-w-0 flex-1">
    <span class="block text-[13px] font-medium tracking-[-0.005em]">创建“{draft.title || '无标题'}”</span>
    <span class="mt-0.5 block truncate text-[11px] text-base-content/42">
      {#if draft.hasBodySeparator}
        正文：{draft.body || '继续在搜索框中输入正文'}
      {:else}
        按 Space 继续输入正文
      {/if}
    </span>
  </span>
  <span class="hidden items-center gap-1 text-[10px] text-base-content/32 group-hover:flex sm:flex">
    {#if enterCreates}<CornerDownLeft size={13} /> Enter{:else}点击创建{/if}
  </span>
</button>

<style>
  .quick-create {
    outline: none;
    border-color: color-mix(in oklab, var(--color-base-content) 9%, transparent);
    background: color-mix(in oklab, var(--color-base-200) 54%, transparent);
    transition: border-color 120ms ease, background-color 120ms ease;
  }

  .quick-create:hover {
    border-color: color-mix(in oklab, var(--color-base-content) 15%, transparent);
    background: color-mix(in oklab, var(--color-base-200) 78%, transparent);
  }

  .quick-create.selected {
    background: color-mix(in oklab, var(--color-primary) 3%, var(--color-base-200));
    box-shadow: inset 0 0 0 1px color-mix(in oklab, var(--color-primary) 24%, transparent);
  }

  .quick-create:focus-visible:not(.selected) {
    box-shadow: inset 0 0 0 1px color-mix(in oklab, var(--color-base-content) 18%, transparent);
  }

  .create-icon {
    color: color-mix(in oklab, var(--color-primary) 70%, var(--color-base-content));
    background: color-mix(in oklab, var(--color-primary) 9%, var(--color-base-100));
    box-shadow: inset 0 0 0 1px color-mix(in oklab, var(--color-primary) 12%, transparent);
  }

  .quick-create.selected .create-icon {
    background: color-mix(in oklab, var(--color-primary) 13%, var(--color-base-100));
  }
</style>
