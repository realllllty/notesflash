export interface RerankerInput {
  query: string;
  contexts: Array<{ text: string }>;
  top_k?: number;
}

export interface RerankerOutput {
  response?: Array<{
    id?: number;
    score?: number;
  }>;
}

export interface AiBinding {
  run(model: "@cf/baai/bge-reranker-base", input: RerankerInput): Promise<RerankerOutput>;
  run(model: string, input: Record<string, unknown>): Promise<unknown>;
}

export interface Env {
  DB: D1Database;
  IMAGES: R2Bucket;
  /** Legacy note-level index (1024 dimensions); kept only for vector cleanup. */
  VECTOR_INDEX: VectorizeIndex;
  /** Line-level chunk index used by semantic search. */
  CHUNK_INDEX: VectorizeIndex;
  AI: AiBinding;
  INDEX_QUEUE: Queue<IndexJob>;

  INSTANCE_NAME?: string;
  ALLOWED_ORIGINS?: string;
  EMBEDDING_MODEL?: string;
  EMBEDDING_INSTRUCTION?: string;
  SEMANTIC_MIN_COSINE?: string;
  SEMANTIC_RELATIVE_MIN_RATIO?: string;
  SEMANTIC_MULTI_CHUNK_BONUS?: string;
  SEMANTIC_MAX_BONUS_CHUNKS?: string;
  SEMANTIC_MAX_MATCHES_PER_NOTE?: string;
  SEMANTIC_CHUNK_TOP_K?: string;
  SEMANTIC_CHUNK_TARGET_CHARS?: string;
  SEMANTIC_CHUNK_MAX_CHARS?: string;
  SEMANTIC_CHUNK_MIN_CHARS?: string;
  SEMANTIC_CHUNK_MAX_LINES?: string;
  SEMANTIC_CHUNK_OVERLAP_LINES?: string;
  SEMANTIC_CHUNK_TITLE_CONTEXT?: string;
  SEMANTIC_SPAN_REFINE?: string;
  SEMANTIC_SPAN_MIN_CHARS?: string;
  SEMANTIC_SPAN_MAX_CANDIDATES?: string;
  SEMANTIC_SPAN_MAX_NOTES?: string;
  SEMANTIC_SPAN_MIN_RATIO?: string;
  SEMANTIC_TOP_K?: string;
  /** Search lab kill switch; must be exactly "true" to expose the endpoint. */
  LAB_ENABLED?: string;
  /** SHA-256 hex of the lab token. The plaintext never enters the repository. */
  LAB_TOKEN_SHA256?: string;
  MAX_IMAGE_BYTES?: string;
  SESSION_TTL_DAYS?: string;
  TRASH_RETENTION_DAYS?: string;
}

export interface DevicePrincipal {
  deviceId: string;
  deviceName: string;
  sessionId: string;
}

export interface RequestContext {
  env: Env;
  request: Request;
  url: URL;
  requestId: string;
  principal?: DevicePrincipal;
}

export interface ImageAsset {
  id: string;
  url: string;
  name: string;
  size: number;
  fileName: string;
  mimeType: string;
  byteSize: number;
  width: number | null;
  height: number | null;
  createdAt: number;
}

export interface Note {
  id: string;
  title: string;
  body: string;
  images: ImageAsset[];
  version: number;
  createdAt: number;
  updatedAt: number;
  embeddingStatus: string;
  pinned: boolean;
  archived: boolean;
}

export interface SearchResult extends Note {
  matchType: "lexical" | "semantic";
  /** Lexical rank score, or the best chunk cosine similarity for semantic hits. */
  score: number | null;
  /**
   * Matched body lines for a semantic hit, strongest first. Absent for lexical
   * results, where the client already knows the literal match positions.
   */
  matches?: SearchMatch[];
}

/** One matched line range inside a note, with offsets for in-line highlighting. */
export interface SearchMatch {
  kind: "title" | "body";
  /** 1-based body line to scroll to; null for a title match. */
  lineNumber: number | null;
  /** Zero-based index into `body.split("\n")`; null for a title match. */
  rawLineIndex: number | null;
  lineStart: number | null;
  lineEnd: number | null;
  charStart: number | null;
  charEnd: number | null;
  score: number;
  text: string;
}

export interface NoteChunkRow {
  chunk_id: string;
  note_id: string;
  content_hash: string;
  chunk_index: number;
  kind: "title" | "body";
  primary_line: number | null;
  line_start: number | null;
  line_end: number | null;
  char_start: number | null;
  char_end: number | null;
  /** The exact slice this chunk covers, stored so search never reads bodies. */
  text: string;
  created_at: number;
}

export interface NoteRow {
  rowid: number;
  id: string;
  title: string;
  body: string;
  version: number;
  content_hash: string;
  mutation_id: string | null;
  created_at: number;
  updated_at: number;
  last_opened_at: number | null;
  pinned: number;
  archived: number;
  deleted_at: number | null;
  embedding_status: string;
  embedding_model: string | null;
  embedded_content_hash: string | null;
  embedding_vector_id: string | null;
  embedding_updated_at: number | null;
  embedding_error_code: string | null;
}

export interface ImageRow {
  id: string;
  note_id: string | null;
  uploaded_by_device_id: string;
  object_key: string;
  file_name: string;
  mime_type: string;
  byte_size: number;
  width: number | null;
  height: number | null;
  created_at: number;
}

export type IndexJob = EmbedNoteJob | DeleteVectorJob | DeleteChunksJob;

export interface EmbedNoteJob {
  type: "embed-note";
  eventId: string;
  noteId: string;
  version: number;
  contentHash: string;
  createdAt: number;
}

/** Legacy note-level vector cleanup; retained for in-flight jobs and rollback. */
export interface DeleteVectorJob {
  type: "delete-vector";
  eventId: string;
  noteId: string;
  vectorId: string | null;
  createdAt: number;
}

/** Removes chunk vectors and rows that no longer belong to a live note version. */
export interface DeleteChunksJob {
  type: "delete-chunks";
  eventId: string;
  noteId: string;
  chunkIds: string[];
  /** Chunks of this content hash are kept; everything else for the note goes. */
  keepContentHash: string | null;
  createdAt: number;
}
