<script lang="ts">
  import { AlertTriangle, Check, LoaderCircle, Trash2, X } from '@lucide/svelte';
  import { onMount } from 'svelte';
  import {
    contentImages,
    parseNoteContent,
    serializeNoteContent,
    type NoteContentBlock
  } from '../lib/note-content';
  import type { ImageAsset, Note, UpdateNoteInput } from '../lib/types';

  export let note: Note;
  export let saveNote: (id: string, input: UpdateNoteInput) => Promise<Note>;
  export let deleteNote: (note: Note) => Promise<void>;
  export let uploadImage: (file: File) => Promise<ImageAsset>;
  export let close: () => void;

  let title = note.title;
  let blocks = parseNoteContent(note.body, note.images);
  let currentVersion = note.version;
  let activeId = note.id;
  let status: 'saved' | 'dirty' | 'saving' | 'error' = 'saved';
  let errorMessage = '';
  let uploading = false;
  let saveTimer: number | undefined;
  let editRevision = 0;
  let savePromise: Promise<boolean> | null = null;
  let editorElement: HTMLElement;

  $: if (note.id !== activeId) reset(note);

  onMount(() => {
    focusBody();

    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      if (status === 'saved') return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warnBeforeUnload);

    return () => {
      window.clearTimeout(saveTimer);
      window.removeEventListener('beforeunload', warnBeforeUnload);
    };
  });

  function reset(next: Note): void {
    activeId = next.id;
    title = next.title;
    blocks = parseNoteContent(next.body, next.images);
    currentVersion = next.version;
    editRevision = 0;
    savePromise = null;
    status = 'saved';
    errorMessage = '';
  }

  function markDirty(): void {
    editRevision += 1;
    status = 'dirty';
    errorMessage = '';
    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => void persist(), 650);
  }

  export async function flush(): Promise<boolean> {
    return persist();
  }

  export function focusBody(): void {
    window.setTimeout(() => {
      const firstTextarea = editorElement?.querySelector<HTMLTextAreaElement>('textarea[data-note-body]');
      firstTextarea?.focus({ preventScroll: true });
    }, 0);
  }

  async function persist(): Promise<boolean> {
    window.clearTimeout(saveTimer);
    if (savePromise) {
      const succeeded = await savePromise;
      if (!succeeded) return false;
      return status === 'dirty' ? persist() : status === 'saved';
    }

    if (status === 'saved') return true;

    const savingRevision = editRevision;
    const images = contentImages(blocks);
    const input: UpdateNoteInput = {
      baseVersion: currentVersion,
      title: title.trim() || '无标题',
      body: serializeNoteContent(blocks),
      imageIds: images.map((image) => image.id)
    };
    status = 'saving';

    const operation = (async (): Promise<boolean> => {
      try {
        const updated = await saveNote(note.id, input);
        currentVersion = updated.version;
        if (editRevision === savingRevision) status = 'saved';
        else status = 'dirty';
        return true;
      } catch (error) {
        status = 'error';
        errorMessage = error instanceof Error ? error.message : '保存失败';
        return false;
      }
    })();
    savePromise = operation;

    const succeeded = await operation;
    if (savePromise === operation) savePromise = null;
    if (!succeeded) return false;
    return editRevision !== savingRevision ? persist() : true;
  }

  function updateText(blockKey: string, event: Event): void {
    const textarea = event.currentTarget as HTMLTextAreaElement;
    blocks = blocks.map((block) =>
      block.key === blockKey && block.type === 'text'
        ? { ...block, text: textarea.value }
        : block
    );
    markDirty();
  }

  async function pasteImages(event: ClipboardEvent, blockKey: string): Promise<void> {
    const files = clipboardImageFiles(event.clipboardData);
    if (files.length === 0) return;

    event.preventDefault();
    const textarea = event.currentTarget as HTMLTextAreaElement;
    const blockIndex = blocks.findIndex((block) => block.key === blockKey && block.type === 'text');
    const block = blocks[blockIndex];
    if (blockIndex < 0 || !block || block.type !== 'text') return;

    const selectionStart = textarea.selectionStart ?? block.text.length;
    const selectionEnd = textarea.selectionEnd ?? selectionStart;
    const before = block.text.slice(0, selectionStart);
    const after = block.text.slice(selectionEnd);
    uploading = true;
    errorMessage = '';

    try {
      const uploaded: ImageAsset[] = [];
      for (const file of files) uploaded.push(await uploadImage(file));

      const inserted: NoteContentBlock[] = [
        { key: crypto.randomUUID(), type: 'text', text: before }
      ];
      for (const image of uploaded) {
        inserted.push({ key: crypto.randomUUID(), type: 'image', image });
        inserted.push({ key: crypto.randomUUID(), type: 'text', text: '' });
      }
      const trailing = inserted[inserted.length - 1];
      if (trailing.type === 'text') trailing.text = after;

      blocks = [...blocks.slice(0, blockIndex), ...inserted, ...blocks.slice(blockIndex + 1)];
      markDirty();
      const trailingKey = trailing.key;
      window.setTimeout(() => {
        const next = editorElement?.querySelector<HTMLTextAreaElement>(`textarea[data-block-key="${trailingKey}"]`);
        next?.focus({ preventScroll: true });
        next?.setSelectionRange(0, 0);
      }, 0);
    } catch (error) {
      status = 'error';
      errorMessage = error instanceof Error ? error.message : '图片上传失败';
    } finally {
      uploading = false;
    }
  }

  function removeImage(blockKey: string): void {
    const index = blocks.findIndex((block) => block.key === blockKey && block.type === 'image');
    if (index < 0) return;

    const previous = blocks[index - 1];
    const next = blocks[index + 1];
    if (previous?.type === 'text' && next?.type === 'text') {
      const separator = previous.text && next.text ? '\n' : '';
      const merged: NoteContentBlock = {
        key: previous.key,
        type: 'text',
        text: `${previous.text}${separator}${next.text}`
      };
      blocks = [...blocks.slice(0, index - 1), merged, ...blocks.slice(index + 2)];
    } else {
      blocks = blocks.filter((block) => block.key !== blockKey);
    }
    markDirty();
  }

  async function requestDelete(): Promise<void> {
    if (!window.confirm(`确定删除“${title || '无标题'}”吗？`)) return;
    try {
      await deleteNote({
        ...note,
        title,
        body: serializeNoteContent(blocks),
        images: contentImages(blocks),
        version: currentVersion
      });
    } catch (error) {
      status = 'error';
      errorMessage = error instanceof Error ? error.message : '删除失败';
    }
  }

  function clipboardImageFiles(data: DataTransfer | null): File[] {
    if (!data) return [];
    const fromItems = [...data.items]
      .filter((item) => item.kind === 'file' && item.type.startsWith('image/'))
      .map((item) => item.getAsFile())
      .filter((file): file is File => Boolean(file));
    if (fromItems.length > 0) return fromItems;
    return [...data.files].filter((file) => file.type.startsWith('image/'));
  }

  async function closeEditor(): Promise<void> {
    if (await persist()) close();
  }

  function handleEditorKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    void closeEditor();
  }
</script>

<section bind:this={editorElement} class="note-editor relative scroll-mt-24 px-3 py-4 sm:px-4">
  <button
    type="button"
    class="btn btn-ghost btn-xs absolute right-3 top-4 z-10 gap-1 text-error/75 sm:right-4"
    on:click={requestDelete}
  >
    <Trash2 size={13} /> 删除
  </button>

  <header class="mb-2 flex items-start gap-3 pr-14">
    <div class="min-w-0 flex-1">
      <input
        class="note-title-input block w-full bg-transparent text-[15px] font-semibold leading-6 tracking-[-0.01em] outline-none placeholder:text-base-content/35"
        bind:value={title}
        placeholder="标题"
        aria-label="笔记标题"
        on:input={markDirty}
        on:keydown={handleEditorKeydown}
      />
      <div class="mt-1 flex items-center gap-2 text-[11px] text-base-content/42">
        {#if status === 'saving' || uploading}
          <span class="inline-flex items-center gap-1"><LoaderCircle size={12} class="animate-spin" /> {uploading ? '正在粘贴图片' : '保存中'}</span>
        {:else if status === 'error'}
          <span class="inline-flex items-center gap-1 text-error"><AlertTriangle size={12} /> 保存失败</span>
        {:else}
          <span class="inline-flex items-center gap-1"><Check size={12} /> 已自动保存</span>
        {/if}
      </div>
    </div>
  </header>

  <div class="text-[14px] leading-7 text-base-content/78">
    {#each blocks as block (block.key)}
      {#if block.type === 'text'}
        <textarea
          data-note-body
          data-block-key={block.key}
          value={block.text}
          class="note-body-input block min-h-6 w-full resize-none overflow-hidden border-0 bg-transparent p-0 text-[14px] leading-[1.68] outline-none placeholder:text-base-content/30 focus:outline-none"
          placeholder={blocks.length === 1 ? '写下正文，可直接粘贴图片…' : ''}
          aria-label="笔记正文"
          readonly={uploading}
          on:input={(event) => updateText(block.key, event)}
          on:paste={(event) => void pasteImages(event, block.key)}
          on:keydown={handleEditorKeydown}
        ></textarea>
      {:else}
        <div class="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          <figure class="group relative overflow-hidden rounded-box border border-base-300 bg-base-200">
            <img
              src={block.image.url}
              alt={block.image.name}
              class="aspect-[4/3] h-full w-full object-cover"
            />
            <button
              type="button"
              class="btn btn-circle btn-xs absolute right-2 top-2 border-0 bg-base-100/90 opacity-70 shadow-sm transition hover:opacity-100"
              aria-label={`移除图片 ${block.image.name}`}
              on:click={() => removeImage(block.key)}
            >
              <X size={13} />
            </button>
          </figure>
        </div>
      {/if}
    {/each}
  </div>

  {#if errorMessage}
    <p class="mt-3 rounded-lg bg-error/10 px-3 py-2 text-xs text-error">{errorMessage}</p>
  {/if}

</section>

<style>
  .note-title-input,
  .note-body-input {
    font-family: inherit;
    color: inherit;
  }

  .note-title-input {
    font-size: 15px;
    font-weight: 600;
    line-height: 24px;
    letter-spacing: -0.01em;
  }

  .note-body-input {
    field-sizing: content;
    font-size: 14px;
    font-weight: 400;
    line-height: 24px;
    min-height: 24px;
  }
</style>
