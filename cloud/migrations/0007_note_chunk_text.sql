-- Store the matched text with each chunk.
--
-- Resolving a chunk previously joined `notes` and pulled the entire body for
-- every candidate, which dominated query latency once 40 candidates were in
-- play. The indexer already computes the exact slice, so persisting it keeps the
-- query payload proportional to the matched lines instead of the whole corpus.
-- Character offsets stay authoritative for highlighting; this column is the
-- same slice, stored to avoid re-reading the body.
ALTER TABLE note_chunks ADD COLUMN text TEXT NOT NULL DEFAULT '';

-- Backfill by re-indexing: chunk rows are replaced atomically per note.
UPDATE notes
SET embedding_status = 'pending',
    embedding_error_code = NULL
WHERE deleted_at IS NULL;

UPDATE instance_state
SET value = '7', updated_at = unixepoch() * 1000
WHERE key = 'schema_version';
