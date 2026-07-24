-- Earlier releases could leave D1 rows marked ready after the bound
-- Vectorize index had been recreated or had lost vectors. Queue repair only
-- considered pending/failed/stale rows, so those notes were never embedded
-- again. Requeue every live note once; vector IDs and upserts are idempotent.
-- Keep the old vector reference until the replacement succeeds so deployments
-- against an intact index do not immediately discard usable recall.
UPDATE notes
SET embedding_status = 'pending',
    embedding_error_code = NULL,
    embedding_updated_at = NULL
WHERE deleted_at IS NULL;

UPDATE instance_state
SET value = '4', updated_at = unixepoch() * 1000
WHERE key = 'schema_version';
