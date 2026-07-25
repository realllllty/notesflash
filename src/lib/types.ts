export type EmbeddingStatus = 'disabled' | 'pending' | 'processing' | 'ready' | 'failed';

export type SortMode = 'updated_desc' | 'created_desc' | 'title_asc';

export type NoteLayoutMode = 'flat' | 'deck';

export interface ImageAsset {
  id: string;
  url: string;
  name: string;
  mimeType: string;
  width?: number;
  height?: number;
  size?: number;
}

export interface Note {
  id: string;
  title: string;
  body: string;
  images: ImageAsset[];
  version: number;
  createdAt: number;
  updatedAt: number;
  embeddingStatus: EmbeddingStatus;
}

export type MatchType = 'lexical' | 'semantic' | 'both';

/**
 * A matched line range reported by semantic search. Character offsets are
 * indexes into `note.body`, so the client can highlight the exact span instead
 * of guessing which part of the note matched.
 */
export interface SearchMatch {
  kind: 'title' | 'body';
  lineNumber: number | null;
  rawLineIndex: number | null;
  lineStart: number | null;
  lineEnd: number | null;
  charStart: number | null;
  charEnd: number | null;
  score: number;
  text: string;
}

export interface SearchHit {
  note: Note;
  matchType: MatchType;
  snippet: string;
  score: number;
  lexicalRank?: number;
  semanticRank?: number;
  /** Server-reported semantic line matches, strongest first. */
  matches?: SearchMatch[];
}

export interface ConnectionProfile {
  endpoint: string;
  token: string;
  instanceId?: string;
  deviceId?: string;
}

export interface PairingResponse {
  token: string;
  instanceId: string;
  deviceId?: string;
}

export interface PairingCode {
  code: string;
  expiresAt: number;
}

export interface CreateNoteInput {
  title: string;
  body: string;
  imageIds?: string[];
}

export interface UpdateNoteInput {
  baseVersion: number;
  title: string;
  body: string;
  imageIds?: string[];
}

export interface NotesClient {
  logout(): Promise<void>;
  createPairingCode(): Promise<PairingCode>;
  listNotes(sort: SortMode, onProgress?: (notes: Note[]) => void): Promise<Note[]>;
  createNote(input: CreateNoteInput): Promise<Note>;
  updateNote(id: string, input: UpdateNoteInput): Promise<Note>;
  deleteNote(id: string, baseVersion: number): Promise<void>;
  lexicalSearch(query: string, signal?: AbortSignal): Promise<SearchHit[]>;
  semanticSearch(query: string, limit?: number, signal?: AbortSignal): Promise<SearchHit[]>;
  uploadImage(file: File): Promise<ImageAsset>;
}
