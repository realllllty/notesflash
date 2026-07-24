import { newId } from "./crypto";
import { documentText, embedText } from "./embedding";
import { AppError } from "./http";
import type { EmbedNoteJob, Env, ImageRow, IndexJob, NoteRow } from "./types";

function embeddingErrorCode(error: unknown): string {
  if (error instanceof AppError) return error.code.slice(0, 100);
  if (error && typeof error === "object" && "code" in error) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === "string" || typeof code === "number") return String(code).slice(0, 100);
  }
  return error instanceof Error ? error.name.slice(0, 100) : "UNKNOWN_ERROR";
}

async function processEmbedJob(env: Env, job: EmbedNoteJob): Promise<void> {
  const note = await env.DB.prepare(
    `SELECT * FROM notes
     WHERE id = ? AND version = ? AND content_hash = ? AND deleted_at IS NULL`,
  )
    .bind(job.noteId, job.version, job.contentHash)
    .first<NoteRow>();
  if (!note) return;

  await env.DB.prepare(
    `UPDATE notes SET embedding_status = 'processing', embedding_error_code = NULL,
       embedding_updated_at = ?
     WHERE id = ? AND version = ? AND content_hash = ?`,
  )
    .bind(Date.now(), job.noteId, job.version, job.contentHash)
    .run();

  const vector = await embedText(env, documentText(note.title, note.body));
  const vectorId = `${note.id}:${note.version}:${note.content_hash.slice(0, 12)}`;
  const model = env.EMBEDDING_MODEL ?? "@cf/baai/bge-m3";
  await env.VECTOR_INDEX.upsert([
    {
      id: vectorId,
      values: vector,
      metadata: {
        noteId: note.id,
        version: note.version,
        contentHash: note.content_hash,
        model,
      },
    },
  ]);

  // Queue the previous vector for idempotent cleanup before D1 stops pointing
  // at it. The delete consumer refuses to remove a vector that is still
  // referenced by a live note, so a lost optimistic race remains safe.
  if (note.embedding_vector_id && note.embedding_vector_id !== vectorId) {
    await env.INDEX_QUEUE.send({
      type: "delete-vector",
      eventId: newId(),
      noteId: note.id,
      vectorId: note.embedding_vector_id,
      createdAt: Date.now(),
    });
  }

  const completedAt = Date.now();
  const update = await env.DB.prepare(
    `UPDATE notes SET
       embedding_status = 'ready', embedding_model = ?,
       embedded_content_hash = ?, embedding_vector_id = ?,
       embedding_updated_at = ?, embedding_error_code = NULL
     WHERE id = ? AND version = ? AND content_hash = ? AND deleted_at IS NULL`,
  )
    .bind(model, note.content_hash, vectorId, completedAt, note.id, note.version, note.content_hash)
    .run();

  if ((update.meta.changes ?? 0) !== 1) {
    await env.VECTOR_INDEX.deleteByIds([vectorId]);
    return;
  }

}

async function processJob(env: Env, job: IndexJob): Promise<void> {
  if (job.type === "delete-vector") {
    if (job.vectorId) {
      const liveReference = await env.DB.prepare(
        `SELECT id FROM notes
         WHERE deleted_at IS NULL AND embedding_vector_id = ?
         LIMIT 1`,
      )
        .bind(job.vectorId)
        .first<{ id: string }>();
      if (liveReference) {
        throw new Error(`Vector ${job.vectorId} is still referenced by note ${liveReference.id}.`);
      }
      await env.VECTOR_INDEX.deleteByIds([job.vectorId]);
      await env.DB.prepare(
        `UPDATE notes SET embedding_vector_id = NULL, embedding_status = 'disabled'
         WHERE id = ? AND deleted_at IS NOT NULL AND embedding_vector_id = ?`,
      )
        .bind(job.noteId, job.vectorId)
        .run();
    }
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
  // unavailable. Deleted notes therefore keep their old vector ID until a
  // delete job has been accepted, allowing this scheduled repair path to
  // complete cleanup without a separate operator action.
  const deletedVectors = await env.DB.prepare(
    `SELECT * FROM notes
     WHERE deleted_at IS NOT NULL AND embedding_vector_id IS NOT NULL
     ORDER BY deleted_at ASC
     LIMIT 50`,
  ).all<NoteRow>();
  for (const note of deletedVectors.results) {
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
      console.error("Could not retry deleted vector cleanup", note.id, error);
      break;
    }
  }

  // D1 can outlive or be rebound to a newly-created Vectorize index. In that
  // case every note still says "ready", so the old repair query would never
  // enqueue a replacement and semantic search would stay empty forever. A
  // lower Vectorize count is definitive evidence that at least one live D1
  // reference cannot be represented by the index; requeueing all current rows
  // is idempotent and restores coverage without operator access to note text.
  try {
    const [details, currentReady] = await Promise.all([
      env.VECTOR_INDEX.describe(),
      env.DB.prepare(
        `SELECT COUNT(*) AS count FROM notes
         WHERE deleted_at IS NULL
           AND embedding_status = 'ready'
           AND embedding_model = ?
           AND embedded_content_hash = content_hash
           AND embedding_vector_id IS NOT NULL`,
      )
        .bind(env.EMBEDDING_MODEL ?? "@cf/baai/bge-m3")
        .first<{ count: number }>(),
    ]);
    const detailsRecord = details as unknown as Record<string, unknown>;
    const vectorCount = typeof detailsRecord.vectorCount === "number"
      ? detailsRecord.vectorCount
      : details.vectorsCount ?? 0;
    if (vectorCount < (currentReady?.count ?? 0)) {
      console.warn(
        "Vectorize contains fewer vectors than D1 references; scheduling a semantic rebuild",
        vectorCount,
        currentReady?.count ?? 0,
      );
      await env.DB.prepare(
        `UPDATE notes SET embedding_status = 'pending', embedding_error_code = NULL
         WHERE deleted_at IS NULL
           AND embedding_status = 'ready'
           AND embedding_model = ?
           AND embedded_content_hash = content_hash
           AND embedding_vector_id IS NOT NULL`,
      )
        .bind(env.EMBEDDING_MODEL ?? "@cf/baai/bge-m3")
        .run();
    }
  } catch (error) {
    // Index diagnostics must never prevent normal pending/failed jobs from
    // being retried. search/status exposes the describe failure to operators.
    console.error("Could not verify Vectorize coverage", error);
  }

  const staleBefore = Date.now() - 5 * 60 * 1000;
  const currentModel = env.EMBEDDING_MODEL ?? "@cf/baai/bge-m3";
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
