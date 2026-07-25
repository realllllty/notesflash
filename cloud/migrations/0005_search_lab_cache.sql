-- Search-lab embedding cache.
--
-- Model/chunking sweeps re-embed the same corpus many times. Caching vectors by
-- (model, mode, text) keeps repeated sweeps nearly free and fast, and lets a
-- calibration run compare strategies without paying Workers AI again. The table
-- is operator-only: nothing in the normal note or search path reads it, and the
-- lab exposes an explicit prune action.
CREATE TABLE lab_embedding_cache (
  cache_key TEXT PRIMARY KEY,
  model TEXT NOT NULL,
  mode TEXT NOT NULL,
  dimensions INTEGER NOT NULL,
  vector TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_lab_embedding_cache_model ON lab_embedding_cache(model, created_at);

UPDATE instance_state
SET value = '5', updated_at = unixepoch() * 1000
WHERE key = 'schema_version';
