<script lang="ts">
  import { Cloud, Command, LogOut, Moon, Sparkles, X } from '@lucide/svelte';
  import { createEventDispatcher } from 'svelte';
  import type { SortMode } from '../lib/types';

  export let open = false;
  export let sortMode: SortMode = 'updated_desc';
  export let semanticEnabled = true;
  export let demoMode = false;
  export let endpoint = '';

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

    <button class="btn btn-ghost mt-4 w-full gap-2 text-error" on:click={() => dispatch('disconnect')}>
      <LogOut size={16} />
      {demoMode ? '退出演示模式' : '断开这个设备'}
    </button>
  </aside>
{/if}
