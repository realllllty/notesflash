export interface AiBinding {
  run(model: string, input: Record<string, unknown>): Promise<unknown>;
}

export interface Env {
  DB: D1Database;
  IMAGES: R2Bucket;
  VECTOR_INDEX: VectorizeIndex;
  AI: AiBinding;
  INDEX_QUEUE: Queue<IndexJob>;

  INSTANCE_NAME?: string;
  ALLOWED_ORIGINS?: string;
  EMBEDDING_MODEL?: string;
  EMBEDDING_DIMENSIONS?: string;
  SEMANTIC_MIN_SCORE?: string;
  SEMANTIC_TOP_K?: string;
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
  score: number | null;
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

export type IndexJob = EmbedNoteJob | DeleteVectorJob;

export interface EmbedNoteJob {
  type: "embed-note";
  eventId: string;
  noteId: string;
  version: number;
  contentHash: string;
  createdAt: number;
}

export interface DeleteVectorJob {
  type: "delete-vector";
  eventId: string;
  noteId: string;
  vectorId: string | null;
  createdAt: number;
}
