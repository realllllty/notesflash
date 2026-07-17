import { hmacSha256Base64Url, randomToken } from "./crypto";
import type { Env, ImageAsset, ImageRow, Note, NoteRow } from "./types";

let imageSigningKeyPromise: Promise<string> | null = null;

export async function imageSigningKey(env: Env): Promise<string> {
  if (imageSigningKeyPromise) return imageSigningKeyPromise;

  imageSigningKeyPromise = (async () => {
    const instanceId = await getInstanceId(env);
    if (!instanceId) {
      throw new Error("The NotesFlash instance must be initialized before signing images.");
    }

    const existing = await env.DB.prepare(
      "SELECT value FROM instance_state WHERE key = 'image_signing_key'",
    ).first<{ value: string }>();
    if (existing?.value) return existing.value;

    const candidate = randomToken(32);
    const now = Date.now();
    await env.DB.prepare(
      `INSERT INTO instance_state(key, value, updated_at)
       VALUES ('image_signing_key', ?, ?)
       ON CONFLICT(key) DO NOTHING`,
    )
      .bind(candidate, now)
      .run();

    const stored = await env.DB.prepare(
      "SELECT value FROM instance_state WHERE key = 'image_signing_key'",
    ).first<{ value: string }>();
    if (!stored?.value) throw new Error("Image signing key could not be initialized.");
    return stored.value;
  })().catch((error) => {
    imageSigningKeyPromise = null;
    throw error;
  });

  return imageSigningKeyPromise;
}

export async function imageAccessUrl(env: Env, imageId: string): Promise<string> {
  const secret = await imageSigningKey(env);
  const expires = Date.now() + 24 * 60 * 60 * 1000;
  const signature = await hmacSha256Base64Url(secret, `${imageId}:${expires}`);
  return `/api/images/${encodeURIComponent(imageId)}?expires=${expires}&signature=${encodeURIComponent(signature)}`;
}

export function imageRowToAsset(row: ImageRow, url: string): ImageAsset {
  return {
    id: row.id,
    url,
    name: row.file_name,
    size: row.byte_size,
    fileName: row.file_name,
    mimeType: row.mime_type,
    byteSize: row.byte_size,
    width: row.width,
    height: row.height,
    createdAt: row.created_at,
  };
}

export function noteRowToNote(row: NoteRow, images: ImageAsset[] = []): Note {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    images,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    embeddingStatus: row.embedding_status,
    pinned: row.pinned === 1,
    archived: row.archived === 1,
  };
}

export async function hydrateNotes(env: Env, rows: NoteRow[]): Promise<Note[]> {
  if (rows.length === 0) return [];

  const placeholders = rows.map(() => "?").join(",");
  const imageResult = await env.DB.prepare(
    `SELECT * FROM note_images WHERE note_id IN (${placeholders}) ORDER BY created_at ASC`,
  )
    .bind(...rows.map((row) => row.id))
    .all<ImageRow>();

  const imagesByNote = new Map<string, ImageAsset[]>();
  for (const imageRow of imageResult.results) {
    if (!imageRow.note_id) continue;
    const images = imagesByNote.get(imageRow.note_id) ?? [];
    images.push(imageRowToAsset(imageRow, await imageAccessUrl(env, imageRow.id)));
    imagesByNote.set(imageRow.note_id, images);
  }

  return rows.map((row) => noteRowToNote(row, imagesByNote.get(row.id) ?? []));
}

export async function getNoteRow(env: Env, noteId: string, includeDeleted = false) {
  const deletedClause = includeDeleted ? "" : "AND deleted_at IS NULL";
  return env.DB.prepare(`SELECT * FROM notes WHERE id = ? ${deletedClause}`)
    .bind(noteId)
    .first<NoteRow>();
}

export async function getNote(env: Env, noteId: string, includeDeleted = false) {
  const row = await getNoteRow(env, noteId, includeDeleted);
  if (!row) return null;
  return (await hydrateNotes(env, [row]))[0];
}

export async function getInstanceId(env: Env): Promise<string | null> {
  const row = await env.DB.prepare(
    "SELECT value FROM instance_state WHERE key = 'instance_id'",
  ).first<{ value: string }>();
  return row?.value ?? null;
}

export async function validateImageIds(
  env: Env,
  imageIds: string[],
  deviceId: string,
  noteId?: string,
): Promise<void> {
  const uniqueIds = [...new Set(imageIds)];
  if (uniqueIds.length !== imageIds.length) {
    throw new Error("Duplicate image IDs are not allowed.");
  }
  if (uniqueIds.length === 0) return;

  const placeholders = uniqueIds.map(() => "?").join(",");
  const result = await env.DB.prepare(
    `SELECT id, note_id, uploaded_by_device_id
     FROM note_images
     WHERE id IN (${placeholders})`,
  )
    .bind(...uniqueIds)
    .all<{ id: string; note_id: string | null; uploaded_by_device_id: string }>();

  if (result.results.length !== uniqueIds.length) {
    throw new Error("One or more images do not exist.");
  }

  for (const image of result.results) {
    const belongsToTarget = noteId !== undefined && image.note_id === noteId;
    const isOwnedOrphan = image.note_id === null && image.uploaded_by_device_id === deviceId;
    if (!belongsToTarget && !isOwnedOrphan) {
      throw new Error("An image is already attached to another note.");
    }
  }
}
