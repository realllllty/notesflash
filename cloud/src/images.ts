import { constantTimeEqual, hmacSha256Base64Url, newId } from "./crypto";
import { getInstanceId, imageAccessUrl, imageRowToAsset, imageSigningKey } from "./db";
import { AppError, json, requirePrincipal } from "./http";
import type { ImageRow, RequestContext } from "./types";

const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
]);

function safeFileName(name: string): string {
  const normalized = name.normalize("NFKC").replace(/[\u0000-\u001f\u007f/\\]/g, "_").trim();
  return (normalized || "image").slice(0, 180);
}

export async function uploadImage(context: RequestContext): Promise<Response> {
  const principal = requirePrincipal(context);
  const contentType = context.request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("multipart/form-data")) {
    throw new AppError(415, "MULTIPART_REQUIRED", "Upload the image as multipart field 'file'.");
  }

  const form = await context.request.formData();
  const value = form.get("file");
  if (!(value instanceof File)) {
    throw new AppError(400, "IMAGE_REQUIRED", "Multipart field 'file' must contain an image.");
  }
  if (!ALLOWED_IMAGE_TYPES.has(value.type.toLowerCase())) {
    throw new AppError(415, "UNSUPPORTED_IMAGE_TYPE", "Use JPEG, PNG, WebP, GIF, or AVIF.");
  }

  const maximum = Math.max(Number.parseInt(context.env.MAX_IMAGE_BYTES ?? "12582912", 10), 1);
  if (value.size <= 0 || value.size > maximum) {
    throw new AppError(413, "IMAGE_TOO_LARGE", `The image must be no larger than ${maximum} bytes.`);
  }

  const imageId = newId();
  const fileName = safeFileName(value.name);
  const objectKey = `images/${principal.deviceId}/${imageId}`;
  const bytes = await value.arrayBuffer();
  await context.env.IMAGES.put(objectKey, bytes, {
    httpMetadata: { contentType: value.type },
    customMetadata: {
      imageId,
      originalFileName: fileName,
      uploadedByDeviceId: principal.deviceId,
    },
  });

  const now = Date.now();
  try {
    await context.env.DB.prepare(
      `INSERT INTO note_images(
         id, note_id, uploaded_by_device_id, object_key, file_name,
         mime_type, byte_size, created_at
       ) VALUES (?, NULL, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(imageId, principal.deviceId, objectKey, fileName, value.type, value.size, now)
      .run();
  } catch (error) {
    await context.env.IMAGES.delete(objectKey);
    throw error;
  }

  const row: ImageRow = {
    id: imageId,
    note_id: null,
    uploaded_by_device_id: principal.deviceId,
    object_key: objectKey,
    file_name: fileName,
    mime_type: value.type,
    byte_size: value.size,
    width: null,
    height: null,
    created_at: now,
  };
  const asset = imageRowToAsset(row, await imageAccessUrl(context.env, imageId));
  return json({ image: asset }, 201);
}

export async function getImage(context: RequestContext, imageId: string): Promise<Response> {
  if (!context.principal) {
    if (!(await getInstanceId(context.env))) {
      throw new AppError(401, "IMAGE_AUTH_REQUIRED", "A valid image signature is required.");
    }
    const expires = Number.parseInt(context.url.searchParams.get("expires") ?? "", 10);
    const signature = context.url.searchParams.get("signature") ?? "";
    const secret = await imageSigningKey(context.env);
    if (
      !Number.isFinite(expires) ||
      expires < Date.now() ||
      expires > Date.now() + 25 * 60 * 60 * 1000
    ) {
      throw new AppError(401, "IMAGE_AUTH_REQUIRED", "This image URL is missing or expired.");
    }
    const expected = await hmacSha256Base64Url(secret, `${imageId}:${expires}`);
    if (!constantTimeEqual(signature, expected)) {
      throw new AppError(401, "INVALID_IMAGE_SIGNATURE", "The image URL signature is invalid.");
    }
  }
  const row = await context.env.DB.prepare("SELECT * FROM note_images WHERE id = ?")
    .bind(imageId)
    .first<ImageRow>();
  if (!row) throw new AppError(404, "IMAGE_NOT_FOUND", "The image was not found.");

  const object = await context.env.IMAGES.get(row.object_key);
  if (!object) throw new AppError(404, "IMAGE_OBJECT_MISSING", "The image data is missing.");

  const headers = new Headers({
    "content-type": row.mime_type,
    "content-length": String(row.byte_size),
    "cache-control": "no-store, private",
    pragma: "no-cache",
    "content-disposition": `inline; filename*=UTF-8''${encodeURIComponent(row.file_name)}`,
    "x-content-type-options": "nosniff",
  });
  if (object.httpEtag) headers.set("etag", object.httpEtag);
  return new Response(object.body, { status: 200, headers });
}

export async function deleteImage(context: RequestContext, imageId: string): Promise<Response> {
  const principal = requirePrincipal(context);
  const row = await context.env.DB.prepare("SELECT * FROM note_images WHERE id = ?")
    .bind(imageId)
    .first<ImageRow>();
  if (!row) throw new AppError(404, "IMAGE_NOT_FOUND", "The image was not found.");
  if (row.note_id !== null) {
    throw new AppError(409, "IMAGE_IN_USE", "Detach the image from its note before deleting it.");
  }
  if (row.uploaded_by_device_id !== principal.deviceId) {
    throw new AppError(403, "IMAGE_NOT_OWNED", "This device cannot delete the image.");
  }

  await context.env.IMAGES.delete(row.object_key);
  await context.env.DB.prepare("DELETE FROM note_images WHERE id = ?").bind(imageId).run();
  return json({ ok: true });
}
