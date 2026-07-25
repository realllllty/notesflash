-- Line-level semantic index.
--
-- Semantic search previously embedded a whole note, so one relevant line was
-- diluted by the rest of the note and the API could not report which line
-- matched. Each row here is one indexed chunk anchored to logical body lines,
-- with exact character offsets so the client can highlight the matched span.
--
-- `chunk_id` doubles as the Vectorize vector ID (`<noteId>:<hash6>:<index>`),
-- which keeps re-indexing idempotent and makes stale-vector cleanup precise.
CREATE TABLE note_chunks (
  chunk_id TEXT PRIMARY KEY,
  note_id TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('title', 'body')),
  primary_line INTEGER,
  line_start INTEGER,
  line_end INTEGER,
  char_start INTEGER,
  char_end INTEGER,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE
);

CREATE INDEX idx_note_chunks_note ON note_chunks(note_id, chunk_index);
CREATE INDEX idx_note_chunks_note_hash ON note_chunks(note_id, content_hash);

-- Every live note needs chunk-level vectors, and the old note-level vectors are
-- no longer read. Requeue everything; the queue consumer replaces the chunk
-- rows and vectors for a note atomically.
UPDATE notes
SET embedding_status = 'pending',
    embedding_error_code = NULL,
    embedding_updated_at = NULL
WHERE deleted_at IS NULL;

UPDATE instance_state
SET value = '6', updated_at = unixepoch() * 1000
WHERE key = 'schema_version';
