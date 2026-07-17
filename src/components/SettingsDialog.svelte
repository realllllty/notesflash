<script lang="ts">
  import { Check, Cloud, Command, Copy, KeyRound, LoaderCircle, LogOut, Moon, Sparkles, X } from '@lucide/svelte';
  import { createEventDispatcher, onDestroy } from 'svelte';
  import { copyText } from '../lib/clipboard';
  import type { PairingCode, SortMode } from '../lib/types';

  export let open = false;
  export let sortMode: SortMode = 'updated_desc';
  export let semanticEnabled = true;
  export let demoMode = false;
  export let endpoint = '';
  export let createPairingCode: (() => Promise<PairingCode>) | undefined = undefined;

  let pairingCode: PairingCode | null = null;
  let pairingLoading = false;
  let pairingError = '';
  let pairingCopied = false;
  let now = Date.now();
  let clock: number | undefined;

  onDestroy(() => window.clearInterval(clock));

  const dispatch = createEventDispatcher<{
    close: void;
    sortchange: SortMode;
    semanticchange: boolean;
    disconnect: void;
    themechange: 'system' | 'notesflash' | 'notesflash-dark';
  }>();

  function setSort(event: Event): void {
    dispatch('sortchange', (event.currentTarget as HTMLSelectElement).value as SortMode);
  }

  async function generatePairingCode(): Promise<void> {
    if (!createPairingCode || pairingLoading) return;
    pairingLoading = true;
    pairingError = '';
    pairingCopied = false;
    try {
      pairingCode = await createPairingCode();
      now = Date.now();
      window.clearInterval(clock);
      clock = window.setInterval(() => {
        now = Date.now();
        if (pairingCode && pairingCode.expiresAt <= now) window.clearInterval(clock);
      }, 1000);
    } catch (error) {
      pairingError = error instanceof Error ? error.message : '无法生成配对码，请稍后重试。';
    } finally {
      pairingLoading = false;
    }
  }

  async function copyPairingCode(): Promise<void> {
    pairingCopied = pairingCode ? await copyText(pairingCode.code) : false;
  }

  function formatExpiry(expiresAt: number): string {
    const remainingSeconds = Math.max(0, Math.ceil((expiresAt - now) / 1000));
    if (remainingSeconds === 0) return '已过期，请重新生成';
    const minutes = Math.floor(remainingSeconds / 60);
    const seconds = remainingSeconds % 60;
    return `${minutes}:${String(seconds).padStart(2, '0')} 后过期`;
  }

  $: pairingExpired = pairingCode !== null && pairingCode.expiresAt <= now;
</script>

{#if open}
  <div class="fixed inset-0 z-40 bg-neutral/25 backdrop-blur-[2px]" role="presentation" on:click={() => dispatch('close')}></div>
  <aside
    class="surface fixed bottom-0 left-1/2 z-50 max-h-[88vh] w-full max-w-xl -translate-x-1/2 overflow-y-auto rounded-t-box p-5 shadow-2xl sm:bottom-auto sm:top-1/2 sm:-translate-y-1/2 sm:rounded-box"
    aria-label="设置"
  >
    <header class="mb-5 flex items-center justify-between">
      <div>
        <h2 class="text-lg font-semibold">设置</h2>
        <p class="text-xs text-base-content/45">尽量保持简单，只控制检索和显示顺序。</p>
      </div>
      <button class="btn btn-ghost btn-circle btn-sm" aria-label="关闭设置" on:click={() => dispatch('close')}>
        <X size={17} />
      </button>
    </header>

    <div class="space-y-1">
      <label class="flex items-center gap-3 rounded-box px-3 py-3 hover:bg-base-200/60">
        <Command size={18} class="text-base-content/45" />
        <span class="min-w-0 flex-1">
          <span class="block text-sm font-medium">笔记排序</span>
          <span class="block text-xs text-base-content/45">影响无搜索词时的平铺顺序</span>
        </span>
        <select class="select select-bordered select-sm" value={sortMode} on:change={setSort}>
          <option value="updated_desc">最近修改</option>
          <option value="created_desc">最近创建</option>
          <option value="title_asc">标题</option>
        </select>
      </label>

      <label class="flex cursor-pointer items-center gap-3 rounded-box px-3 py-3 hover:bg-base-200/60">
        <Sparkles size={18} class="text-primary/70" />
        <span class="min-w-0 flex-1">
          <span class="block text-sm font-medium">语义搜索</span>
          <span class="block text-xs text-base-content/45">关键词结果不足时，使用余弦相似度补充</span>
        </span>
        <input
          type="checkbox"
          class="toggle toggle-primary toggle-sm"
          checked={semanticEnabled}
          on:change={(event) => dispatch('semanticchange', (event.currentTarget as HTMLInputElement).checked)}
        />
      </label>

      <div class="flex items-center gap-3 rounded-box px-3 py-3">
        <Moon size={18} class="text-base-content/45" />
        <span class="min-w-0 flex-1">
          <span class="block text-sm font-medium">外观</span>
          <span class="block text-xs text-base-content/45">跟随设备，或固定为浅色 / 深色</span>
        </span>
        <div class="join">
          <button class="btn btn-sm join-item" on:click={() => dispatch('themechange', 'system')}>自动</button>
          <button class="btn btn-sm join-item" on:click={() => dispatch('themechange', 'notesflash')}>浅色</button>
          <button class="btn btn-sm join-item" on:click={() => dispatch('themechange', 'notesflash-dark')}>深色</button>
        </div>
      </div>
    </div>

    <div class="divider my-4"></div>

    <div class="rounded-box bg-base-200/55 p-3">
      <div class="flex items-center gap-2 text-xs font-medium">
        <Cloud size={14} /> {demoMode ? '演示模式' : 'Cloudflare 已连接'}
      </div>
      <p class="mt-1 break-all text-[11px] leading-5 text-base-content/45">
        {demoMode ? '所有内容仅保存在当前页面内存，刷新后消失。' : endpoint}
      </p>
    </div>

    {#if !demoMode && createPairingCode}
      <section class="mt-3 rounded-box border border-base-300/70 p-3" aria-labelledby="pairing-code-title">
        <div class="flex items-start gap-3">
          <KeyRound size={17} class="mt-0.5 shrink-0 text-primary/75" />
          <div class="min-w-0 flex-1">
            <h3 id="pairing-code-title" class="text-sm font-medium">连接另一台设备</h3>
            <p class="mt-0.5 text-xs leading-5 text-base-content/48">
              生成一个短期、仅可使用一次的配对码。在新设备上填写当前 Worker 地址和这个码即可连接。
            </p>
          </div>
        </div>

        {#if pairingCode && !pairingExpired}
          <div class="mt-3 rounded-box bg-base-200/70 p-3" aria-live="polite">
            <div class="flex flex-col gap-2 sm:flex-row sm:items-center">
              <code class="min-w-0 flex-1 select-all text-center text-lg font-semibold tracking-[0.16em] sm:text-left">
                {pairingCode.code}
              </code>
              <button class="btn btn-primary btn-sm gap-1.5" type="button" on:click={copyPairingCode}>
                {#if pairingCopied}<Check size={15} /> 已复制{:else}<Copy size={15} /> 复制{/if}
              </button>
            </div>
            <p class="mt-2 text-[11px] text-base-content/45">
              {formatExpiry(pairingCode.expiresAt)} · 使用后立即失效，请勿发送给其他人
            </p>
          </div>
        {:else}
          {#if pairingCode && pairingExpired}
            <p class="mt-3 text-xs text-warning" aria-live="polite">这个配对码已经过期。</p>
          {/if}
          <button
            class="btn btn-outline btn-sm mt-3 w-full gap-2"
            type="button"
            disabled={pairingLoading}
            on:click={generatePairingCode}
          >
            {#if pairingLoading}<LoaderCircle size={15} class="animate-spin" />{:else}<KeyRound size={15} />{/if}
            {pairingCode ? '重新生成配对码' : '生成新设备配对码'}
          </button>
        {/if}

        {#if pairingError}
          <div class="alert alert-error mt-3 min-h-0 py-2 text-xs" role="alert">
            <span>{pairingError}</span>
          </div>
        {/if}
      </section>
    {/if}

    <button class="btn btn-ghost mt-4 w-full gap-2 text-error" on:click={() => dispatch('disconnect')}>
      <LogOut size={16} />
      {demoMode ? '退出演示模式' : '断开这个设备'}
    </button>
  </aside>
{/if}
