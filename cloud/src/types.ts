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

export interface TranslationInput {
  text: string;
  source_lang?: string;
  target_lang: string;
}

export interface TranslationOutput {
  translated_text?: string;
}

export interface AiBinding {
  run(model: "@cf/baai/bge-reranker-base", input: RerankerInput): Promise<RerankerOutput>;
  run(model: "@cf/meta/m2m100-1.2b", input: TranslationInput): Promise<TranslationOutput>;
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
  /** Default AI Search namespace; the Worker creates/opens its instance. */
  AI_SEARCH?: AiSearchNamespace;
  INDEX_QUEUE: Queue<IndexJob>;

  INSTANCE_NAME?: string;
  ALLOWED_ORIGINS?: string;
  EMBEDDING_MODEL?: string;
  EMBEDDING_INSTRUCTION?: string;
  SEMANTIC_MIN_COSINE?: string;
  SEMANTIC_RELATIVE_MIN_RATIO?: string;
  /** Enable the two-view consensus rescue for ambiguous short queries. */
  SEMANTIC_SHORT_QUERY_RESCUE?: string;
  SEMANTIC_SHORT_QUERY_MAX_CODEPOINTS?: string;
  SEMANTIC_SHORT_QUERY_MAX_TOKENS?: string;
  SEMANTIC_SHORT_QUERY_RAW_MIN_COSINE?: string;
  SEMANTIC_SHORT_QUERY_EXPANDED_MIN_COSINE?: string;
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
  /** Explicit semantic backend switch; legacy deployments default to Vectorize. */
  SEMANTIC_BACKEND?: string;
  /** Enables background line-item synchronization to Cloudflare AI Search. */
  AI_SEARCH_ENABLED?: string;
  AI_SEARCH_INSTANCE_NAME?: string;
  /** Translate independent zh/en queries before hybrid retrieval. */
  AI_SEARCH_QUERY_TRANSLATION?: string;
  /** Managed query rewrite is intentionally off for independent note queries. */
  AI_SEARCH_QUERY_REWRITE?: string;
  AI_SEARCH_RERANKING?: string;
  AI_SEARCH_MAX_RESULTS?: string;
  AI_SEARCH_MAX_MATCHES_PER_NOTE?: string;
  AI_SEARCH_MAX_ITEMS_PER_NOTE?: string;
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
  /** Lexical rank score, or the selected semantic provider score. */
  score: number | null;
  /**
   * Provider-ranked semantic line matches. Absent for lexical results, where
   * the client already knows the literal match positions.
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
  ai_search_status: string;
  ai_search_indexed_content_hash: string | null;
  ai_search_updated_at: number | null;
  ai_search_error_code: string | null;
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

export type IndexJob =
  | EmbedNoteJob
  | DeleteVectorJob
  | DeleteChunksJob
  | SyncAiSearchNoteJob
  | VerifyAiSearchNoteJob;

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

/** Uploads or removes the current logical-line manifest in Cloudflare AI Search. */
export interface SyncAiSearchNoteJob {
  type: "sync-ai-search-note";
  eventId: string;
  noteId: string;
  version: number;
  contentHash: string;
  createdAt: number;
}

/** Polls asynchronous AI Search item processing without blocking Queue for 30s/item. */
export interface VerifyAiSearchNoteJob {
  type: "verify-ai-search-note";
  eventId: string;
  noteId: string;
  version: number;
  contentHash: string;
  attempt: number;
  createdAt: number;
}

export interface AiSearchItemRow {
  item_key: string;
  item_id: string | null;
  note_id: string;
  note_content_hash: string;
  note_version: number;
  item_index: number;
  kind: "title" | "body";
  raw_line_index: number | null;
  line_number: number | null;
  char_start: number | null;
  char_end: number | null;
  text: string;
  index_text_hash: string;
  sync_state: "pending" | "uploading" | "submitted" | "ready" | "deleting" | "failed";
  provider_status: string | null;
  error_code: string | null;
  /** Durable token fencing one provider upload/recovery/delete operation. */
  upload_token: string | null;
  /** Next official Items-list page to inspect when item_id is missing. */
  provider_scan_page: number;
  /** Observed end-of-list attempts; never treated as proof that item_key is absent. */
  provider_scan_pass: number;
  /** Provider total_count snapshot for the current pass, when available. */
  provider_scan_total_count: number | null;
  created_at: number;
  updated_at: number;
}
