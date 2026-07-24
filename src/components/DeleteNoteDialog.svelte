<script lang="ts">
  import { AlertTriangle, LoaderCircle, Trash2, X } from '@lucide/svelte';
  import { createEventDispatcher, onMount } from 'svelte';

  export let title = '无标题';
  export let deleting = false;
  export let errorMessage = '';

  const dispatch = createEventDispatcher<{
    cancel: void;
    confirm: void;
  }>();

  let cancelButton: HTMLButtonElement;

  onMount(() => {
    cancelButton?.focus({ preventScroll: true });
    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || deleting) return;
      event.preventDefault();
      dispatch('cancel');
    };
    document.addEventListener('keydown', handleKeydown);
    return () => document.removeEventListener('keydown', handleKeydown);
  });
</script>

<div
  class="delete-dialog-overlay fixed inset-0 z-[60] bg-neutral/30 backdrop-blur-[2px]"
  role="presentation"
  on:click={() => !deleting && dispatch('cancel')}
></div>

<div
  class="delete-dialog surface fixed left-1/2 top-1/2 z-[70] w-[min(92vw,25rem)] -translate-x-1/2 -translate-y-1/2 rounded-box p-5"
  role="alertdialog"
  tabindex="-1"
  aria-modal="true"
  aria-labelledby="delete-dialog-title"
  aria-describedby="delete-dialog-description"
>
  <header class="flex items-start gap-3">
    <div class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-error/10 text-error">
      <Trash2 size={19} />
    </div>
    <div class="min-w-0 flex-1">
      <h2 id="delete-dialog-title" class="text-base font-semibold">删除这条笔记？</h2>
      <p id="delete-dialog-description" class="mt-1 text-sm leading-6 text-base-content/55">
        “{title || '无标题'}”将从云端永久删除，这个操作无法撤销。
      </p>
    </div>
    <button
      type="button"
      class="btn btn-ghost btn-circle btn-xs -mr-1 -mt-1 text-base-content/45"
      aria-label="关闭删除确认"
      disabled={deleting}
      on:click={() => dispatch('cancel')}
    >
      <X size={15} />
    </button>
  </header>

  {#if errorMessage}
    <div class="mt-4 flex items-start gap-2 rounded-box bg-error/9 px-3 py-2.5 text-xs leading-5 text-error" role="alert">
      <AlertTriangle size={15} class="mt-0.5 shrink-0" />
      <span>{errorMessage}</span>
    </div>
  {/if}

  <footer class="mt-5 flex justify-end gap-2">
    <button
      bind:this={cancelButton}
      type="button"
      class="btn btn-ghost btn-sm"
      disabled={deleting}
      on:click={() => dispatch('cancel')}
    >
      取消
    </button>
    <button
      type="button"
      class="btn btn-error btn-sm min-w-24 gap-1.5"
      disabled={deleting}
      on:click={() => dispatch('confirm')}
    >
      {#if deleting}
        <LoaderCircle size={15} class="animate-spin" />
        删除中
      {:else}
        <Trash2 size={15} />
        删除笔记
      {/if}
    </button>
  </footer>
</div>

<style>
  .delete-dialog {
    box-shadow:
      0 4px 12px color-mix(in oklab, var(--color-base-content) 8%, transparent),
      0 24px 64px color-mix(in oklab, var(--color-base-content) 18%, transparent);
    animation: delete-dialog-in 180ms cubic-bezier(0.2, 0.85, 0.25, 1) both;
  }

  .delete-dialog-overlay {
    animation: delete-overlay-in 140ms ease both;
  }

  @keyframes delete-dialog-in {
    from {
      opacity: 0;
      transform: translate(-50%, calc(-50% + 8px)) scale(0.98);
    }
    to {
      opacity: 1;
      transform: translate(-50%, -50%) scale(1);
    }
  }

  @keyframes delete-overlay-in {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  @media (prefers-reduced-motion: reduce) {
    .delete-dialog,
    .delete-dialog-overlay {
      animation: none;
    }
  }
</style>
