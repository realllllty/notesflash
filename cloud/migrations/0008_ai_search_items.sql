-- Cloudflare AI Search is an independent semantic index. D1 remains the
-- canonical note store and the existing Vectorize columns stay intact so an
-- operator can switch back without rebuilding the application database.
ALTER TABLE notes ADD COLUMN ai_search_status TEXT NOT NULL DEFAULT 'pending'
  CHECK (ai_search_status IN ('pending', 'processing', 'ready', 'failed', 'disabled'));
ALTER TABLE notes ADD COLUMN ai_search_indexed_content_hash TEXT;
ALTER TABLE notes ADD COLUMN ai_search_updated_at INTEGER;
ALTER TABLE notes ADD COLUMN ai_search_error_code TEXT;

CREATE INDEX idx_notes_ai_search_status
ON notes(ai_search_status, ai_search_updated_at);

-- AI Search deletes items by its internal item ID, not by the filename/key
-- used when uploading. Keep the provider ID and the exact D1 line anchor so a
-- stale or eventually-consistent provider result can always be rejected.
CREATE TABLE ai_search_items (
  item_key TEXT PRIMARY KEY,
  item_id TEXT UNIQUE,
  note_id TEXT NOT NULL,
  note_content_hash TEXT NOT NULL,
  note_version INTEGER NOT NULL,
  item_index INTEGER NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('title', 'body')),
  raw_line_index INTEGER,
  line_number INTEGER,
  char_start INTEGER,
  char_end INTEGER,
  text TEXT NOT NULL,
  index_text_hash TEXT NOT NULL,
  sync_state TEXT NOT NULL DEFAULT 'pending'
    CHECK (sync_state IN ('pending', 'uploading', 'submitted', 'ready', 'deleting', 'failed')),
  provider_status TEXT,
  error_code TEXT,
  -- Durable per-key fence. Cleanup never removes a row while a recent upload
  -- token can still own an in-flight provider write.
  upload_token TEXT,
  -- The Workers Items binding has no exact-key lookup. If an upload succeeds
  -- before its provider ID reaches D1, retries resume an official paginated
  -- list scan from these fields instead of relying on an undocumented filter.
  provider_scan_page INTEGER NOT NULL DEFAULT 1 CHECK (provider_scan_page >= 1),
  provider_scan_pass INTEGER NOT NULL DEFAULT 0 CHECK (provider_scan_pass >= 0),
  provider_scan_total_count INTEGER CHECK (
    provider_scan_total_count IS NULL OR provider_scan_total_count >= 0
  ),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE
);

CREATE INDEX idx_ai_search_items_note
ON ai_search_items(note_id, note_content_hash, item_index);

CREATE INDEX idx_ai_search_items_sync
ON ai_search_items(sync_state, updated_at);

UPDATE notes
SET ai_search_status = CASE WHEN deleted_at IS NULL THEN 'pending' ELSE 'disabled' END,
    ai_search_indexed_content_hash = NULL,
    ai_search_updated_at = NULL,
    ai_search_error_code = NULL;

UPDATE instance_state
SET value = '8', updated_at = unixepoch() * 1000
WHERE key = 'schema_version';
