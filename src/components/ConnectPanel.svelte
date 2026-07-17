<script lang="ts">
  import { Cloud, ExternalLink, FlaskConical, LoaderCircle, MonitorSmartphone } from '@lucide/svelte';
  import { createEventDispatcher } from 'svelte';
  import { ApiError, pairDevice } from '../lib/api';
  import type { ConnectionProfile } from '../lib/types';

  const dispatch = createEventDispatcher<{
    connected: ConnectionProfile;
    demo: void;
  }>();

  const deployUrl =
    'https://deploy.workers.cloudflare.com/?url=https://github.com/realllllty/notesflash/tree/main/cloud';

  let endpoint = defaultEndpoint();
  let code = '';
  let deviceName = defaultDeviceName();
  let connecting = false;
  let errorMessage = '';

  async function connect(): Promise<void> {
    connecting = true;
    errorMessage = '';
    try {
      dispatch('connected', await pairDevice(endpoint, code, deviceName));
    } catch (error) {
      errorMessage = error instanceof ApiError || error instanceof Error ? error.message : '连接失败';
    } finally {
      connecting = false;
    }
  }

  function defaultDeviceName(): string {
    if ('__TAURI_INTERNALS__' in window) return 'NotesFlash Mac';
    const platform = navigator.userAgent.includes('Mac')
      ? 'Mac'
      : navigator.userAgent.includes('iPhone')
        ? 'iPhone'
        : '浏览器';
    return `NotesFlash ${platform}`;
  }

  function defaultEndpoint(): string {
    if ('__TAURI_INTERNALS__' in window) return '';
    return /^https?:$/.test(window.location.protocol) ? window.location.origin : '';
  }

  $: setupUrl = /^https?:\/\//i.test(endpoint.trim())
    ? `${endpoint.trim().replace(/\/+$/, '')}/setup`
    : '';
</script>

<main class="app-shell flex items-center justify-center py-8">
  <section class="surface w-full max-w-lg rounded-box p-5 shadow-sm sm:p-7">
    <div class="mb-6 flex items-start gap-4">
      <div class="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-content">
        <MonitorSmartphone size={23} />
      </div>
      <div>
        <h1 class="text-xl font-semibold tracking-[-0.02em]">连接你的 NotesFlash Cloud</h1>
        <p class="mt-1 text-sm leading-6 text-base-content/58">
          笔记保存在你自己的 Cloudflare。这个设备只保存连接信息，不缓存正文。
        </p>
      </div>
    </div>

    <a class="btn btn-outline mb-5 w-full gap-2" href={deployUrl} target="_blank" rel="noreferrer">
      <Cloud size={17} />
      一键部署到 Cloudflare
      <ExternalLink size={14} class="opacity-55" />
    </a>

    <div class="rounded-box bg-base-200/55 p-3 text-xs leading-5 text-base-content/58">
      <p class="font-medium text-base-content/75">配对码从哪里获取？</p>
      <p class="mt-1">
        第一次部署后打开 Worker 的 <span class="font-mono">/setup</span>，点击初始化即可直接看到首个一次性配对码，不需要填写额外的环境变量。
      </p>
      <p class="mt-1">
        以后添加设备，请在任意已连接设备的「设置」中生成新码；初始化完成后，匿名网页不能再次发码。
      </p>
    </div>

    <div class="divider my-4 text-[11px] text-base-content/35">填写地址与配对码</div>

    {#if setupUrl}
      <a class="btn btn-ghost btn-sm mb-3 w-full gap-2" href={setupUrl} target="_blank" rel="noreferrer">
        首次部署：打开一次性初始化页面
        <ExternalLink size={13} class="opacity-55" />
      </a>
    {/if}

    <form on:submit|preventDefault={connect} class="space-y-3">
      <label class="form-control block">
        <span class="label pb-1.5 text-xs text-base-content/60">Worker 地址</span>
        <input
          class="input input-bordered w-full bg-base-100"
          bind:value={endpoint}
          placeholder="https://notesflash-example.workers.dev"
          inputmode="url"
          autocomplete="url"
          required
        />
      </label>

      <div class="grid gap-3 sm:grid-cols-2">
        <label class="form-control block">
          <span class="label pb-1.5 text-xs text-base-content/60">一次性配对码</span>
          <input
            class="input input-bordered w-full bg-base-100 font-mono uppercase tracking-widest"
            bind:value={code}
            placeholder="ABCD-1234"
            autocomplete="one-time-code"
            required
          />
        </label>

        <label class="form-control block">
          <span class="label pb-1.5 text-xs text-base-content/60">设备名称</span>
          <input class="input input-bordered w-full bg-base-100" bind:value={deviceName} required />
        </label>
      </div>

      {#if errorMessage}
        <div class="alert alert-error py-2 text-sm" role="alert">
          <span>{errorMessage}</span>
        </div>
      {/if}

      <button class="btn btn-primary mt-2 w-full" type="submit" disabled={connecting}>
        {#if connecting}<LoaderCircle size={17} class="animate-spin" />{/if}
        连接这个设备
      </button>
    </form>

    <button
      type="button"
      class="btn btn-ghost mt-3 w-full gap-2 text-base-content/55"
      on:click={() => dispatch('demo')}
    >
      <FlaskConical size={16} />
      先使用不落盘的演示模式
    </button>
  </section>
</main>
