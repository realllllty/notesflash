import { buildIdentifiedNoteChunks } from "./chunking";
import { newId } from "./crypto";
import { embedTexts } from "./embedding-models";
import { AppError } from "./http";
import { semanticConfig } from "./semantic-config";
import { pruneOrphanChunkVectors } from "./vector-prune";
import type {
  DeleteChunksJob,
  EmbedNoteJob,
  Env,
  ImageRow,
  IndexJob,
  NoteRow,
} from "./types";

/** Vectorize accepts at most 1000 vectors per upsert from a Worker. */
const VECTOR_UPSERT_BATCH = 200;
const D1_STATEMENT_BATCH = 40;

function embeddingErrorCode(error: unknown): string {
  if (error instanceof AppError) return error.code.slice(0, 100);
  if (error && typeof error === "object" && "code" in error) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === "string" || typeof code === "number") return String(code).slice(0, 100);
  }
  return error instanceof Error ? error.name.slice(0, 100) : "UNKNOWN_ERROR";
}

/**
 * Embed one note as line-anchored chunks.
 *
 * Chunk IDs are derived from the note ID and content hash, so re-running a job
 * overwrites the same vectors instead of accumulating duplicates. D1 rows for
 * the note are replaced in a single batch, and vectors that belonged to an
 * older content hash are removed through a separate idempotent job.
 */
async function processEmbedJob(env: Env, job: EmbedNoteJob): Promise<void> {
  const note = await env.DB.prepare(
    `SELECT * FROM notes
     WHERE id = ? AND version = ? AND content_hash = ? AND deleted_at IS NULL`,
  )
    .bind(job.noteId, job.version, job.contentHash)
    .first<NoteRow>();
  if (!note) return;

  const config = semanticConfig(env);
  await env.DB.prepare(
    `UPDATE notes SET embedding_status = 'processing', embedding_error_code = NULL,
       embedding_updated_at = ?
     WHERE id = ? AND version = ? AND content_hash = ?`,
  )
    .bind(Date.now(), job.noteId, job.version, job.contentHash)
    .run();

  const chunks = buildIdentifiedNoteChunks(
    {
      noteId: note.id,
      title: note.title,
      body: note.body,
      contentHash: note.content_hash,
    },
    config.chunking,
  );

  const { vectors } = await embedTexts(
    env,
    config.spec,
    chunks.map((chunk) => chunk.embedText),
    "document",
    config.instruction,
  );

  const upserts = chunks.map((chunk, index) => ({
    id: chunk.chunkId,
    values: vectors[index],
    metadata: {
      noteId: note.id,
      contentHash: note.content_hash,
      model: config.spec.id,
    },
  }));
  for (let offset = 0; offset < upserts.length; offset += VECTOR_UPSERT_BATCH) {
    await env.CHUNK_INDEX.upsert(upserts.slice(offset, offset + VECTOR_UPSERT_BATCH));
  }

  const completedAt = Date.now();
  const statements = [
    env.DB.prepare("DELETE FROM note_chunks WHERE note_id = ?").bind(note.id),
    ...chunks.map((chunk) =>
      env.DB.prepare(
        `INSERT INTO note_chunks(
           chunk_id, note_id, content_hash, chunk_index, kind,
           primary_line, line_start, line_end, char_start, char_end, text, created_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(
        chunk.chunkId,
        note.id,
        note.content_hash,
        chunk.chunkIndex,
        chunk.kind,
        chunk.primaryLine,
        chunk.lineStart,
        chunk.lineEnd,
        chunk.charStart,
        chunk.charEnd,
        chunk.text,
        completedAt,
      )
    ),
  ];
  for (let offset = 0; offset < statements.length; offset += D1_STATEMENT_BATCH) {
    await env.DB.batch(statements.slice(offset, offset + D1_STATEMENT_BATCH));
  }

  const update = await env.DB.prepare(
    `UPDATE notes SET
       embedding_status = 'ready', embedding_model = ?,
       embedded_content_hash = ?, embedding_vector_id = ?,
       embedding_updated_at = ?, embedding_error_code = NULL
     WHERE id = ? AND version = ? AND content_hash = ? AND deleted_at IS NULL`,
  )
    .bind(
      config.spec.id,
      note.content_hash,
      chunks[0]?.chunkId ?? null,
      completedAt,
      note.id,
      note.version,
      note.content_hash,
    )
    .run();

  if ((update.meta.changes ?? 0) !== 1) {
    // The note moved on while this job ran; the newer job owns the index.
    return;
  }

  // Remove vectors from older content hashes only after D1 points at the new
  // chunks, so a lost race can never leave the note unsearchable.
  await enqueueChunkCleanup(env, note.id, note.content_hash);
}

async function enqueueChunkCleanup(
  env: Env,
  noteId: string,
  keepContentHash: string | null,
): Promise<void> {
  try {
    await env.INDEX_QUEUE.send({
      type: "delete-chunks",
      eventId: newId(),
      noteId,
      chunkIds: [],
      keepContentHash,
      createdAt: Date.now(),
    });
  } catch (error) {
    console.error("Could not enqueue chunk cleanup", noteId, error);
  }
}

/**
 * Delete chunk vectors that no longer belong to a live note version.
 *
 * Vectorize has no delete-by-filter, so stale IDs are reconstructed from the
 * chunk rows in D1 plus the explicit ID list carried by the job. Vectors that
 * are still referenced by the note's current content hash are never removed.
 */
async function processDeleteChunksJob(env: Env, job: DeleteChunksJob): Promise<void> {
  const note = await env.DB.prepare(
    "SELECT content_hash, deleted_at FROM notes WHERE id = ?",
  )
    .bind(job.noteId)
    .first<{ content_hash: string; deleted_at: number | null }>();
  const liveHash = note && note.deleted_at === null ? note.content_hash : null;

  const staleRows = (await env.DB.prepare(
    liveHash === null
      ? "SELECT chunk_id FROM note_chunks WHERE note_id = ?"
      : "SELECT chunk_id FROM note_chunks WHERE note_id = ? AND content_hash != ?",
  )
    .bind(...(liveHash === null ? [job.noteId] : [job.noteId, liveHash]))
    .all<{ chunk_id: string }>()).results;

  const explicit = job.chunkIds.filter((id) => id.startsWith(`${job.noteId}:`));
  const staleIds = [...new Set([...staleRows.map((row) => row.chunk_id), ...explicit])]
    .filter((id) => liveHash === null || !id.startsWith(`${job.noteId}:${liveHash.slice(0, 6)}:`));
  if (staleIds.length === 0) return;

  for (let offset = 0; offset < staleIds.length; offset += VECTOR_UPSERT_BATCH) {
    await env.CHUNK_INDEX.deleteByIds(staleIds.slice(offset, offset + VECTOR_UPSERT_BATCH));
  }

  const deletions = staleIds.map((id) =>
    env.DB.prepare("DELETE FROM note_chunks WHERE chunk_id = ?").bind(id)
  );
  for (let offset = 0; offset < deletions.length; offset += D1_STATEMENT_BATCH) {
    await env.DB.batch(deletions.slice(offset, offset + D1_STATEMENT_BATCH));
  }

  if (liveHash === null) {
    await env.DB.prepare(
      `UPDATE notes SET embedding_vector_id = NULL, embedding_status = 'disabled'
       WHERE id = ? AND deleted_at IS NOT NULL`,
    )
      .bind(job.noteId)
      .run();
  }
}

async function processJob(env: Env, job: IndexJob): Promise<void> {
  if (job.type === "delete-chunks") {
    await processDeleteChunksJob(env, job);
    return;
  }
  if (job.type === "delete-vector") {
    // Legacy note-level vector cleanup. Deleting a note now also removes its
    // chunk vectors, so both paths run for jobs queued before the upgrade.
    if (job.vectorId) {
      const liveReference = await env.DB.prepare(
        `SELECT id FROM notes
         WHERE deleted_at IS NULL AND embedding_vector_id = ?
         LIMIT 1`,
      )
        .bind(job.vectorId)
        .first<{ id: string }>();
      if (!liveReference) {
        try {
          await env.VECTOR_INDEX.deleteByIds([job.vectorId]);
        } catch (error) {
          console.warn("Legacy vector cleanup failed", job.vectorId, error);
        }
      }
    }
    await processDeleteChunksJob(env, {
      type: "delete-chunks",
      eventId: job.eventId,
      noteId: job.noteId,
      chunkIds: [],
      keepContentHash: null,
      createdAt: job.createdAt,
    });
    return;
  }
  await processEmbedJob(env, job);
}

export async function consumeIndexQueue(batch: MessageBatch<IndexJob>, env: Env): Promise<void> {
  for (const message of batch.messages) {
    try {
      await processJob(env, message.body);
      message.ack();
    } catch (error) {
      console.error("Index queue job failed", message.id, error);
      if (message.body.type === "embed-note") {
        await env.DB.prepare(
          `UPDATE notes SET embedding_status = 'failed', embedding_error_code = ?
           WHERE id = ? AND version = ? AND content_hash = ?`,
        )
          .bind(
            embeddingErrorCode(error),
            message.body.noteId,
            message.body.version,
            message.body.contentHash,
          )
          .run();
      }
      message.retry();
    }
  }
}

export async function retryPendingIndexes(env: Env): Promise<void> {
  const now = Date.now();
  await env.DB.batch([
    env.DB.prepare("DELETE FROM pairing_codes WHERE expires_at < ?").bind(now - 24 * 60 * 60 * 1000),
    env.DB.prepare("DELETE FROM device_sessions WHERE expires_at < ? OR revoked_at IS NOT NULL").bind(now),
    env.DB.prepare(
      `DELETE FROM idempotency_keys WHERE created_at < ?`,
    ).bind(now - 7 * 24 * 60 * 60 * 1000),
    env.DB.prepare("DELETE FROM rate_limit_windows WHERE expires_at < ?").bind(now),
  ]);

  // Images are uploaded before a note save so the client can preview them.
  // Remove abandoned or explicitly detached uploads after a grace period.
  const orphanImages = await env.DB.prepare(
    `SELECT * FROM note_images
     WHERE note_id IS NULL AND created_at < ?
     ORDER BY created_at ASC
     LIMIT 50`,
  )
    .bind(now - 24 * 60 * 60 * 1000)
    .all<ImageRow>();
  for (const image of orphanImages.results) {
    await env.IMAGES.delete(image.object_key);
    await env.DB.prepare("DELETE FROM note_images WHERE id = ? AND note_id IS NULL")
      .bind(image.id)
      .run();
  }

  const retentionDays = Math.min(
    Math.max(Number.parseInt(env.TRASH_RETENTION_DAYS ?? "30", 10) || 30, 1),
    3650,
  );
  const expiredDeletedNotes = await env.DB.prepare(
    `SELECT * FROM notes
     WHERE deleted_at IS NOT NULL
       AND deleted_at < ?
       AND embedding_vector_id IS NULL
       AND NOT EXISTS (SELECT 1 FROM note_chunks c WHERE c.note_id = notes.id)
     ORDER BY deleted_at ASC
     LIMIT 20`,
  )
    .bind(now - retentionDays * 24 * 60 * 60 * 1000)
    .all<NoteRow>();
  for (const note of expiredDeletedNotes.results) {
    const images = await env.DB.prepare("SELECT * FROM note_images WHERE note_id = ?")
      .bind(note.id)
      .all<ImageRow>();
    for (const image of images.results) await env.IMAGES.delete(image.object_key);
    await env.DB.batch([
      env.DB.prepare("DELETE FROM note_images WHERE note_id = ?").bind(note.id),
      env.DB.prepare("DELETE FROM notes WHERE id = ? AND deleted_at IS NOT NULL").bind(note.id),
    ]);
  }

  // A note mutation is never failed merely because Queue is temporarily
  // unavailable. Deleted notes therefore keep their chunk rows until a delete
  // job has been accepted, allowing this scheduled repair path to complete
  // cleanup without a separate operator action.
  const deletedWithChunks = await env.DB.prepare(
    `SELECT DISTINCT n.id AS id
     FROM notes n
     JOIN note_chunks c ON c.note_id = n.id
     WHERE n.deleted_at IS NOT NULL
     ORDER BY n.deleted_at ASC
     LIMIT 50`,
  ).all<{ id: string }>();
  for (const note of deletedWithChunks.results) {
    try {
      await env.INDEX_QUEUE.send({
        type: "delete-chunks",
        eventId: newId(),
        noteId: note.id,
        chunkIds: [],
        keepContentHash: null,
        createdAt: now,
      });
    } catch (error) {
      console.error("Could not retry deleted chunk cleanup", note.id, error);
      break;
    }
  }

  // Legacy note-level vectors from before chunk indexing still need removal.
  const legacyVectors = await env.DB.prepare(
    `SELECT * FROM notes
     WHERE deleted_at IS NOT NULL AND embedding_vector_id IS NOT NULL
     ORDER BY deleted_at ASC
     LIMIT 50`,
  ).all<NoteRow>();
  for (const note of legacyVectors.results) {
    const vectorId = note.embedding_vector_id;
    if (!vectorId) continue;
    try {
      await env.INDEX_QUEUE.send({
        type: "delete-vector",
        eventId: newId(),
        noteId: note.id,
        vectorId,
        createdAt: now,
      });
    } catch (error) {
      console.error("Could not retry legacy vector cleanup", note.id, error);
      break;
    }
  }

  // D1 can outlive or be rebound to a newly-created Vectorize index. In that
  // case every note still says "ready", so the repair query below would never
  // enqueue a replacement and semantic search would stay empty forever. Fewer
  // vectors than current chunk rows is definitive evidence that the index
  // cannot answer for every live line; requeueing is idempotent.
  const currentModel = semanticConfig(env).spec.id;
  try {
    const [details, currentChunks] = await Promise.all([
      env.CHUNK_INDEX.describe(),
      env.DB.prepare(
        `SELECT COUNT(*) AS count
         FROM note_chunks c
         JOIN notes n ON n.id = c.note_id
         WHERE n.deleted_at IS NULL AND n.content_hash = c.content_hash`,
      ).first<{ count: number }>(),
    ]);
    const detailsRecord = details as unknown as Record<string, unknown>;
    const vectorCount = typeof detailsRecord.vectorCount === "number"
      ? detailsRecord.vectorCount
      : details.vectorsCount ?? 0;
    if (vectorCount < (currentChunks?.count ?? 0)) {
      console.warn(
        "Vectorize contains fewer vectors than D1 chunk rows; scheduling a semantic rebuild",
        vectorCount,
        currentChunks?.count ?? 0,
      );
      await env.DB.prepare(
        `UPDATE notes SET embedding_status = 'pending', embedding_error_code = NULL
         WHERE deleted_at IS NULL
           AND embedding_status = 'ready'
           AND embedding_model = ?
           AND embedded_content_hash = content_hash`,
      )
        .bind(currentModel)
        .run();
    }
  } catch (error) {
    // Index diagnostics must never prevent normal pending/failed jobs from
    // being retried. search/status exposes the describe failure to operators.
    console.error("Could not verify Vectorize coverage", error);
  }

  // A hard-deleted note takes its chunk rows with it, so a vector can outlive
  // every reference to it. Left alone, orphans consume candidate slots in each
  // query; this bounded pass removes the ones a probe can reach.
  try {
    const result = await pruneOrphanChunkVectors(env, semanticConfig(env).spec);
    if (result.deleted > 0) {
      console.warn("Removed orphan chunk vectors", result.deleted, "of", result.inspected);
    }
  } catch (error) {
    console.error("Orphan vector pruning failed", error);
  }

  const staleBefore = Date.now() - 5 * 60 * 1000;
  const result = await env.DB.prepare(
    `SELECT id, version, content_hash FROM notes
     WHERE deleted_at IS NULL
       AND (
         embedding_status = 'pending'
         OR (embedding_status = 'failed' AND updated_at < ?)
         OR (embedding_status = 'processing' AND COALESCE(embedding_updated_at, 0) < ?)
         OR (
           embedding_status = 'ready'
           AND (
             embedding_model IS NULL
             OR embedding_model != ?
             OR embedded_content_hash IS NULL
             OR embedded_content_hash != content_hash
             OR NOT EXISTS (
               SELECT 1 FROM note_chunks c
               WHERE c.note_id = notes.id AND c.content_hash = notes.content_hash
             )
           )
         )
       )
     ORDER BY updated_at ASC
     LIMIT 500`,
  )
    .bind(staleBefore, staleBefore, currentModel)
    .all<Pick<NoteRow, "id" | "version" | "content_hash">>();

  if (result.results.length === 0) return;
  // Queue sendBatch accepts at most 100 messages. Selecting only identifiers
  // above keeps a large repair pass cheap even when note bodies are large.
  for (let offset = 0; offset < result.results.length; offset += 100) {
    const chunk = result.results.slice(offset, offset + 100);
    await env.INDEX_QUEUE.sendBatch(
      chunk.map((note) => ({
        body: {
          type: "embed-note" as const,
          eventId: newId(),
          noteId: note.id,
          version: note.version,
          contentHash: note.content_hash,
          createdAt: Date.now(),
        },
      })),
    );
  }
}
