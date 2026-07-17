import { contentHash, newId } from "./crypto";
import { getNote, getNoteRow, hydrateNotes, validateImageIds } from "./db";
import {
  AppError,
  json,
  readJson,
  requireInteger,
  requirePrincipal,
  requireString,
} from "./http";
import type { EmbedNoteJob, IndexJob, NoteRow, RequestContext } from "./types";

interface CreateNoteBody {
  title?: unknown;
  body?: unknown;
  imageIds?: unknown;
}

interface UpdateNoteBody extends CreateNoteBody {
  baseVersion?: unknown;
  pinned?: unknown;
  archived?: unknown;
}

function parseImageIds(value: unknown): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 50 || value.some((id) => typeof id !== "string")) {
    throw new AppError(400, "INVALID_IMAGE_IDS", "imageIds must be an array of at most 50 IDs.");
  }
  return value as string[];
}

async function tryEnqueueIndexJob(
  context: RequestContext,
  job: IndexJob,
): Promise<boolean> {
  try {
    await context.env.INDEX_QUEUE.send(job);
    return true;
  } catch (error) {
    // D1 is the source of truth. A Queue outage must not turn a committed note
    // mutation into a misleading HTTP 500. Pending embeddings are retried by
    // the scheduled repair job; deleted vectors retain their ID for the same
    // repair path until a delete job has been accepted by Queue.
    console.error("Could not enqueue index job", context.requestId, job.type, job.noteId, error);
    return false;
  }
}

async function enqueueEmbedding(
  context: RequestContext,
  noteId: string,
  version: number,
  hash: string,
): Promise<boolean> {
  const job: EmbedNoteJob = {
    type: "embed-note",
    eventId: newId(),
    noteId,
    version,
    contentHash: hash,
    createdAt: Date.now(),
  };
  return tryEnqueueIndexJob(context, job);
}

async function safelyValidateImages(
  context: RequestContext,
  imageIds: string[],
  noteId?: string,
): Promise<void> {
  const principal = requirePrincipal(context);
  try {
    await validateImageIds(context.env, imageIds, principal.deviceId, noteId);
  } catch (error) {
    throw new AppError(
      400,
      "INVALID_IMAGE_IDS",
      error instanceof Error ? error.message : "The image list is invalid.",
    );
  }
}

export async function listNotes(context: RequestContext): Promise<Response> {
  requirePrincipal(context);
  const limit = Math.min(Math.max(Number.parseInt(context.url.searchParams.get("limit") ?? "50", 10) || 50, 1), 100);
  const offset = Math.max(Number.parseInt(context.url.searchParams.get("offset") ?? "0", 10) || 0, 0);
  const sort = context.url.searchParams.get("sort") ?? "updated_desc";

  const orderBy: Record<string, string> = {
    updated_desc: "updated_at DESC, id DESC",
    updated_asc: "updated_at ASC, id ASC",
    created_desc: "created_at DESC, id DESC",
    created_asc: "created_at ASC, id ASC",
    title_asc: "title COLLATE NOCASE ASC, id ASC",
    title_desc: "title COLLATE NOCASE DESC, id DESC",
  };
  const order = orderBy[sort] ?? orderBy.updated_desc;

  const result = await context.env.DB.prepare(
    `SELECT * FROM notes
     WHERE deleted_at IS NULL
     ORDER BY pinned DESC, ${order}
     LIMIT ? OFFSET ?`,
  )
    .bind(limit, offset)
    .all<NoteRow>();

  const notes = await hydrateNotes(context.env, result.results);
  return json({ notes, nextOffset: notes.length === limit ? offset + limit : null });
}

export async function createNote(context: RequestContext): Promise<Response> {
  const principal = requirePrincipal(context);
  const body = await readJson<CreateNoteBody>(context.request);
  const title = requireString(body.title ?? "未命名笔记", "title", {
    min: 1,
    max: 500,
  });
  const noteBody = requireString(body.body ?? "", "body", {
    max: 2_000_000,
    allowEmpty: true,
  });
  const imageIds = parseImageIds(body.imageIds);
  await safelyValidateImages(context, imageIds);

  const idempotencyKey = context.request.headers.get("idempotency-key");
  if (idempotencyKey) {
    if (idempotencyKey.length > 200) {
      throw new AppError(400, "INVALID_IDEMPOTENCY_KEY", "Idempotency-Key is too long.");
    }
    const prior = await context.env.DB.prepare(
      `SELECT resource_id FROM idempotency_keys
       WHERE key = ? AND device_id = ? AND operation = 'create-note'`,
    )
      .bind(idempotencyKey, principal.deviceId)
      .first<{ resource_id: string }>();
    if (prior) {
      const priorNote = await getNote(context.env, prior.resource_id);
      if (priorNote) return json({ note: priorNote });
    }
  }

  const now = Date.now();
  const noteId = newId();
  const hash = await contentHash(title, noteBody);
  const statements = [
    context.env.DB.prepare(
      `INSERT INTO notes(
         id, title, body, version, content_hash, created_at, updated_at, embedding_status
       ) VALUES (?, ?, ?, 1, ?, ?, ?, 'pending')`,
    ).bind(noteId, title, noteBody, hash, now, now),
  ];

  if (idempotencyKey) {
    statements.push(
      context.env.DB.prepare(
        `INSERT INTO idempotency_keys(key, device_id, operation, resource_id, created_at)
         VALUES (?, ?, 'create-note', ?, ?)`,
      ).bind(idempotencyKey, principal.deviceId, noteId, now),
    );
  }
  for (const imageId of imageIds) {
    statements.push(
      context.env.DB.prepare(
        `UPDATE note_images SET note_id = ?
         WHERE id = ? AND note_id IS NULL AND uploaded_by_device_id = ?`,
      ).bind(noteId, imageId, principal.deviceId),
    );
  }

  await context.env.DB.batch(statements);
  await enqueueEmbedding(context, noteId, 1, hash);
  const note = await getNote(context.env, noteId);
  return json({ note }, 201);
}

export async function getNoteHandler(context: RequestContext, noteId: string): Promise<Response> {
  requirePrincipal(context);
  const note = await getNote(context.env, noteId);
  if (!note) throw new AppError(404, "NOTE_NOT_FOUND", "The note was not found.");

  await context.env.DB.prepare("UPDATE notes SET last_opened_at = ? WHERE id = ?")
    .bind(Date.now(), noteId)
    .run();
  return json({ note });
}

export async function updateNote(context: RequestContext, noteId: string): Promise<Response> {
  const principal = requirePrincipal(context);
  const body = await readJson<UpdateNoteBody>(context.request);
  const baseVersion = requireInteger(body.baseVersion, "baseVersion", 1);
  const current = await getNoteRow(context.env, noteId);
  if (!current) throw new AppError(404, "NOTE_NOT_FOUND", "The note was not found.");

  const title =
    body.title === undefined
      ? current.title
      : requireString(body.title, "title", { min: 1, max: 500 });
  const noteBody =
    body.body === undefined
      ? current.body
      : requireString(body.body, "body", { max: 2_000_000, allowEmpty: true });
  const pinned = body.pinned === undefined ? current.pinned === 1 : body.pinned === true;
  const archived = body.archived === undefined ? current.archived === 1 : body.archived === true;
  if (body.pinned !== undefined && typeof body.pinned !== "boolean") {
    throw new AppError(400, "INVALID_INPUT", "pinned must be a boolean.");
  }
  if (body.archived !== undefined && typeof body.archived !== "boolean") {
    throw new AppError(400, "INVALID_INPUT", "archived must be a boolean.");
  }

  const imageIds = body.imageIds === undefined ? undefined : parseImageIds(body.imageIds);
  if (imageIds) await safelyValidateImages(context, imageIds, noteId);

  const nextVersion = baseVersion + 1;
  const hash = await contentHash(title, noteBody);
  const now = Date.now();
  const mutationId = newId();
  const statements = [
    context.env.DB.prepare(
      `UPDATE notes SET
         title = ?, body = ?, pinned = ?, archived = ?,
         version = version + 1, content_hash = ?, updated_at = ?, mutation_id = ?,
         embedding_status = CASE
           WHEN content_hash = ? THEN embedding_status
           ELSE 'pending'
         END,
         embedding_error_code = CASE
           WHEN content_hash = ? THEN embedding_error_code
           ELSE NULL
         END
       WHERE id = ? AND version = ? AND deleted_at IS NULL`,
    ).bind(
      title,
      noteBody,
      pinned ? 1 : 0,
      archived ? 1 : 0,
      hash,
      now,
      mutationId,
      hash,
      hash,
      noteId,
      baseVersion,
    ),
  ];

  if (imageIds) {
    statements.push(
      imageIds.length === 0
        ? context.env.DB.prepare(
            `UPDATE note_images SET note_id = NULL
             WHERE note_id = ?
               AND EXISTS (
                 SELECT 1 FROM notes
                 WHERE id = ? AND version = ? AND mutation_id = ?
               )`,
          ).bind(noteId, noteId, nextVersion, mutationId)
        : context.env.DB.prepare(
            `UPDATE note_images SET note_id = NULL
             WHERE note_id = ? AND id NOT IN (${imageIds.map(() => "?").join(",")})
               AND EXISTS (
                 SELECT 1 FROM notes
                 WHERE id = ? AND version = ? AND mutation_id = ?
               )`,
          ).bind(noteId, ...imageIds, noteId, nextVersion, mutationId),
      ...imageIds.map((imageId) =>
        context.env.DB.prepare(
          `UPDATE note_images SET note_id = ?
           WHERE id = ? AND (note_id IS NULL OR note_id = ?)
             AND EXISTS (
               SELECT 1 FROM notes
               WHERE id = ? AND version = ? AND mutation_id = ?
             )`,
        ).bind(noteId, imageId, noteId, noteId, nextVersion, mutationId),
      ),
    );
  }

  // D1 batch is transactional, so the optimistic note version and its image
  // relationships either advance together or not at all.
  const [result] = await context.env.DB.batch(statements);

  // FTS triggers add their own row changes, so success can report more than one.
  if ((result.meta.changes ?? 0) < 1) {
    const serverNote = await getNote(context.env, noteId);
    throw new AppError(
      409,
      "VERSION_CONFLICT",
      "The note was changed by another device.",
      { serverNote, clientBaseVersion: baseVersion },
    );
  }

  if (hash !== current.content_hash) {
    await enqueueEmbedding(context, noteId, nextVersion, hash);
  }
  const note = await getNote(context.env, noteId);
  return json({ note });
}

export async function deleteNote(context: RequestContext, noteId: string): Promise<Response> {
  requirePrincipal(context);
  const baseVersion = Number.parseInt(context.url.searchParams.get("baseVersion") ?? "", 10);
  if (!Number.isInteger(baseVersion) || baseVersion < 1) {
    throw new AppError(400, "INVALID_INPUT", "baseVersion query parameter is required.");
  }
  const current = await getNoteRow(context.env, noteId);
  if (!current) throw new AppError(404, "NOTE_NOT_FOUND", "The note was not found.");

  const now = Date.now();
  const result = await context.env.DB.prepare(
    `UPDATE notes
     SET deleted_at = ?, updated_at = ?, version = version + 1
     WHERE id = ? AND version = ? AND deleted_at IS NULL`,
  )
    .bind(now, now, noteId, baseVersion)
    .run();
  if ((result.meta.changes ?? 0) < 1) {
    throw new AppError(409, "VERSION_CONFLICT", "The note was changed by another device.");
  }

  await tryEnqueueIndexJob(context, {
    type: "delete-vector",
    eventId: newId(),
    noteId,
    vectorId: current.embedding_vector_id,
    createdAt: now,
  });
  return json({ ok: true });
}

export async function restoreNote(context: RequestContext, noteId: string): Promise<Response> {
  requirePrincipal(context);
  const current = await getNoteRow(context.env, noteId, true);
  if (!current || current.deleted_at === null) {
    throw new AppError(404, "DELETED_NOTE_NOT_FOUND", "The deleted note was not found.");
  }
  const now = Date.now();
  const result = await context.env.DB.prepare(
    `UPDATE notes SET
       deleted_at = NULL, updated_at = ?, version = version + 1, embedding_status = 'pending'
     WHERE id = ? AND deleted_at IS NOT NULL`,
  )
    .bind(now, noteId)
    .run();
  if ((result.meta.changes ?? 0) < 1) {
    throw new AppError(409, "RESTORE_CONFLICT", "The note could not be restored.");
  }
  await enqueueEmbedding(context, noteId, current.version + 1, current.content_hash);
  return json({ note: await getNote(context.env, noteId) });
}
