<script lang="ts">
  import { LoaderCircle, Search, Settings2, X } from '@lucide/svelte';
  import { createEventDispatcher } from 'svelte';
  import { isImeComposing, parseQuickNoteInput } from '../lib/text';

  export let value = '';
  export let semanticSearching = false;
  export let semanticEnabled = true;
  export let selectedIndex = 0;

  const dispatch = createEventDispatcher<{
    input: string;
    keyaction: KeyboardEvent;
    settings: void;
  }>();

  let inputElement: HTMLInputElement;
  let composing = false;
  let ignoreEnterUntil = 0;

  $: draft = parseQuickNoteInput(value);
  $: totalDraftLength = Math.max(1, draft.title.length + draft.body.length);
  $: titleShare = draft.hasBodySeparator
    ? Math.min(80, Math.max(20, (draft.title.length / totalDraftLength) * 100))
    : 100;

  export function focus(): void {
    inputElement?.focus();
    inputElement?.select();
  }

  function update(event: Event): void {
    dispatch('input', (event.currentTarget as HTMLInputElement).value);
  }

  function handleKeydown(event: KeyboardEvent): void {
    if (composing || isImeComposing(event)) return;
    if (event.key === 'Enter' && performance.now() < ignoreEnterUntil) return;
    dispatch('keyaction', event);
  }

  function finishComposition(): void {
    composing = false;
    // Some WebKit/IME combinations emit a normal Enter immediately after
    // compositionend. Keep that commit key away from app shortcuts as well.
    ignoreEnterUntil = performance.now() + 100;
  }
</script>

<div class="surface sticky top-[calc(.75rem+var(--safe-top))] z-30 rounded-box shadow-sm">
  <div class="flex items-center gap-2 p-2 pb-1">
    <Search size={18} class="ml-1 shrink-0 text-base-content/45" />
    <input
      bind:this={inputElement}
      class="min-w-0 flex-1 bg-transparent px-1 py-2 text-[15px] outline-none placeholder:text-base-content/38"
      type="text"
      role="searchbox"
      inputmode="search"
      autocomplete="off"
      spellcheck="false"
      placeholder="输入标题，按空格继续写正文…"
      aria-label="搜索笔记或快速创建笔记"
      aria-describedby="quick-draft-hint"
      aria-activedescendant={`search-option-${selectedIndex}`}
      value={value}
      on:input={update}
      on:compositionstart={() => (composing = true)}
      on:compositionend={finishComposition}
      on:keydown={handleKeydown}
    />

    {#if semanticSearching}
      <span class="tooltip tooltip-bottom" data-tip="正在补充语义结果">
        <LoaderCircle size={16} class="animate-spin text-primary" />
      </span>
    {:else if semanticEnabled && value.trim()}
      <span class="badge badge-ghost badge-sm hidden gap-1 border-base-300 text-[10px] text-base-content/55 sm:inline-flex">
        AI
      </span>
    {/if}

    {#if value}
      <button
        type="button"
        class="btn btn-ghost btn-circle btn-xs text-base-content/50"
        aria-label="清空搜索"
        on:click={() => dispatch('input', '')}
      >
        <X size={15} />
      </button>
    {/if}

    <button
      type="button"
      class="btn btn-ghost btn-circle btn-sm"
      aria-label="打开设置"
      on:click={() => dispatch('settings')}
    >
      <Settings2 size={17} />
    </button>
  </div>

  <div id="quick-draft-hint" class="px-3 pb-2" aria-live="polite">
    <div class="flex h-1.5 overflow-hidden rounded-full bg-base-300/70">
      <span
        class="h-full bg-primary transition-[width] duration-150"
        style={`width: ${value ? titleShare : 0}%`}
      ></span>
      {#if draft.hasBodySeparator}
        <span class="h-full flex-1 bg-accent transition-[width] duration-150"></span>
      {/if}
    </div>
    <div class="mt-1 flex min-w-0 items-center gap-1.5 text-[10px] leading-4 text-base-content/45">
      {#if !value}
        <span><strong class="font-medium text-primary">标题</strong> · 按 Space 开始正文</span>
      {:else if !draft.hasBodySeparator}
        <span class="truncate"><strong class="font-medium text-primary">标题</strong> {draft.title}</span>
        <span class="ml-auto shrink-0">Space → 正文</span>
      {:else}
        <span class="max-w-[45%] truncate"><strong class="font-medium text-primary">标题</strong> {draft.title || '无标题'}</span>
        <span class="text-base-content/25">/</span>
        <span class="min-w-0 flex-1 truncate"><strong class="font-medium text-accent">正文</strong> {draft.body || '继续输入…'}</span>
      {/if}
    </div>
  </div>
</div>
