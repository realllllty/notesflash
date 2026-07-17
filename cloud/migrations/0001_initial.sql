PRAGMA foreign_keys = ON;

CREATE TABLE instance_state (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE devices (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  platform TEXT NOT NULL DEFAULT 'unknown',
  public_key TEXT,
  created_at INTEGER NOT NULL,
  last_seen_at INTEGER,
  revoked_at INTEGER
);

CREATE TABLE device_sessions (
  id TEXT PRIMARY KEY,
  device_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  revoked_at INTEGER,
  FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
);

CREATE INDEX idx_device_sessions_device ON device_sessions(device_id);
CREATE INDEX idx_device_sessions_expiry ON device_sessions(expires_at);

CREATE TABLE pairing_codes (
  id TEXT PRIMARY KEY,
  code_hash TEXT NOT NULL UNIQUE,
  created_by_device_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  used_at INTEGER,
  used_by_device_id TEXT,
  FOREIGN KEY (created_by_device_id) REFERENCES devices(id),
  FOREIGN KEY (used_by_device_id) REFERENCES devices(id)
);

CREATE INDEX idx_pairing_codes_expiry ON pairing_codes(expires_at);

CREATE TABLE notes (
  rowid INTEGER PRIMARY KEY AUTOINCREMENT,
  id TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  version INTEGER NOT NULL DEFAULT 1,
  content_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  last_opened_at INTEGER,
  pinned INTEGER NOT NULL DEFAULT 0,
  archived INTEGER NOT NULL DEFAULT 0,
  deleted_at INTEGER,
  embedding_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (embedding_status IN ('pending', 'processing', 'ready', 'failed', 'disabled')),
  embedding_model TEXT,
  embedded_content_hash TEXT,
  embedding_vector_id TEXT,
  embedding_updated_at INTEGER,
  embedding_error_code TEXT
);

CREATE INDEX idx_notes_updated ON notes(deleted_at, updated_at DESC);
CREATE INDEX idx_notes_created ON notes(deleted_at, created_at DESC);
CREATE INDEX idx_notes_title ON notes(deleted_at, title COLLATE NOCASE);
CREATE INDEX idx_notes_embedding_status ON notes(embedding_status, updated_at);

CREATE TABLE note_images (
  id TEXT PRIMARY KEY,
  note_id TEXT,
  uploaded_by_device_id TEXT NOT NULL,
  object_key TEXT NOT NULL UNIQUE,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  byte_size INTEGER NOT NULL,
  width INTEGER,
  height INTEGER,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE SET NULL,
  FOREIGN KEY (uploaded_by_device_id) REFERENCES devices(id)
);

CREATE INDEX idx_note_images_note ON note_images(note_id, created_at);
CREATE INDEX idx_note_images_orphan ON note_images(note_id, created_at);

CREATE TABLE idempotency_keys (
  key TEXT PRIMARY KEY,
  device_id TEXT NOT NULL,
  operation TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (device_id) REFERENCES devices(id)
);

-- The trigram tokenizer gives useful substring matching for Chinese and mixed
-- text. Runtime search catches any FTS error and safely falls back to instr().
CREATE VIRTUAL TABLE notes_fts USING fts5(
  title,
  body,
  content='notes',
  content_rowid='rowid',
  tokenize='trigram'
);

CREATE TRIGGER notes_fts_insert AFTER INSERT ON notes
WHEN new.deleted_at IS NULL
BEGIN
  INSERT INTO notes_fts(rowid, title, body)
  VALUES (new.rowid, new.title, new.body);
END;

CREATE TRIGGER notes_fts_delete AFTER DELETE ON notes
WHEN old.deleted_at IS NULL
BEGIN
  INSERT INTO notes_fts(notes_fts, rowid, title, body)
  VALUES ('delete', old.rowid, old.title, old.body);
END;

CREATE TRIGGER notes_fts_update AFTER UPDATE OF title, body, deleted_at ON notes
BEGIN
  INSERT INTO notes_fts(notes_fts, rowid, title, body)
  SELECT 'delete', old.rowid, old.title, old.body
  WHERE old.deleted_at IS NULL;

  INSERT INTO notes_fts(rowid, title, body)
  SELECT new.rowid, new.title, new.body
  WHERE new.deleted_at IS NULL;
END;

INSERT INTO instance_state(key, value, updated_at)
VALUES ('schema_version', '1', unixepoch() * 1000);
