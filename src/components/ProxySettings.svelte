<script lang="ts">
  import { Check, Network, Save } from '@lucide/svelte';
  import { createEventDispatcher } from 'svelte';
  import {
    getDesktopNetworkSnapshot,
    isDesktopRuntime,
    saveDesktopProxyUrl,
    type DesktopNetworkSnapshot
  } from '../lib/network-settings';

  export let expanded = false;
  export let className = '';

  const desktop = isDesktopRuntime();
  const initial = getDesktopNetworkSnapshot();
  let proxyDraft = initial.proxyUrl;
  let savedProxyUrl = initial.proxyUrl;
  let errorMessage = '';
  let savedMessage = '';

  const dispatch = createEventDispatcher<{
    change: DesktopNetworkSnapshot;
  }>();

  export function commit(): DesktopNetworkSnapshot {
    errorMessage = '';
    savedMessage = '';
    try {
      const snapshot = saveDesktopProxyUrl(proxyDraft);
      proxyDraft = snapshot.proxyUrl;
      savedProxyUrl = snapshot.proxyUrl;
      savedMessage = snapshot.mode === 'manual' ? '代理已保存在这台 Mac。' : '已恢复为跟随系统网络。';
      dispatch('change', snapshot);
      return snapshot;
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : '无法保存代理设置。';
      expanded = true;
      throw error;
    }
  }

  function handleProxyKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Enter' || event.isComposing) return;
    event.preventDefault();
    try {
      commit();
    } catch {
      // The inline validation message is more useful than an unhandled event.
    }
  }

  function restoreSystemNetwork(): void {
    proxyDraft = '';
    try {
      commit();
    } catch {
      // commit already exposes the persistence error next to the field.
    }
  }

  $: dirty = proxyDraft.trim() !== savedProxyUrl;
</script>

{#if desktop}
  <details class={`rounded-box border border-base-300/70 bg-base-100/35 ${className}`} bind:open={expanded}>
    <summary class="flex cursor-pointer list-none items-center gap-2.5 px-3 py-2.5 text-xs font-medium marker:hidden">
      <Network size={15} class="shrink-0 text-base-content/48" />
      <span class="min-w-0 flex-1">本地代理（可选）</span>
      <span class="text-[11px] font-normal text-base-content/38">
        {savedProxyUrl ? '已配置' : '跟随系统'}
      </span>
    </summary>

    <div class="border-t border-base-300/60 px-3 pb-3 pt-2.5">
      <p class="text-[11px] leading-5 text-base-content/48">
        Chrome 能访问但桌面端不能时，可填写 Clash、Surge 等工具的本地监听地址。配置只保存在这台 Mac，不会上传到 Cloudflare。
      </p>

      <label class="mt-2 block" for="notesflash-local-proxy">
        <span class="text-[11px] font-medium text-base-content/55">代理地址</span>
        <input
          id="notesflash-local-proxy"
          class="input input-bordered input-sm mt-1 w-full bg-base-100 font-mono text-xs"
          bind:value={proxyDraft}
          placeholder="127.0.0.1:7890"
          inputmode="url"
          autocomplete="off"
          spellcheck="false"
          on:input={() => {
            errorMessage = '';
            savedMessage = '';
          }}
          on:keydown={handleProxyKeydown}
        />
      </label>

      <p class="mt-1.5 text-[10px] leading-4 text-base-content/38">
        未写协议时默认 http://。支持 http、https、socks5、socks5h；仅允许本机回环地址，PAC 暂不支持。
      </p>

      {#if errorMessage}
        <p class="mt-2 text-xs text-error" role="alert">{errorMessage}</p>
      {:else if savedMessage}
        <p class="mt-2 flex items-center gap-1 text-xs text-success" aria-live="polite">
          <Check size={12} />
          {savedMessage}
        </p>
      {/if}

      <div class="mt-2.5 flex justify-end gap-2">
        {#if savedProxyUrl}
          <button class="btn btn-ghost btn-xs" type="button" on:click={restoreSystemNetwork}>
            恢复系统网络
          </button>
        {/if}
        <button class="btn btn-outline btn-xs gap-1.5" type="button" disabled={!dirty} on:click={() => {
          try {
            commit();
          } catch {
            // commit already exposes the validation error.
          }
        }}>
          <Save size={12} />
          保存代理
        </button>
      </div>
    </div>
  </details>
{/if}
