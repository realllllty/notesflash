<script lang="ts">
  import { AlertTriangle, Check, LoaderCircle, Trash2, X } from '@lucide/svelte';
  import { createEventDispatcher, onMount } from 'svelte';
  import {
    contentImages,
    ensureEditableTextBlocks,
    nearestTextPositionForRawLine,
    numberNoteContentBlocks,
    parseNoteContent,
    serializeNoteContent,
    splitTextForBlockInsertion,
    type NoteContentBlock
  } from '../lib/note-content';
  import { isImeComposing } from '../lib/text';
  import type { ImageAsset, Note, UpdateNoteInput } from '../lib/types';

  export let note: Note;
  export let saveNote: (id: string, input: UpdateNoteInput) => Promise<Note>;
  export let deleteNote: (note: Note) => Promise<void>;
  export let uploadImage: (file: File) => Promise<ImageAsset>;
  export let close: () => void;
  export let activeRawLineIndex: number | null = null;
  export let activeTitle = false;

  const dispatch = createEventDispatcher<{ contentchange: void }>();

  let title = note.title;
  let blocks = ensureEditableTextBlocks(parseNoteContent(note.body, note.images));
  let currentVersion = note.version;
  let activeId = note.id;
  let status: 'saved' | 'dirty' | 'saving' | 'error' = 'saved';
  let errorMessage = '';
  let uploading = false;
  let saveTimer: number | undefined;
  let editRevision = 0;
  let savePromise: Promise<boolean> | null = null;
  let uploadPromise: Promise<boolean> | null = null;
  let editorElement: HTMLElement;
  let titleInput: HTMLTextAreaElement;

  $: if (note.id !== activeId) reset(note);
  $: numberedBlocks = numberNoteContentBlocks(blocks);

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
    blocks = ensureEditableTextBlocks(parseNoteContent(next.body, next.images));
    currentVersion = next.version;
    editRevision = 0;
    savePromise = null;
    status = 'saved';
    errorMessage = '';
  }

  function markDirty(): void {
    dispatch('contentchange');
    editRevision += 1;
    status = 'dirty';
    errorMessage = '';
    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => void persist(), 650);
  }

  export async function flush(): Promise<boolean> {
    if (uploadPromise && !(await uploadPromise)) return false;
    return persist();
  }

  export function focusBody(): void {
    window.setTimeout(() => {
      const firstTextarea = editorElement?.querySelector<HTMLTextAreaElement>('textarea[data-note-body]');
      firstTextarea?.focus({ preventScroll: true });
    }, 0);
  }

  export function focusTitle(): void {
    window.setTimeout(() => {
      titleInput?.focus({ preventScroll: true });
      titleInput?.setSelectionRange(0, titleInput.value.length);
    }, 0);
  }

  export function focusLogicalLine(rawLineIndex: number): void {
    window.setTimeout(() => {
      const position = nearestTextPositionForRawLine(blocks, rawLineIndex);
      if (!position) {
        focusTitle();
        return;
      }

      const textarea = [...(editorElement?.querySelectorAll<HTMLTextAreaElement>('textarea[data-block-key]') ?? [])]
        .find((candidate) => candidate.dataset.blockKey === position.blockKey);
      if (!textarea) return;

      const caret = position.rawLineIndex < rawLineIndex ? position.endOffset : position.startOffset;
      textarea.focus({ preventScroll: true });
      textarea.setSelectionRange(caret, caret);
      editorElement
        ?.querySelector<HTMLElement>(`[data-body-line-index="${position.rawLineIndex}"]`)
        ?.scrollIntoView({ block: 'nearest' });
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
        ? {
            ...block,
            text: textarea.value,
            transient: block.transient && textarea.value === '' ? true : undefined
          }
        : block
    );
    markDirty();
  }

  function updateTitle(event: Event): void {
    const textarea = event.currentTarget as HTMLTextAreaElement;
    title = textarea.value.replace(/[\r\n]+/g, ' ');
    if (textarea.value !== title) textarea.value = title;
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
    const { before, after } = splitTextForBlockInsertion(
      block.text,
      selectionStart,
      selectionEnd
    );
    uploading = true;
    errorMessage = '';

    const operation = (async (): Promise<boolean> => {
      try {
        const uploaded: ImageAsset[] = [];
        for (const file of files) uploaded.push(await uploadImage(file));

        const leading: Extract<NoteContentBlock, { type: 'text' }> = {
          key: crypto.randomUUID(),
          type: 'text',
          text: before,
          transient: before === '' ? true : undefined
        };
        const trailing: Extract<NoteContentBlock, { type: 'text' }> = {
          key: crypto.randomUUID(),
          type: 'text',
          text: after,
          transient: after === '' ? true : undefined
        };
        const inserted: NoteContentBlock[] = [
          leading,
          ...uploaded.map((image) => ({
            key: crypto.randomUUID(),
            type: 'image' as const,
            image
          })),
          trailing
        ];

        blocks = ensureEditableTextBlocks([
          ...blocks.slice(0, blockIndex),
          ...inserted,
          ...blocks.slice(blockIndex + 1)
        ]);
        markDirty();
        const trailingKey = trailing.key;
        window.setTimeout(() => {
          const next = editorElement?.querySelector<HTMLTextAreaElement>(`textarea[data-block-key="${trailingKey}"]`);
          next?.focus({ preventScroll: true });
          next?.setSelectionRange(0, 0);
        }, 0);
        return true;
      } catch (error) {
        status = 'error';
        errorMessage = error instanceof Error ? error.message : '图片上传失败';
        return false;
      } finally {
        uploading = false;
      }
    })();
    uploadPromise = operation;
    await operation;
    if (uploadPromise === operation) uploadPromise = null;
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
        text: `${previous.text}${separator}${next.text}`,
        transient: previous.transient && next.transient ? true : undefined
      };
      blocks = [...blocks.slice(0, index - 1), merged, ...blocks.slice(index + 2)];
    } else {
      blocks = blocks.filter((block) => block.key !== blockKey);
    }
    if (blocks.length === 0) {
      blocks = [{ key: crypto.randomUUID(), type: 'text', text: '' }];
    }
    if (blocks.every((block) => block.type === 'text' && block.transient && block.text === '')) {
      blocks = [{ key: crypto.randomUUID(), type: 'text', text: '' }];
    } else {
      blocks = ensureEditableTextBlocks(blocks);
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
    if (await flush()) close();
  }

  function handleEditorKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    void closeEditor();
  }

  function handleTitleKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !isImeComposing(event)) {
      event.preventDefault();
      focusBody();
      return;
    }
    handleEditorKeydown(event);
  }
</script>

<section bind:this={editorElement} class="note-editor relative scroll-mt-24 px-3 py-4 sm:px-4">
  <header
    id={`note-${note.id}-title`}
    class={`note-editor-header mb-2 flex items-start gap-3 ${activeTitle ? 'current-title-match' : ''}`}
    aria-current={activeTitle ? 'true' : undefined}
  >
    <div class="min-w-0 flex-1">
      <div class="title-editor">
        <div class="title-input-mirror" aria-hidden="true">{title || '标题'}</div>
        <textarea
          bind:this={titleInput}
          class="note-title-input block w-full resize-none overflow-hidden border-0 bg-transparent p-0 outline-none placeholder:text-base-content/35"
          value={title}
          rows="1"
          wrap="soft"
          placeholder="标题"
          aria-label="笔记标题"
          on:input={updateTitle}
          on:keydown={handleTitleKeydown}
        ></textarea>
      </div>
      <div class="mt-1 flex items-center gap-2 pr-14 text-[11px] text-base-content/42">
        {#if status === 'saving' || uploading}
          <span class="inline-flex items-center gap-1"><LoaderCircle size={12} class="animate-spin" /> {uploading ? '正在粘贴图片' : '保存中'}</span>
        {:else if status === 'error'}
          <span class="inline-flex items-center gap-1 text-error"><AlertTriangle size={12} /> 保存失败</span>
        {:else}
          <span class="inline-flex items-center gap-1"><Check size={12} /> 已自动保存</span>
        {/if}
      </div>
    </div>
    <button
      type="button"
      class="btn btn-ghost btn-xs absolute bottom-0 right-0 z-10 gap-1 text-error/75"
      on:click={requestDelete}
    >
      <Trash2 size={13} /> 删除
    </button>
  </header>

  <div class="note-lines text-[14px] text-base-content/78">
    {#each numberedBlocks as numbered (numbered.block.key)}
      {#if numbered.type === 'text'}
        <div class="numbered-textarea">
          <div class="textarea-mirror" aria-hidden="true">
            {#each numbered.lines as line (line.rawLineIndex)}
              <div
                id={`note-${note.id}-line-${line.rawLineIndex}`}
                data-body-line-index={line.rawLineIndex}
                class={`note-line ${line.rawLineIndex === activeRawLineIndex ? 'current-match' : ''}`}
                aria-current={line.rawLineIndex === activeRawLineIndex ? 'true' : undefined}
              >
                <span class="note-line-number">{line.displayLineNumber}</span>
                <div class="note-line-content textarea-mirror-text">{line.text}</div>
              </div>
            {/each}
          </div>
          <textarea
            data-note-body
            data-block-key={numbered.block.key}
            value={numbered.block.text}
            class="note-body-input block resize-none overflow-hidden border-0 bg-transparent p-0 text-[14px] outline-none placeholder:text-base-content/30 focus:outline-none"
            placeholder={blocks.length === 1 ? '写下正文，可直接粘贴图片…' : ''}
            aria-label="笔记正文"
            readonly={uploading}
            wrap="soft"
            on:input={(event) => updateText(numbered.block.key, event)}
            on:paste={(event) => void pasteImages(event, numbered.block.key)}
            on:keydown={handleEditorKeydown}
          ></textarea>
        </div>
      {:else}
        <div
          id={`note-${note.id}-line-${numbered.line.rawLineIndex}`}
          data-body-line-index={numbered.line.rawLineIndex}
          class={`note-line note-image-line ${numbered.line.rawLineIndex === activeRawLineIndex ? 'current-match' : ''}`}
        >
          <span class="note-line-number" aria-hidden="true">{numbered.line.displayLineNumber}</span>
          <div class="note-line-content note-image-content">
            <div class="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <figure class="group relative overflow-hidden rounded-box border border-base-300 bg-base-200">
                <img
                  src={numbered.block.image.url}
                  alt={numbered.block.image.name}
                  class="aspect-[4/3] h-full w-full object-cover"
                />
                <button
                  type="button"
                  class="btn btn-circle btn-xs absolute right-2 top-2 border-0 bg-base-100/90 opacity-70 shadow-sm transition hover:opacity-100"
                  aria-label={`移除图片 ${numbered.block.image.name}`}
                  on:click={() => removeImage(numbered.block.key)}
                >
                  <X size={13} />
                </button>
              </figure>
            </div>
          </div>
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
    position: absolute;
    inset: 0;
    height: 100%;
    margin: 0;
    font-size: 15px;
    font-weight: 600;
    line-height: 24px;
    letter-spacing: -0.01em;
    white-space: pre-wrap;
    overflow-wrap: break-word;
    word-break: normal;
  }

  .title-editor {
    position: relative;
    min-width: 0;
    min-height: 24px;
  }

  .title-input-mirror {
    min-height: 24px;
    color: transparent;
    font-size: 15px;
    font-weight: 600;
    line-height: 24px;
    letter-spacing: -0.01em;
    white-space: pre-wrap;
    overflow-wrap: break-word;
    word-break: normal;
    pointer-events: none;
  }

  .note-body-input {
    position: absolute;
    inset-block: 0;
    inset-inline-start: 0;
    width: 100%;
    height: 100%;
    margin: 0;
    font-size: 14px;
    font-weight: 400;
    line-height: 24px;
    letter-spacing: normal;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    word-break: break-word;
    tab-size: 4;
  }

  .numbered-textarea {
    position: relative;
    min-width: 0;
    min-height: var(--note-line-height);
  }

  .textarea-mirror {
    min-width: 0;
    pointer-events: none;
  }

  .textarea-mirror-text {
    visibility: hidden;
  }

  .note-editor-header {
    position: relative;
    isolation: isolate;
    overflow: clip;
    border-radius: 0.35rem;
  }
</style>
