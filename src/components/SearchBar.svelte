<script lang="ts">
  import { LoaderCircle, Search, Settings2, X } from '@lucide/svelte';
  import { createEventDispatcher } from 'svelte';
  import { isImeComposing, parseQuickNoteInput } from '../lib/text';

  export let value = '';
  export let semanticSearching = false;
  export let semanticEnabled = true;
  export let semanticResultCount = 0;
  export let semanticError = false;
  export let semanticLimit = 8;
  export let activeDescendant: string | undefined = undefined;

  const dispatch = createEventDispatcher<{
    input: string;
    keyaction: KeyboardEvent;
    settings: void;
  }>();

  let inputElement: HTMLInputElement;
  let composing = false;
  let ignoreEnterUntil = 0;
  let responseSequence = 0;

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
    responseSequence += 1;
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

<div class="search-shell surface sticky top-[calc(.75rem+var(--safe-top))] z-30 overflow-hidden rounded-box">
  <span class="search-focus-sweep" aria-hidden="true"></span>

  <div class="flex items-center gap-2.5 px-3.5 pb-1.5 pt-2.5">
    <Search size={19} strokeWidth={1.8} class="search-leading-icon shrink-0 text-base-content/38" />
    <input
      bind:this={inputElement}
      class="min-w-0 flex-1 bg-transparent px-0.5 py-2.5 text-[15px] tracking-[-0.005em] text-base-content outline-none placeholder:text-base-content/38"
      type="text"
      role="searchbox"
      inputmode="search"
      autocomplete="off"
      spellcheck="false"
      placeholder="输入标题，按空格继续写正文…"
      aria-label="搜索笔记或快速创建笔记"
      aria-describedby="quick-draft-hint"
      aria-activedescendant={activeDescendant}
      value={value}
      on:input={update}
      on:compositionstart={() => (composing = true)}
      on:compositionend={finishComposition}
      on:keydown={handleKeydown}
    />

    {#if semanticSearching}
      <span
        class="tooltip tooltip-bottom inline-flex items-center gap-1.5"
        data-tip={`精准匹配为 0，正在请求语义 Top ${semanticLimit}`}
      >
        <LoaderCircle size={15} class="animate-spin text-primary/70" />
        <span class="hidden text-[10px] font-medium text-base-content/42 sm:inline">
          请求 Top {semanticLimit}
        </span>
      </span>
    {:else if semanticEnabled && value.trim()}
      <span
        class:semantic-results-badge={semanticResultCount > 0}
        class:semantic-error-badge={semanticError}
        class="badge badge-ghost badge-sm hidden gap-1 border-base-content/8 bg-base-200/55 text-[10px] font-medium tracking-wide text-base-content/42 sm:inline-flex"
      >
        {semanticError
          ? '语义不可用'
          : semanticResultCount > 0
            ? `语义 ${semanticResultCount} 条`
            : '精准优先'}
      </span>
    {/if}

    {#if value}
      <button
        type="button"
        class="btn btn-ghost btn-circle btn-xs text-base-content/42 hover:bg-base-200/70"
        aria-label="清空搜索"
        on:click={() => dispatch('input', '')}
      >
        <X size={15} />
      </button>
    {/if}

    <button
      type="button"
      class="search-action btn btn-ghost btn-circle btn-sm text-base-content/62 hover:bg-base-200/75"
      aria-label="打开设置"
      on:click={() => dispatch('settings')}
    >
      <Settings2 size={17} />
    </button>
  </div>

  <div id="quick-draft-hint" class="px-3.5 pb-3" aria-live="polite">
    <div class="draft-track relative flex h-0.5 overflow-hidden rounded-full">
      <span
        class="draft-title h-full transition-[width] duration-150"
        style={`width: ${value ? titleShare : 0}%`}
      ></span>
      {#if draft.hasBodySeparator}
        <span class="draft-body h-full flex-1 transition-[width] duration-150"></span>
      {/if}
      {#key responseSequence}
        {#if responseSequence > 0}
          <span class="input-response" aria-hidden="true"></span>
        {/if}
      {/key}
    </div>
    <div class="mt-1.5 flex min-w-0 items-center gap-1.5 text-[10px] leading-4 text-base-content/40">
      {#if !value}
        <span><strong class="font-medium text-base-content/58">标题</strong> · 按 Space 开始正文</span>
      {:else if !draft.hasBodySeparator}
        <span class="truncate"><strong class="font-medium text-base-content/58">标题</strong> {draft.title}</span>
        <span class="ml-auto shrink-0">Space → 正文</span>
      {:else}
        <span class="max-w-[45%] truncate"><strong class="font-medium text-base-content/58">标题</strong> {draft.title || '无标题'}</span>
        <span class="text-base-content/25">/</span>
        <span class="min-w-0 flex-1 truncate"><strong class="font-medium text-base-content/58">正文</strong> {draft.body || '继续输入…'}</span>
      {/if}
    </div>
  </div>
</div>

<style>
  .search-shell {
    border-color: color-mix(in oklab, var(--color-base-content) 11%, transparent);
    background: color-mix(in oklab, var(--color-base-100) 97%, var(--color-base-200) 3%);
    box-shadow:
      inset 0 1px 0 color-mix(in oklab, white 58%, transparent),
      inset 0 -1px 0 color-mix(in oklab, var(--color-base-content) 4%, transparent),
      0 0 0 1px color-mix(in oklab, var(--color-base-content) 2%, transparent),
      0 2px 5px color-mix(in oklab, var(--color-base-content) 5%, transparent),
      0 14px 36px color-mix(in oklab, var(--color-base-content) 7%, transparent);
    transition:
      transform 150ms cubic-bezier(0.2, 0.8, 0.2, 1),
      border-color 140ms ease,
      box-shadow 140ms ease,
      background-color 140ms ease;
    transform: translateY(0);
    will-change: transform;
  }

  .search-shell:focus-within {
    transform: translateY(-1px);
    border-color: color-mix(in oklab, var(--color-base-content) 20%, transparent);
    background: var(--color-base-100);
    box-shadow:
      inset 0 1px 0 color-mix(in oklab, white 64%, transparent),
      inset 0 -1px 0 color-mix(in oklab, var(--color-base-content) 5%, transparent),
      0 0 0 1px color-mix(in oklab, var(--color-base-content) 3%, transparent),
      0 3px 7px color-mix(in oklab, var(--color-base-content) 6%, transparent),
      0 18px 44px color-mix(in oklab, var(--color-base-content) 9%, transparent);
  }

  .search-focus-sweep {
    position: absolute;
    top: 0;
    left: 0;
    z-index: 20;
    width: 34%;
    height: 1px;
    pointer-events: none;
    opacity: 0;
    transform: translateX(-115%);
    background: linear-gradient(
      90deg,
      transparent,
      color-mix(in oklab, white 82%, var(--color-base-content) 18%),
      transparent
    );
  }

  .search-shell:focus-within .search-focus-sweep {
    animation: focus-sweep 420ms cubic-bezier(0.22, 0.78, 0.22, 1) both;
  }

  .search-shell :global(.search-leading-icon),
  .search-action {
    transition:
      color 140ms ease,
      background-color 140ms ease,
      border-color 140ms ease;
  }

  .search-shell:focus-within :global(.search-leading-icon) {
    color: color-mix(in oklab, var(--color-base-content) 62%, transparent);
    animation: search-icon-snap 340ms cubic-bezier(0.2, 0.9, 0.25, 1);
  }

  .search-action {
    border: 1px solid transparent;
  }

  .search-shell:focus-within .search-action {
    border-color: color-mix(in oklab, var(--color-base-content) 6%, transparent);
    background: color-mix(in oklab, var(--color-base-200) 58%, transparent);
  }

  .draft-track {
    background: color-mix(in oklab, var(--color-base-content) 9%, transparent);
  }

  .input-response {
    position: absolute;
    inset-block: 0;
    left: 0;
    z-index: 2;
    width: 16%;
    border-radius: inherit;
    pointer-events: none;
    background: linear-gradient(
      90deg,
      transparent,
      color-mix(in oklab, white 78%, var(--color-primary) 22%),
      transparent
    );
    animation: input-response 240ms cubic-bezier(0.2, 0.75, 0.25, 1) both;
  }

  .draft-title {
    background: color-mix(in oklab, var(--color-primary) 68%, var(--color-base-content) 12%);
  }

  .semantic-results-badge {
    border-color: color-mix(in oklab, var(--color-primary) 14%, transparent);
    background: linear-gradient(
      100deg,
      color-mix(in oklab, #ff6b8a 13%, var(--color-base-100)),
      color-mix(in oklab, #ffd166 13%, var(--color-base-100)),
      color-mix(in oklab, #55d6be 13%, var(--color-base-100)),
      color-mix(in oklab, #7c83ff 13%, var(--color-base-100))
    );
    color: color-mix(in oklab, var(--color-base-content) 68%, transparent);
  }

  .semantic-error-badge {
    border-color: color-mix(in oklab, var(--color-error) 22%, transparent);
    background: color-mix(in oklab, var(--color-error) 8%, var(--color-base-100));
    color: color-mix(in oklab, var(--color-error) 72%, var(--color-base-content));
  }

  .draft-body {
    background: color-mix(in oklab, var(--color-success) 44%, var(--color-base-content) 12%);
  }

  @media (prefers-reduced-motion: reduce) {
    .search-shell,
    .search-shell :global(.search-leading-icon),
    .search-action {
      transition: none;
    }

    .search-shell:focus-within {
      transform: none;
    }

    .search-focus-sweep,
    .search-shell:focus-within .search-focus-sweep,
    .search-shell:focus-within :global(.search-leading-icon),
    .input-response {
      animation: none;
    }
  }

  @keyframes focus-sweep {
    0% {
      opacity: 0;
      transform: translateX(-115%);
    }
    18% {
      opacity: 0.82;
    }
    78% {
      opacity: 0.7;
    }
    100% {
      opacity: 0;
      transform: translateX(295%);
    }
  }

  @keyframes search-icon-snap {
    0% {
      transform: translateX(-1px) rotate(-5deg) scale(0.94);
    }
    52% {
      transform: translateX(0.5px) rotate(2deg) scale(1.04);
    }
    100% {
      transform: translateX(0) rotate(0) scale(1);
    }
  }

  @keyframes input-response {
    0% {
      opacity: 0;
      transform: translateX(-110%);
    }
    22% {
      opacity: 0.9;
    }
    100% {
      opacity: 0;
      transform: translateX(640%);
    }
  }

  :global([data-theme='notesflash-dark']) .search-shell,
  :global([data-theme='notesflash-dark']) .search-shell:focus-within {
    box-shadow:
      inset 0 1px 0 color-mix(in oklab, white 9%, transparent),
      inset 0 -1px 0 color-mix(in oklab, black 24%, transparent),
      0 0 0 1px color-mix(in oklab, white 2%, transparent),
      0 3px 7px color-mix(in oklab, black 22%, transparent),
      0 18px 44px color-mix(in oklab, black 28%, transparent);
  }
</style>
