<script lang="ts">
  import { Trash2 } from '@lucide/svelte';
  import { createEventDispatcher, onDestroy, onMount } from 'svelte';

  export let label = '删除笔记';
  export let disabled = false;

  const REVEAL_WIDTH = 72;
  const dispatch = createEventDispatcher<{ delete: void }>();

  let rootElement: HTMLDivElement;
  let offset = 0;
  let revealed = false;
  let interacting = false;
  let pointerId: number | null = null;
  let startX = 0;
  let startY = 0;
  let startOffset = 0;
  let horizontalGesture = false;
  let suppressClick = false;
  let wheelTimer: number | undefined;

  function clampOffset(value: number): number {
    return Math.max(-REVEAL_WIDTH, Math.min(0, value));
  }

  function settle(open: boolean): void {
    interacting = false;
    revealed = open;
    offset = open ? -REVEAL_WIDTH : 0;
  }

  function close(): void {
    settle(false);
  }

  function handleWheel(event: WheelEvent): void {
    if (disabled) return;
    const horizontal = Math.abs(event.deltaX);
    const vertical = Math.abs(event.deltaY);
    if (horizontal < 2 || horizontal <= vertical * 1.08) return;

    event.preventDefault();
    interacting = true;
    offset = clampOffset(offset - event.deltaX);
    window.clearTimeout(wheelTimer);
    wheelTimer = window.setTimeout(() => settle(offset < -REVEAL_WIDTH * 0.38), 90);
  }

  function handlePointerDown(event: PointerEvent): void {
    if (disabled || event.button !== 0) return;
    const target = event.target as Element;
    const interactive = target.closest('button, a, input, textarea, select, [role="button"], [contenteditable="true"]');
    if (event.pointerType === 'mouse' && interactive) return;

    pointerId = event.pointerId;
    startX = event.clientX;
    startY = event.clientY;
    startOffset = offset;
    horizontalGesture = false;
  }

  function handlePointerMove(event: PointerEvent): void {
    if (pointerId !== event.pointerId) return;
    const deltaX = event.clientX - startX;
    const deltaY = event.clientY - startY;

    if (!horizontalGesture) {
      if (Math.abs(deltaX) < 6 && Math.abs(deltaY) < 6) return;
      if (Math.abs(deltaX) <= Math.abs(deltaY) * 1.12) {
        releasePointer(event.pointerId);
        return;
      }
      horizontalGesture = true;
      interacting = true;
      suppressClick = true;
      rootElement.setPointerCapture(event.pointerId);
    }

    if (event.cancelable) event.preventDefault();
    offset = clampOffset(startOffset + deltaX);
  }

  function handlePointerEnd(event: PointerEvent): void {
    if (pointerId !== event.pointerId) return;
    const shouldOpen = horizontalGesture
      ? offset < -REVEAL_WIDTH * 0.38
      : revealed;
    releasePointer(event.pointerId);
    settle(shouldOpen);
    if (suppressClick) window.setTimeout(() => (suppressClick = false), 0);
  }

  function releasePointer(id: number): void {
    if (rootElement?.hasPointerCapture(id)) rootElement.releasePointerCapture(id);
    pointerId = null;
  }

  function handleClickCapture(event: MouseEvent): void {
    if (!suppressClick) return;
    event.preventDefault();
    event.stopPropagation();
  }

  function handleRootKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && revealed) close();
  }

  function requestDelete(): void {
    if (disabled) return;
    dispatch('delete');
  }

  function swipeGestures(node: HTMLDivElement) {
    node.addEventListener('wheel', handleWheel, { passive: false });
    node.addEventListener('pointerdown', handlePointerDown);
    node.addEventListener('pointermove', handlePointerMove);
    node.addEventListener('pointerup', handlePointerEnd);
    node.addEventListener('pointercancel', handlePointerEnd);
    node.addEventListener('click', handleClickCapture, true);
    node.addEventListener('keydown', handleRootKeydown);

    return {
      destroy() {
        node.removeEventListener('wheel', handleWheel);
        node.removeEventListener('pointerdown', handlePointerDown);
        node.removeEventListener('pointermove', handlePointerMove);
        node.removeEventListener('pointerup', handlePointerEnd);
        node.removeEventListener('pointercancel', handlePointerEnd);
        node.removeEventListener('click', handleClickCapture, true);
        node.removeEventListener('keydown', handleRootKeydown);
      }
    };
  }

  onMount(() => {
    const handleOutsidePointer = (event: PointerEvent) => {
      if (!revealed || rootElement.contains(event.target as Node)) return;
      close();
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && revealed) close();
    };

    document.addEventListener('pointerdown', handleOutsidePointer);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('pointerdown', handleOutsidePointer);
      document.removeEventListener('keydown', handleEscape);
    };
  });

  onDestroy(() => window.clearTimeout(wheelTimer));
</script>

<div
  bind:this={rootElement}
  class="swipe-shell"
  class:is-revealed={revealed}
  class:is-interacting={interacting}
  style={`--swipe-offset: ${offset}px`}
  role="group"
  aria-label="可向左滑动显示删除操作的笔记卡片"
  use:swipeGestures
>
  <div class="delete-rail" aria-hidden={!revealed}>
    <button
      type="button"
      class="delete-action"
      aria-label={label}
      title={label}
      tabindex={revealed ? 0 : -1}
      disabled={disabled}
      on:click|stopPropagation={requestDelete}
    >
      <Trash2 size={19} strokeWidth={1.9} />
    </button>
  </div>

  <div class="swipe-content">
    <slot></slot>
  </div>
</div>

<style>
  .swipe-shell {
    position: relative;
    min-width: 0;
    border-radius: calc(var(--radius-box) * 0.72);
    touch-action: pan-y;
  }

  .swipe-content {
    position: relative;
    z-index: 2;
    min-width: 0;
    transform: translate3d(var(--swipe-offset), 0, 0);
    transition: transform 190ms cubic-bezier(0.2, 0.8, 0.2, 1);
    will-change: transform;
  }

  .swipe-shell.is-interacting .swipe-content {
    transition: none;
  }

  .delete-rail {
    position: absolute;
    inset-block: 0;
    inset-inline-end: 0;
    z-index: 1;
    display: flex;
    width: 72px;
    align-items: center;
    justify-content: center;
    border-radius: 0 calc(var(--radius-box) * 0.72) calc(var(--radius-box) * 0.72) 0;
    background: color-mix(in oklab, var(--color-error) 10%, var(--color-base-100));
    opacity: 0;
    pointer-events: none;
    transition: opacity 130ms ease;
  }

  .swipe-shell.is-revealed .delete-rail,
  .swipe-shell.is-interacting .delete-rail {
    opacity: 1;
  }

  .swipe-shell.is-revealed .delete-rail {
    pointer-events: auto;
  }

  .delete-action {
    display: inline-flex;
    width: 42px;
    height: 42px;
    align-items: center;
    justify-content: center;
    border: 1px solid color-mix(in oklab, var(--color-error) 20%, transparent);
    border-radius: 0.7rem;
    background: color-mix(in oklab, var(--color-error) 12%, var(--color-base-100));
    color: var(--color-error);
    cursor: pointer;
    box-shadow:
      inset 0 1px 0 color-mix(in oklab, white 34%, transparent),
      0 4px 12px color-mix(in oklab, var(--color-error) 10%, transparent);
    transition:
      transform 130ms ease,
      color 130ms ease,
      background-color 130ms ease;
  }

  .delete-action:hover,
  .delete-action:focus-visible {
    transform: scale(1.04);
    background: var(--color-error);
    color: var(--color-error-content);
    outline: none;
  }

  .delete-action:active {
    transform: scale(0.96);
  }

  .delete-action:disabled {
    cursor: default;
    opacity: 0.45;
  }

  @media (prefers-reduced-motion: reduce) {
    .swipe-content,
    .delete-rail,
    .delete-action {
      transition: none;
    }
  }
</style>
