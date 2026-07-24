<script lang="ts">
  import { X } from '@lucide/svelte';
  import type { ImageAsset } from '../lib/types';

  export let images: ImageAsset[] = [];
  let active: ImageAsset | null = null;

  function portal(node: HTMLElement) {
    document.body.appendChild(node);

    return {
      destroy() {
        node.remove();
      }
    };
  }
</script>

{#if images.length > 0}
  <div class="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
    {#each images as image}
      <button
        type="button"
        class="group relative overflow-hidden rounded-box border border-base-300 bg-base-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        aria-label={`查看图片 ${image.name}`}
        on:click={() => (active = image)}
      >
        <img
          src={image.url}
          alt={image.name}
          class="aspect-[4/3] h-full w-full object-cover transition duration-150 group-hover:scale-[1.02]"
          loading="lazy"
        />
      </button>
    {/each}
  </div>
{/if}

{#if active}
  <div
    use:portal
    class="nf-overlay-in fixed inset-0 z-[80] flex items-center justify-center bg-neutral/80 p-4 backdrop-blur-sm"
    role="presentation"
    on:click={() => (active = null)}
    on:keydown={(event) => event.key === 'Escape' && (active = null)}
  >
    <button
      type="button"
      class="btn btn-circle btn-sm absolute right-4 top-[calc(1rem+var(--safe-top))] border-0 bg-base-100/90"
      aria-label="关闭图片"
      on:click={() => (active = null)}
    >
      <X size={17} />
    </button>
    <button type="button" class="max-h-[88vh] max-w-full" aria-label="保持查看图片" on:click|stopPropagation>
      <img
        src={active.url}
        alt={active.name}
        class="max-h-[88vh] max-w-full rounded-box object-contain shadow-2xl"
      />
    </button>
  </div>
{/if}
