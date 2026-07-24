<script lang="ts">
  import { CloudOff, Command, LoaderCircle, SearchX } from '@lucide/svelte';
  import { onMount, tick } from 'svelte';
  import ConnectPanel from './components/ConnectPanel.svelte';
  import DeleteNoteDialog from './components/DeleteNoteDialog.svelte';
  import NoteCard from './components/NoteCard.svelte';
  import NoteEditor from './components/NoteEditor.svelte';
  import QuickCreateRow from './components/QuickCreateRow.svelte';
  import SearchBar from './components/SearchBar.svelte';
  import SettingsDialog from './components/SettingsDialog.svelte';
  import SwipeableNote from './components/SwipeableNote.svelte';
  import {
    ApiError,
    clearConnection,
    DemoNotesClient,
    loadConnection,
    normalizeEndpoint,
    RemoteNotesClient,
    saveConnection
  } from './lib/api';
  import { copyText } from './lib/clipboard';
  import {
    activeSearchLineTarget,
    collectSearchLineTargets,
    moveActiveMatchKey,
    retainActiveMatchKey,
    type SearchLineTarget
  } from './lib/search-lines';
  import { canCreateFromCompletedSearch } from './lib/search-state';
  import { isKeyboardOptionSelected, nextKeyboardSelection } from './lib/selection';
  import { firstMatchingLine, isImeComposing, mergeSearchHits, normalizeText, parseQuickNoteInput } from './lib/text';
  import type {
    ConnectionProfile,
    ImageAsset,
    Note,
    NoteLayoutMode,
    NotesClient,
    SearchHit,
    SortMode,
    UpdateNoteInput
  } from './lib/types';

  type ConnectionStatus = 'checking' | 'online' | 'unreachable' | 'auth-invalid';
  type EditorFocusTarget = { source: 'title' } | { source: 'body'; rawLineIndex: number };

  let connection: ConnectionProfile | null = loadConnection();
  let client: NotesClient | null = connection ? new RemoteNotesClient(connection) : null;
  let connectionStatus: ConnectionStatus = 'checking';
  let demoMode = false;
  let notes: Note[] = [];
  let lexicalHits: SearchHit[] = [];
  let semanticHits: SearchHit[] = [];
  let baseVisibleHits: SearchHit[] = [];
  let visibleHits: SearchHit[] = [];
  let query = '';
  let activeQuery = '';
  let querySaving = false;
  let selectedIndex = 0;
  let keyboardSelectionVisible = false;
  let searchTargets: SearchLineTarget[] = [];
  let activeMatchKey: string | null = null;
  let activeMatchTarget: SearchLineTarget | null = null;
  let editingId: string | null = null;
  let loading = false;
  let semanticSearching = false;
  let settingsOpen = false;
  let sortMode: SortMode = readPreference('sort', 'updated_desc') as SortMode;
  let noteLayoutMode: NoteLayoutMode = readPreference('note-layout', 'flat') === 'deck' ? 'deck' : 'flat';
  let wideCardsEnabled = readPreference('wide-cards', 'false') === 'true';
  let semanticEnabled = readPreference('semantic', 'true') === 'true';
  let themePreference = readPreference('theme', 'system') as 'system' | 'notesflash' | 'notesflash-dark';
  let errorMessage = '';
  let toastMessage = '';
  let deleteCandidate: Note | null = null;
  let deletingNote = false;
  let deleteErrorMessage = '';
  let searchBar: SearchBar;
  let lexicalTimer: number | undefined;
  let semanticTimer: number | undefined;
  let searchAnchorCorrectionTimer: number | undefined;
  let searchDeckResetFrame: number | undefined;
  let searchGeneration = 0;
  let lexicalSettledGeneration = 0;
  let lexicalSuccessfulGeneration = 0;
  let semanticSettledGeneration = 0;
  let semanticSuccessfulGeneration = 0;
  let pendingSemanticGeneration = 0;
  let pendingSemanticHits: SearchHit[] = [];
  let notesGeneration = 0;
  let lastNotesRefreshAt = 0;
  let activeEditor: {
    flush: () => Promise<boolean>;
    focusBody: () => void;
    focusTitle: () => void;
    focusLogicalLine: (rawLineIndex: number) => void;
  } | null = null;
  let queryTransition: Promise<void> | null = null;
  const handleWindowFocus = () => {
    focusSearchSoon();
    refreshStaleImageUrls();
  };
  const handleVisibilityChange = () => {
    if (document.visibilityState === 'visible') refreshStaleImageUrls();
  };
  const preferredDark = window.matchMedia('(prefers-color-scheme: dark)');
  const handlePreferredThemeChange = () => {
    if (themePreference === 'system') applyTheme();
  };

  $: baseVisibleHits = activeQuery.trim()
    ? (mergeSearchHits(lexicalHits, semanticHits) as SearchHit[])
    : notes.map((note) => ({ note, matchType: 'lexical', snippet: '', score: 0 }));
  $: visibleHits = baseVisibleHits;
  $: updateSearchTargets(visibleHits, activeQuery);
  $: activeMatchTarget = activeSearchLineTarget(searchTargets, activeMatchKey);
  $: maximumIndex = Math.max(0, visibleHits.length - 1);
  $: if (selectedIndex > maximumIndex) selectedIndex = maximumIndex;
  $: semanticSearchExpected = Boolean(client && semanticEnabled && activeQuery.trim().length >= 3);
  $: searchPending = Boolean(activeQuery.trim()) && (
    lexicalSettledGeneration !== searchGeneration ||
    (semanticSearchExpected && semanticSettledGeneration !== searchGeneration)
  );
  $: canCreateFromSearch = canCreateFromCompletedSearch({
    query: activeQuery,
    pending: searchPending,
    visibleHitCount: visibleHits.length,
    targetCount: searchTargets.length,
    generation: searchGeneration,
    lexicalSuccessfulGeneration,
    semanticExpected: semanticSearchExpected,
    semanticSuccessfulGeneration
  });
  $: activeDescendant = activeQuery.trim()
    ? searchTargetElementId(activeMatchTarget)
    : keyboardSelectionVisible && editingId === null
      ? `search-option-${selectedIndex}`
      : undefined;

  onMount(() => {
    applyTheme();
    if (!client && shouldAutoStartDemo()) {
      startDemo();
    } else if (client) {
      void refreshNotes();
    }
    window.addEventListener('keydown', handleGlobalKeydown);
    window.addEventListener('focus', handleWindowFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    preferredDark.addEventListener('change', handlePreferredThemeChange);
    focusSearchSoon();

    const unlisteners: Array<() => void> = [];
    if ('__TAURI_INTERNALS__' in window) {
      void import('@tauri-apps/api/event')
        .then(async ({ listen }) => {
          unlisteners.push(
            await listen('notesflash://focus-search', () => focusSearchSoon(true)),
            await listen('notesflash://shortcut-error', () => {
              showToast('全局快捷键被其他应用占用；NotesFlash 仍可从 Dock 打开。');
            })
          );
        })
        .catch(() => undefined);
    }

    return () => {
      window.removeEventListener('keydown', handleGlobalKeydown);
      window.removeEventListener('focus', handleWindowFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      preferredDark.removeEventListener('change', handlePreferredThemeChange);
      window.clearTimeout(lexicalTimer);
      window.clearTimeout(semanticTimer);
      window.clearTimeout(searchAnchorCorrectionTimer);
      cancelSearchDeckReset();
      unlisteners.forEach((unlisten) => unlisten());
    };
  });

  async function refreshNotes(): Promise<void> {
    if (!client) return;
    const generation = ++notesGeneration;
    loading = true;
    errorMessage = '';
    if (!demoMode) connectionStatus = 'checking';
    try {
      const loaded = await client.listNotes(sortMode, (partial) => {
        if (generation === notesGeneration) notes = preserveEditingNote(partial);
      });
      if (generation === notesGeneration) {
        notes = preserveEditingNote(loaded);
        refreshSearchHitNotes(notes);
        lastNotesRefreshAt = Date.now();
        if (!demoMode) connectionStatus = 'online';
      }
    } catch (error) {
      if (generation === notesGeneration) {
        handleError(error, '无法从云端载入笔记。');
      }
    } finally {
      if (generation === notesGeneration) loading = false;
    }
  }

  function connect(profile: ConnectionProfile): void {
    connection = profile;
    demoMode = false;
    connectionStatus = 'checking';
    client = new RemoteNotesClient(profile);
    notes = [];
    saveConnection(profile);
    void refreshNotes();
    focusSearchSoon(true);
  }


  function shouldAutoStartDemo(): boolean {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get('demo') === '1' || params.get('demo') === 'true') return true;
      return window.location.hash === '#demo';
    } catch {
      return false;
    }
  }

  function startDemo(): void {
    connection = null;
    demoMode = true;
    connectionStatus = 'online';
    client = new DemoNotesClient();
    void refreshNotes();
    focusSearchSoon(true);
  }

  async function disconnect(): Promise<void> {
    if (activeEditor && !(await activeEditor.flush())) {
      showToast('仍有内容未保存，请先解决保存错误。');
      return;
    }
    try {
      await client?.logout();
    } catch {
      // Local disconnect must still succeed if the Worker is unreachable.
    }
    clearConnection();
    notesGeneration += 1;
    connection = null;
    client = null;
    demoMode = false;
    connectionStatus = 'checking';
    notes = [];
    query = '';
    activeQuery = '';
    activeMatchKey = null;
    editingId = null;
    settingsOpen = false;
  }

  async function retryConnection(): Promise<void> {
    await refreshNotes();
    if (!demoMode && connectionStatus !== 'online') {
      throw new Error(errorMessage || '仍然无法连接 Worker。');
    }
  }

  async function updateEndpoint(value: string): Promise<void> {
    if (!connection) throw new Error('当前没有可修复的设备连接。');
    const endpoint = normalizeEndpoint(value);
    const nextConnection: ConnectionProfile = { ...connection, endpoint };
    const nextClient = new RemoteNotesClient(nextConnection);
    const previousStatus = connectionStatus;
    connectionStatus = 'checking';

    try {
      const loaded = await nextClient.listNotes(sortMode);
      notesGeneration += 1;
      connection = nextConnection;
      client = nextClient;
      notes = loaded;
      refreshSearchHitNotes(notes);
      lastNotesRefreshAt = Date.now();
      errorMessage = '';
      connectionStatus = 'online';
      saveConnection(nextConnection);
      applyQuery(activeQuery);
      showToast('Worker 地址已验证并保存');
    } catch (error) {
      connectionStatus = previousStatus;
      throw error;
    }
  }

  function updateQuery(value: string): void {
    query = value;
    keyboardSelectionVisible = false;
    if (!editingId) {
      applyQuery(value);
      return;
    }

    if (queryTransition) return;
    querySaving = true;
    const transition = (async () => {
      const editor = activeEditor;
      if (editor && !(await editor.flush())) {
        query = activeQuery;
        showToast('保存失败，已保留当前编辑内容，搜索没有切换。');
        return;
      }

      editingId = null;
      applyQuery(query);
    })().finally(() => {
      if (queryTransition === transition) queryTransition = null;
      querySaving = false;
    });
    queryTransition = transition;
  }

  function applyQuery(value: string, preserveResults = false): void {
    cancelSearchDeckReset();
    activeQuery = value;
    selectedIndex = 0;
    activeMatchKey = null;
    errorMessage = '';
    window.clearTimeout(lexicalTimer);
    window.clearTimeout(semanticTimer);
    semanticSearching = false;
    const generation = ++searchGeneration;
    const trimmed = value.trim();

    if (!preserveResults) {
      lexicalHits = [];
      semanticHits = [];
    }
    lexicalSettledGeneration = 0;
    lexicalSuccessfulGeneration = 0;
    semanticSettledGeneration = 0;
    semanticSuccessfulGeneration = 0;
    pendingSemanticGeneration = 0;
    pendingSemanticHits = [];

    if (!trimmed || !client) {
      return;
    }

    lexicalTimer = window.setTimeout(() => void performLexicalSearch(trimmed, generation), 120);

    if (semanticEnabled && trimmed.length >= 3) {
      semanticTimer = window.setTimeout(() => void performSemanticSearch(trimmed, generation), 360);
    } else {
      semanticHits = [];
      semanticSettledGeneration = generation;
      semanticSuccessfulGeneration = generation;
    }
  }

  async function performLexicalSearch(value: string, generation: number): Promise<void> {
    if (!client) return;
    try {
      const hits = await client.lexicalSearch(value);
      if (generation === searchGeneration) {
        lexicalHits = hits;
        lexicalSuccessfulGeneration = generation;
      }
    } catch (error) {
      if (generation === searchGeneration) handleError(error, '关键词搜索失败。');
    } finally {
      if (generation === searchGeneration) {
        lexicalSettledGeneration = generation;
        if (pendingSemanticGeneration === generation) {
          semanticHits = pendingSemanticHits;
          pendingSemanticGeneration = 0;
          pendingSemanticHits = [];
        }
      }
    }
  }

  async function performSemanticSearch(value: string, generation: number): Promise<void> {
    if (!client) return;
    semanticSearching = true;
    try {
      const hits = await client.semanticSearch(value);
      if (generation === searchGeneration) {
        semanticSuccessfulGeneration = generation;
        if (lexicalSettledGeneration === generation) semanticHits = hits;
        else {
          pendingSemanticGeneration = generation;
          pendingSemanticHits = hits;
        }
      }
    } catch (error) {
      if (generation === searchGeneration) {
        semanticHits = [];
        pendingSemanticGeneration = 0;
        pendingSemanticHits = [];
        if (error instanceof ApiError && [402, 429, 503].includes(error.status)) {
          showToast('语义搜索暂时不可用，已保留关键词结果。');
        }
      }
    } finally {
      if (generation === searchGeneration) {
        semanticSearching = false;
        semanticSettledGeneration = generation;
      }
    }
  }

  async function createFromQuery(): Promise<void> {
    if (!client) return;
    if (queryTransition) return;
    keyboardSelectionVisible = false;
    if (activeEditor && !(await activeEditor.flush())) {
      showToast('当前笔记尚未保存，暂时不能创建另一条。');
      return;
    }
    editingId = null;
    const draft = parseQuickNoteInput(query);
    const title = draft.title || '新笔记';
    try {
      const note = await client.createNote({ title, body: draft.body });
      notes = sortLocalNotes([note, ...notes.filter((item) => item.id !== note.id)]);
      updateQuery('');
      editingId = note.id;
      window.setTimeout(() => document.getElementById(`note-${note.id}`)?.scrollIntoView({ block: 'nearest' }), 0);
    } catch (error) {
      handleError(error, '无法创建笔记。');
    }
  }

  async function saveNote(id: string, input: UpdateNoteInput): Promise<Note> {
    if (!client) throw new Error('尚未连接后端。');
    const updated = await client.updateNote(id, input);
    replaceNote(updated);
    return updated;
  }

  async function deleteNote(note: Note): Promise<void> {
    if (!client) return;
    await client.deleteNote(note.id, note.version);
    notes = notes.filter((item) => item.id !== note.id);
    lexicalHits = lexicalHits.filter((hit) => hit.note.id !== note.id);
    semanticHits = semanticHits.filter((hit) => hit.note.id !== note.id);
    editingId = null;
    showToast('笔记已删除');
    focusSearchSoon();
  }

  async function requestNoteDelete(note: Note): Promise<void> {
    if (deletingNote) return;
    if (editingId === note.id && activeEditor && !(await activeEditor.flush())) {
      showToast('当前笔记保存失败，暂时不能删除。');
      return;
    }

    const current = notes.find((item) => item.id === note.id)
      ?? lexicalHits.find((hit) => hit.note.id === note.id)?.note
      ?? semanticHits.find((hit) => hit.note.id === note.id)?.note
      ?? note;
    deleteCandidate = current;
    deleteErrorMessage = '';
  }

  function cancelNoteDelete(): void {
    if (deletingNote) return;
    deleteCandidate = null;
    deleteErrorMessage = '';
  }

  async function confirmNoteDelete(): Promise<void> {
    if (!deleteCandidate || deletingNote) return;
    deletingNote = true;
    deleteErrorMessage = '';
    try {
      await deleteNote(deleteCandidate);
      deleteCandidate = null;
    } catch (error) {
      deleteErrorMessage = error instanceof Error ? error.message : '删除失败，请稍后重试。';
    } finally {
      deletingNote = false;
    }
  }

  async function uploadImage(file: File): Promise<ImageAsset> {
    if (!client) throw new Error('尚未连接后端。');
    if (file.size > 12 * 1024 * 1024) throw new Error('单张图片不能超过 12 MB。');
    return client.uploadImage(file);
  }

  function replaceNote(updated: Note): void {
    // Keep the stream spatially stable while typing. Re-sorting an updated note
    // to the top after every autosave makes the page jump under the user's cursor.
    notes = notes.map((note) => (note.id === updated.id ? updated : note));
    lexicalHits = lexicalHits.map((hit) =>
      hit.note.id === updated.id ? { ...hit, note: updated } : hit
    );
    semanticHits = semanticHits.map((hit) =>
      hit.note.id === updated.id ? { ...hit, note: updated } : hit
    );
  }

  function handleSearchKey(event: CustomEvent<KeyboardEvent>): void {
    const keyboardEvent = event.detail;
    if (isImeComposing(keyboardEvent)) return;
    if (queryTransition) {
      keyboardEvent.preventDefault();
      return;
    }
    const hasSearchQuery = Boolean(activeQuery.trim());

    if (hasSearchQuery && (keyboardEvent.key === 'ArrowDown' || keyboardEvent.key === 'Enter')) {
      keyboardEvent.preventDefault();
      if (searchTargets.length > 0) {
        moveSearchMatch('next');
      } else if (keyboardEvent.key === 'Enter' && canCreateFromSearch) {
        void createFromQuery();
      }
      return;
    }

    if (hasSearchQuery && keyboardEvent.key === 'ArrowUp') {
      keyboardEvent.preventDefault();
      if (searchTargets.length > 0) moveSearchMatch('previous');
      return;
    }

    if (keyboardEvent.key === 'ArrowDown') {
      keyboardEvent.preventDefault();
      selectedIndex = nextKeyboardSelection(
        'down',
        selectedIndex,
        maximumIndex,
        keyboardSelectionVisible,
        false,
        visibleHits.length > 0
      );
      keyboardSelectionVisible = true;
      scrollToOption(selectedIndex);
      return;
    }

    if (keyboardEvent.key === 'ArrowUp') {
      keyboardEvent.preventDefault();
      selectedIndex = nextKeyboardSelection(
        'up',
        selectedIndex,
        maximumIndex,
        keyboardSelectionVisible,
        false,
        visibleHits.length > 0
      );
      keyboardSelectionVisible = true;
      scrollToOption(selectedIndex);
      return;
    }

    if (keyboardEvent.key === 'Enter') {
      keyboardEvent.preventDefault();
      void openSelectedNote(false);
      return;
    }

    if (keyboardEvent.key === 'Tab' && hasSearchQuery && searchTargets.length > 0) {
      keyboardEvent.preventDefault();
      void openActiveSearchMatch(true);
      return;
    }

    if (keyboardEvent.key === 'Tab' && !hasSearchQuery && visibleHits.length > 0) {
      keyboardEvent.preventDefault();
      void openSelectedNote(true);
      return;
    }

    if (keyboardEvent.key === 'Escape') {
      keyboardEvent.preventDefault();
      if (query) updateQuery('');
      else void closeActiveEditor();
    }
  }

  function moveSearchMatch(direction: 'next' | 'previous'): void {
    if (searchDeckResetFrame !== undefined) return;

    const currentIndex = activeMatchKey
      ? searchTargets.findIndex((target) => target.key === activeMatchKey)
      : -1;
    const nextKey = moveActiveMatchKey(searchTargets, activeMatchKey, direction);
    const target = activeSearchLineTarget(searchTargets, nextKey);
    if (!nextKey || !target) return;

    const currentTarget = currentIndex >= 0 ? searchTargets[currentIndex] : null;
    const wrapsDeckToBeginning = noteLayoutMode === 'deck'
      && direction === 'next'
      && searchTargets.length > 1
      && currentIndex === searchTargets.length - 1
      && currentTarget?.noteId !== target.noteId;

    if (wrapsDeckToBeginning) {
      resetSearchDeckToBeginning(nextKey, target);
      return;
    }

    activeMatchKey = nextKey;
    scrollToSearchTarget(target);
  }

  function resetSearchDeckToBeginning(nextKey: string, target: SearchLineTarget): void {
    cancelSearchDeckReset();
    window.clearTimeout(searchAnchorCorrectionTimer);

    const startScroll = window.scrollY;
    const finish = () => {
      searchDeckResetFrame = undefined;
      window.scrollTo({ top: 0, behavior: 'auto' });
      activeMatchKey = nextKey;
      void tick().then(() => scrollToSearchTarget(target));
    };

    if (startScroll < 2 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      finish();
      return;
    }

    const startedAt = performance.now();
    const duration = Math.min(460, Math.max(280, 220 + Math.sqrt(startScroll) * 4));
    const animate = (now: number) => {
      const progress = clamp01((now - startedAt) / duration);
      const eased = progress < 0.5
        ? 4 * progress * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 3) / 2;
      window.scrollTo({ top: Math.round(startScroll * (1 - eased)), behavior: 'auto' });

      if (progress < 1) {
        searchDeckResetFrame = window.requestAnimationFrame(animate);
        return;
      }
      finish();
    };

    searchDeckResetFrame = window.requestAnimationFrame(animate);
  }

  function cancelSearchDeckReset(): void {
    if (searchDeckResetFrame === undefined) return;
    window.cancelAnimationFrame(searchDeckResetFrame);
    searchDeckResetFrame = undefined;
  }

  async function openActiveSearchMatch(copyMatched: boolean): Promise<void> {
    const target = activeSearchLineTarget(searchTargets, activeMatchKey) ?? searchTargets[0];
    if (!target) return;

    activeMatchKey = target.key;
    if (copyMatched && await copyText(target.text)) {
      showToast(
        target.source === 'semantic'
          ? '语义结果按笔记定位，已复制标题'
          : target.source === 'title'
            ? '已复制命中标题'
            : `已复制第 ${target.lineNumber} 行`
      );
    }
    if (!(await beginEditing(target.noteId))) return;
    activeMatchKey = null;
    await tick();
    focusEditorTarget(target);
  }

  async function openSelectedNote(copyMatched: boolean): Promise<void> {
    const hit = selectedHit();
    if (!hit) return;
    if (!(await beginEditing(hit.note.id))) return;
    if (copyMatched) await copyHit(hit);
    window.setTimeout(() => {
      activeEditor?.focusBody();
      document.getElementById(`note-${hit.note.id}`)?.scrollIntoView({ block: 'nearest' });
    }, 0);
  }

  async function beginEditingAt(id: string, target: EditorFocusTarget): Promise<void> {
    if (!(await beginEditing(id))) return;
    activeMatchKey = null;
    await tick();
    focusEditorTarget(target);
  }

  function focusEditorTarget(target: EditorFocusTarget | SearchLineTarget): void {
    if (target.source === 'title') {
      activeEditor?.focusTitle();
      return;
    }
    if (target.source === 'semantic') {
      activeEditor?.focusBody();
      return;
    }
    if (target.rawLineIndex !== null) activeEditor?.focusLogicalLine(target.rawLineIndex);
  }

  async function beginEditing(id: string): Promise<boolean> {
    if (queryTransition) return false;
    if (editingId === id) return true;
    keyboardSelectionVisible = false;
    const previousEditingId = editingId;
    if (activeEditor && !(await activeEditor.flush())) {
      showToast('当前笔记尚未保存，仍保留在编辑状态。');
      return false;
    }
    if (previousEditingId) pruneSavedSearchHit(previousEditingId);
    editingId = id;
    return true;
  }

  async function closeActiveEditor(): Promise<void> {
    if (activeEditor && !(await activeEditor.flush())) {
      showToast('保存失败，编辑内容仍保留。');
      return;
    }
    finishEditing();
  }

  function finishEditing(): void {
    editingId = null;
    keyboardSelectionVisible = false;
    if (activeQuery.trim()) applyQuery(activeQuery, true);
    focusSearchSoon();
  }

  function pruneSavedSearchHit(noteId: string): void {
    if (!activeQuery.trim()) return;
    const note = notes.find((item) => item.id === noteId);
    if (!note) return;
    const normalizedQuery = normalizeText(activeQuery);
    const stillMatchesCharacters = normalizeText(`${note.title}\n${note.body}`).includes(normalizedQuery);
    if (!stillMatchesCharacters) {
      lexicalHits = lexicalHits.filter((hit) => hit.note.id !== noteId);
    }
    if (note.embeddingStatus !== 'ready') {
      semanticHits = semanticHits.filter((hit) => hit.note.id !== noteId);
    }
  }

  function selectedHit(): SearchHit | undefined {
    return visibleHits[selectedIndex];
  }

  async function copyHit(hit: SearchHit): Promise<void> {
    const matched = firstMatchingLine(`${hit.note.title}\n${hit.note.body}`, activeQuery) || hit.note.title;
    if (await copyText(matched)) {
      showToast('已复制命中内容');
    }
  }

  function handleGlobalKeydown(event: KeyboardEvent): void {
    if ((event.metaKey || event.ctrlKey) && event.key.toLocaleLowerCase() === 'n') {
      event.preventDefault();
      void createFromQuery();
    }
    if ((event.metaKey || event.ctrlKey) && event.key === ',') {
      event.preventDefault();
      settingsOpen = true;
    }
    if ((event.metaKey || event.ctrlKey) && event.key.toLocaleLowerCase() === 'k') {
      event.preventDefault();
      focusSearchSoon(true);
    }
  }

  function changeSort(next: SortMode): void {
    sortMode = next;
    writePreference('sort', next);
    void refreshNotes();
  }

  function changeNoteLayout(next: NoteLayoutMode): void {
    if (next === noteLayoutMode) return;
    cancelSearchDeckReset();
    noteLayoutMode = next;
    writePreference('note-layout', next);
  }

  function changeWideCards(next: boolean): void {
    if (next === wideCardsEnabled) return;
    wideCardsEnabled = next;
    writePreference('wide-cards', String(next));
  }

  function deckMotion(node: HTMLElement, initialMode: NoteLayoutMode) {
    let mode = initialMode;
    let frame = 0;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

    const clearMotion = (stages: HTMLElement[]) => {
      for (const stage of stages) {
        stage.style.removeProperty('--deck-y');
        stage.style.removeProperty('--deck-scale');
        stage.style.removeProperty('--deck-rotate');
        stage.style.removeProperty('--deck-opacity');
        stage.style.removeProperty('--deck-shadow-strength');
        stage.style.removeProperty('pointer-events');
        stage.removeAttribute('inert');
      }
    };

    const render = () => {
      frame = 0;
      const stages = [...node.querySelectorAll<HTMLElement>('[data-note-stage]')];
      if (mode !== 'deck' || reducedMotion.matches || stages.length === 0) {
        clearMotion(stages);
        return;
      }

      const rects = stages.map((stage) => stage.getBoundingClientRect());
      const parsedTop = Number.parseFloat(getComputedStyle(stages[0]).top);
      const stickyTop = Number.isFinite(parsedTop) ? parsedTop : 112;
      const exitDistance = Math.max(96, Math.min(156, window.innerHeight * 0.18));
      const enterDistance = Math.max(240, Math.min(430, window.innerHeight * 0.5));
      const enterStart = stickyTop + enterDistance;

      for (let index = 0; index < stages.length; index += 1) {
        if (stages[index].classList.contains('active-match-stage')) {
          stages[index].style.setProperty('--deck-y', '0px');
          stages[index].style.setProperty('--deck-scale', '1');
          stages[index].style.setProperty('--deck-rotate', '0deg');
          stages[index].style.setProperty('--deck-opacity', '1');
          stages[index].style.setProperty('--deck-shadow-strength', '100%');
          stages[index].style.removeProperty('pointer-events');
          stages[index].removeAttribute('inert');
          continue;
        }

        const enter = clamp01((enterStart - rects[index].top) / enterDistance);
        const nextTop = rects[index + 1]?.top;
        const exit = nextTop === undefined
          ? 0
          : clamp01((stickyTop + exitDistance - nextTop) / exitDistance);
        const direction = index % 2 === 0 ? -1 : 1;
        const translateY = (1 - enter) * 10 - exit * 14;
        const scale = 0.975 + enter * 0.025 - exit * 0.035;
        const rotation = direction * ((1 - enter) * 0.58 - exit * 0.28);
        const baseOpacity = 0.84 + enter * 0.16 - exit * 0.22;
        const editing = stages[index].classList.contains('editing-note-stage');
        const followingTop = rects[index + 2]?.top;
        const historyExit = followingTop === undefined
          ? 0
          : clamp01((stickyTop + exitDistance - followingTop) / exitDistance);
        const historyVisibility = Math.pow(1 - historyExit, 2);
        const opacity = baseOpacity * historyVisibility;
        const shadowStrength = Math.pow(1 - exit, 2);

        stages[index].style.setProperty('--deck-y', `${translateY.toFixed(2)}px`);
        stages[index].style.setProperty('--deck-scale', scale.toFixed(4));
        stages[index].style.setProperty('--deck-rotate', `${rotation.toFixed(3)}deg`);
        stages[index].style.setProperty('--deck-opacity', opacity.toFixed(3));
        stages[index].style.setProperty('--deck-shadow-strength', `${(shadowStrength * 100).toFixed(1)}%`);
        if (historyVisibility < 0.02 && !editing) {
          stages[index].style.setProperty('pointer-events', 'none');
          stages[index].setAttribute('inert', '');
        } else {
          stages[index].style.removeProperty('pointer-events');
          stages[index].removeAttribute('inert');
        }
      }
    };

    const schedule = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(render);
    };

    const resizeObserver = new ResizeObserver(schedule);
    const mutationObserver = new MutationObserver(schedule);
    resizeObserver.observe(node);
    mutationObserver.observe(node, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class']
    });
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule, { passive: true });
    reducedMotion.addEventListener('change', schedule);
    schedule();

    return {
      update(nextMode: NoteLayoutMode) {
        mode = nextMode;
        schedule();
      },
      destroy() {
        if (frame) window.cancelAnimationFrame(frame);
        resizeObserver.disconnect();
        mutationObserver.disconnect();
        window.removeEventListener('scroll', schedule);
        window.removeEventListener('resize', schedule);
        reducedMotion.removeEventListener('change', schedule);
      }
    };
  }

  function clamp01(value: number): number {
    return Math.min(1, Math.max(0, value));
  }

  function sortLocalNotes(items: Note[]): Note[] {
    return [...items].sort((left, right) => {
      if (sortMode === 'title_asc') return left.title.localeCompare(right.title, 'zh-CN');
      if (sortMode === 'created_desc') return right.createdAt - left.createdAt;
      return right.updatedAt - left.updatedAt;
    });
  }

  function refreshSearchHitNotes(freshNotes: Note[]): void {
    const byId = new Map(freshNotes.map((note) => [note.id, note]));
    lexicalHits = lexicalHits.map((hit) => ({ ...hit, note: byId.get(hit.note.id) ?? hit.note }));
    semanticHits = semanticHits.map((hit) => ({ ...hit, note: byId.get(hit.note.id) ?? hit.note }));
  }

  function updateSearchTargets(hits: SearchHit[], value: string): void {
    const previousTarget = activeSearchLineTarget(searchTargets, activeMatchKey);
    const nextTargets = value.trim() ? collectSearchLineTargets(hits, value) : [];
    activeMatchKey = retainActiveMatchKey(nextTargets, activeMatchKey, previousTarget);
    searchTargets = nextTargets;
  }

  function preserveEditingNote(freshNotes: Note[]): Note[] {
    if (!editingId || freshNotes.some((note) => note.id === editingId)) return freshNotes;
    const active = notes.find((note) => note.id === editingId);
    return active ? [active, ...freshNotes] : freshNotes;
  }

  function refreshStaleImageUrls(): void {
    if (!client || loading || Date.now() - lastNotesRefreshAt < 20 * 60 * 60 * 1000) return;
    void refreshNotes();
  }

  async function changeSemantic(next: boolean): Promise<void> {
    if (next === semanticEnabled) return;
    const previous = semanticEnabled;
    semanticEnabled = next;
    if (editingId && activeEditor && !(await activeEditor.flush())) {
      semanticEnabled = previous;
      showToast('保存失败，已保留当前编辑内容，语义搜索设置没有改变。');
      return;
    }

    editingId = null;
    writePreference('semantic', String(next));
    if (!next) {
      semanticHits = [];
      semanticSearching = false;
      window.clearTimeout(semanticTimer);
    }
    if (activeQuery.trim()) {
      applyQuery(activeQuery, true);
    }
  }

  function changeTheme(theme: 'system' | 'notesflash' | 'notesflash-dark'): void {
    themePreference = theme;
    writePreference('theme', theme);
    applyTheme();
  }

  function applyTheme(): void {
    document.documentElement.dataset.theme = themePreference === 'system'
      ? preferredDark.matches ? 'notesflash-dark' : 'notesflash'
      : themePreference;
  }

  function focusSearchSoon(select = false): void {
    window.setTimeout(() => {
      searchBar?.focus();
      if (!select) return;
    }, 20);
  }

  function scrollToOption(index: number): void {
    window.setTimeout(() => {
      document.getElementById(`search-option-${index}`)?.scrollIntoView({ block: 'nearest', behavior: 'auto' });
    }, 0);
  }

  function searchTargetElementId(target: SearchLineTarget | null): string | undefined {
    if (!target) return undefined;
    if (target.source === 'semantic') return `note-${target.noteId}-title`;
    if (target.source === 'title') return `note-${target.noteId}-title`;
    return `note-${target.noteId}-line-${target.rawLineIndex}`;
  }

  function scrollToSearchTarget(target: SearchLineTarget): void {
    const elementId = searchTargetElementId(target);
    if (!elementId) return;
    window.requestAnimationFrame(() => {
      const element = document.getElementById(elementId);
      if (!element) return;
      scrollElementToReadingAnchor(element);
    });
  }

  function scrollElementToReadingAnchor(element: HTMLElement): void {
    window.clearTimeout(searchAnchorCorrectionTimer);
    const searchBottom = document
      .querySelector<HTMLElement>('.search-shell')
      ?.getBoundingClientRect().bottom ?? 0;
    const availableHeight = Math.max(180, window.innerHeight - searchBottom);
    const readingOffset = Math.max(64, Math.min(112, availableHeight * 0.22));
    const anchorTop = Math.min(window.innerHeight - 72, searchBottom + readingOffset);
    const elementTop = element.getBoundingClientRect().top;
    const maximumScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    const nextScrollTop = Math.max(
      0,
      Math.min(maximumScroll, window.scrollY + elementTop - anchorTop)
    );

    if (Math.abs(nextScrollTop - window.scrollY) < 2) return;
    window.scrollTo({ top: nextScrollTop, behavior: 'smooth' });

    // Sticky deck cards slightly change their transform while the page moves.
    // Apply one tiny correction after the smooth scroll so the highlighted
    // logical line finishes on the same reading anchor in both layouts.
    searchAnchorCorrectionTimer = window.setTimeout(() => {
      if (!element.isConnected) return;
      const correctedTop = element.getBoundingClientRect().top;
      const correction = correctedTop - anchorTop;
      if (Math.abs(correction) < 4) return;
      const correctedScrollTop = Math.max(
        0,
        Math.min(maximumScroll, window.scrollY + correction)
      );
      window.scrollTo({ top: correctedScrollTop, behavior: 'auto' });
    }, 260);
  }

  function showToast(message: string): void {
    toastMessage = message;
    window.setTimeout(() => {
      if (toastMessage === message) toastMessage = '';
    }, 1800);
  }

  function handleError(error: unknown, fallback: string): void {
    errorMessage = error instanceof Error ? error.message : fallback;
    updateConnectionStatus(error);
    if (error instanceof ApiError && [401, 403].includes(error.status)) {
      showToast('设备授权已失效，请重新配对。');
    }
  }

  function updateConnectionStatus(error: unknown): void {
    if (demoMode || !connection) return;
    if (error instanceof ApiError && (error.status === 0 || error.code === 'NETWORK_ERROR')) {
      connectionStatus = 'unreachable';
      return;
    }
    if (error instanceof ApiError && [401, 403].includes(error.status)) {
      connectionStatus = 'auth-invalid';
      return;
    }
    if (connectionStatus === 'checking') connectionStatus = 'unreachable';
  }

  function readPreference(key: string, fallback: string): string {
    try {
      return localStorage.getItem(`notesflash.preference.${key}`) ?? fallback;
    } catch {
      return fallback;
    }
  }

  function writePreference(key: string, value: string): void {
    try {
      localStorage.setItem(`notesflash.preference.${key}`, value);
    } catch {
      // Preferences are non-critical.
    }
  }
</script>

{#if !client}
  <ConnectPanel on:connected={(event) => connect(event.detail)} on:demo={startDemo} />
{:else}
  <main class="app-shell" class:wide-layout={wideCardsEnabled}>
    <SearchBar
      bind:this={searchBar}
      value={query}
      {semanticSearching}
      {semanticEnabled}
      {activeDescendant}
      on:input={(event) => updateQuery(event.detail)}
      on:keyaction={handleSearchKey}
      on:settings={() => (settingsOpen = true)}
    />

    <div class="app-body">
      <div class="app-body-content">
        <div class="mb-3 mt-3 flex min-h-5 items-center justify-between px-1 text-[11px] text-base-content/42">
          <span>
            {#if querySaving}
              正在保存当前笔记并切换搜索…
            {:else if activeQuery.trim()}
              {searchTargets.length} 处匹配 · {visibleHits.length} 条笔记
              {#if semanticSearching} · 正在补充语义结果{/if}
            {:else}
              {notes.length} 条笔记 · {noteLayoutMode === 'flat' ? '卡片平铺' : '叠卡抽牌'}
            {/if}
          </span>
          <span class="hidden items-center gap-1.5 sm:flex">
            <Command size={12} /> ⇧ Space 唤起 · Enter/↓ 下一处 · Tab 复制并编辑
          </span>
        </div>

        {#if demoMode}
          <div class="alert mb-3 min-h-0 rounded-box border border-warning/20 bg-warning/8 py-2 text-xs">
            <CloudOff size={15} />
            <span>演示模式：内容只在当前页面内存中，刷新后会消失。</span>
          </div>
        {/if}

        {#if errorMessage}
          <div class="alert alert-error mb-3 min-h-0 rounded-box py-2 text-sm" role="alert">
            <span class="min-w-0 flex-1">{errorMessage}</span>
            <div class="flex shrink-0 gap-1">
              {#if !demoMode && connectionStatus === 'unreachable'}
                <button class="btn btn-ghost btn-xs" on:click={() => void retryConnection().catch(() => undefined)}>重试</button>
                <button class="btn btn-ghost btn-xs" on:click={() => (settingsOpen = true)}>修复地址</button>
              {:else if !demoMode && connectionStatus === 'auth-invalid'}
                <button class="btn btn-ghost btn-xs" on:click={() => void disconnect()}>重新配对</button>
              {/if}
              <button class="btn btn-ghost btn-xs" on:click={() => (errorMessage = '')}>关闭</button>
            </div>
          </div>
        {/if}

        {#if activeQuery.trim()}
          <div class="mb-2">
            <QuickCreateRow
              query={activeQuery}
              selected={false}
              enterCreates={canCreateFromSearch}
              on:click={createFromQuery}
            />
          </div>
        {/if}

        {#if loading && visibleHits.length === 0}
          <div class="flex items-center justify-center gap-2 py-20 text-sm text-base-content/45">
            <LoaderCircle size={18} class="animate-spin" /> 正在读取云端笔记…
          </div>
        {:else if !demoMode && connectionStatus !== 'online' && visibleHits.length === 0}
          <div class="flex flex-col items-center py-20 text-center text-base-content/42">
            <CloudOff size={30} strokeWidth={1.5} />
            <p class="mt-3 text-sm">
              {connectionStatus === 'auth-invalid' ? '设备授权已失效' : '尚未读取到云端笔记'}
            </p>
            <div class="mt-4 flex gap-2">
              <button class="btn btn-outline btn-sm" on:click={() => void retryConnection().catch(() => undefined)}>重试连接</button>
              <button class="btn btn-primary btn-sm" on:click={() => (settingsOpen = true)}>修复连接</button>
            </div>
          </div>
        {:else if visibleHits.length === 0 && !activeQuery.trim()}
          <div class="flex flex-col items-center py-20 text-center text-base-content/42">
            <SearchX size={30} strokeWidth={1.5} />
            <p class="mt-3 text-sm">还没有笔记</p>
            <button class="btn btn-primary btn-sm mt-4" on:click={createFromQuery}>创建第一条</button>
          </div>
        {:else if visibleHits.length === 0 && activeQuery.trim()}
          <div class="flex items-center justify-center gap-2 py-14 text-sm text-base-content/40">
            {#if searchPending}
              <LoaderCircle size={16} class="animate-spin text-primary/70" /> 正在搜索匹配内容…
            {:else if canCreateFromSearch}
              没有现有匹配，可以直接创建。
            {:else}
              搜索暂时未能确认结果；仍可点击上方明确创建。
            {/if}
          </div>
        {:else}
          <section
            use:deckMotion={noteLayoutMode}
            class="note-stream pb-16"
            class:note-stream-flat={noteLayoutMode === 'flat'}
            class:note-stream-deck={noteLayoutMode === 'deck'}
            aria-label={noteLayoutMode === 'flat' ? '平铺笔记卡片' : '叠卡笔记流'}
          >
            {#each visibleHits as hit, index (hit.note.id)}
              <div
                id={`note-${hit.note.id}`}
                class="note-stage"
                class:active-match-stage={activeMatchTarget?.noteId === hit.note.id}
                class:editing-note-stage={editingId === hit.note.id}
                data-note-stage
                aria-current={activeMatchTarget?.noteId === hit.note.id || editingId === hit.note.id ? 'true' : undefined}
                style={`--deck-order: ${Math.min(index, 18)}`}
              >
                <div class="note-card-motion">
                <SwipeableNote
                  label={`删除“${hit.note.title || '无标题'}”`}
                  disabled={deletingNote}
                  on:delete={() => void requestNoteDelete(hit.note)}
                >
                {#if editingId === hit.note.id}
                  <NoteEditor
                    bind:this={activeEditor}
                    note={hit.note}
                    {saveNote}
                    {uploadImage}
                    close={finishEditing}
                    activeRawLineIndex={activeMatchTarget?.noteId === hit.note.id && activeMatchTarget.source === 'body'
                      ? activeMatchTarget.rawLineIndex
                      : null}
                    activeTitle={activeMatchTarget?.noteId === hit.note.id && activeMatchTarget.source !== 'body'}
                    layoutMode={noteLayoutMode}
                    on:contentchange={() => (activeMatchKey = null)}
                  />
                {:else}
                  <NoteCard
                    {hit}
                    query={activeQuery}
                    optionIndex={index}
                    selected={!activeQuery.trim() && isKeyboardOptionSelected(
                      keyboardSelectionVisible,
                      editingId,
                      selectedIndex,
                      index
                    )}
                    activeRawLineIndex={activeMatchTarget?.noteId === hit.note.id && activeMatchTarget.source === 'body'
                      ? activeMatchTarget.rawLineIndex
                      : null}
                    activeTitle={activeMatchTarget?.noteId === hit.note.id && activeMatchTarget.source !== 'body'}
                    layoutMode={noteLayoutMode}
                    on:edit={(event) => void beginEditingAt(hit.note.id, event.detail)}
                  />
                {/if}
                </SwipeableNote>
                </div>
              </div>
            {/each}
          </section>
        {/if}
      </div>
    </div>
  </main>

  <SettingsDialog
    open={settingsOpen}
    {sortMode}
    {noteLayoutMode}
    {wideCardsEnabled}
    {semanticEnabled}
    {demoMode}
    {connectionStatus}
    endpoint={connection?.endpoint ?? ''}
    {updateEndpoint}
    {retryConnection}
    createPairingCode={!demoMode && connectionStatus === 'online' && client ? () => client!.createPairingCode() : undefined}
    on:close={() => (settingsOpen = false)}
    on:sortchange={(event) => changeSort(event.detail)}
    on:layoutchange={(event) => changeNoteLayout(event.detail)}
    on:widecardschange={(event) => changeWideCards(event.detail)}
    on:semanticchange={(event) => void changeSemantic(event.detail)}
    on:themechange={(event) => changeTheme(event.detail)}
    on:disconnect={() => void disconnect()}
  />

  {#if deleteCandidate}
    <DeleteNoteDialog
      title={deleteCandidate.title}
      deleting={deletingNote}
      errorMessage={deleteErrorMessage}
      on:cancel={cancelNoteDelete}
      on:confirm={() => void confirmNoteDelete()}
    />
  {/if}

  {#if toastMessage}
    <div class="toast toast-center toast-bottom z-[70] pb-[calc(1rem+var(--safe-bottom))]">
      <div class="nf-toast-in alert min-h-0 rounded-field border-0 bg-neutral px-4 py-2.5 text-sm text-neutral-content shadow-lg">
        <span>{toastMessage}</span>
      </div>
    </div>
  {/if}
{/if}

<style>
  main,
  main :global(*) {
    cursor: text !important;
  }

  main :global(button:not(:disabled)),
  main :global(button:not(:disabled) *),
  main :global(a[href]),
  main :global(a[href] *),
  main :global(select),
  main :global(select *),
  main :global(summary),
  main :global(summary *) {
    cursor: pointer !important;
  }

  main :global(button:disabled),
  main :global(button:disabled *) {
    cursor: not-allowed !important;
  }

  main.wide-layout {
    width: max(min(100%, var(--app-max-width)), 88vw);
  }

  .note-stream-flat {
    display: grid;
    gap: 0.8rem;
  }

  .note-stream-deck {
    position: relative;
    padding-bottom: min(38dvh, 20rem);
  }

  .note-stream-deck .note-stage {
    position: sticky;
    top: calc(var(--safe-top) + 7.25rem);
    z-index: calc(2 + var(--deck-order));
    padding-bottom: 0.35rem;
    scroll-margin-top: calc(var(--safe-top) + 7.25rem);
  }

  .note-stream-deck .note-stage.active-match-stage {
    z-index: 25;
  }

  .note-stream-deck .note-stage.editing-note-stage:focus-within {
    z-index: 24;
    --deck-opacity: 1 !important;
    --deck-shadow-strength: 100% !important;
  }

  .note-card-motion {
    min-width: 0;
  }

  .note-stream-deck .note-card-motion {
    transform-origin: 50% 8%;
    transform:
      translate3d(0, var(--deck-y, 0), 0)
      scale(var(--deck-scale, 1))
      rotate(var(--deck-rotate, 0deg));
    opacity: var(--deck-opacity, 1);
    will-change: transform, opacity;
  }

  @media (max-width: 639px) {
    .note-stream-flat {
      gap: 0.65rem;
    }

    .note-stream-deck .note-stage {
      top: calc(var(--safe-top) + 7rem);
      scroll-margin-top: calc(var(--safe-top) + 7rem);
      padding-bottom: 0.3rem;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .note-stream-deck .note-card-motion {
      transform: none;
      opacity: 1;
      will-change: auto;
    }
  }
</style>
