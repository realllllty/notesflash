import {
  authenticate,
  createPairingCodeHandler,
  initializeInstance,
  listDevices,
  logoutCurrentSession,
  pairDevice,
  revokeDevice,
  setupStatus,
} from "./auth";
import { newId } from "./crypto";
import { AppError, applyCors, errorResponse, json, preflight } from "./http";
import { deleteImage, getImage, uploadImage } from "./images";
import {
  createNote,
  deleteNote,
  getNoteHandler,
  listNotes,
  restoreNote,
  updateNote,
} from "./notes";
import { consumeIndexQueue, retryPendingIndexes } from "./queue";
import { lexicalSearch, searchIndexStatus, semanticSearch } from "./search";
import { setupPage } from "./setup-page";
import type { Env, IndexJob, RequestContext } from "./types";

function pathId(pathname: string, pattern: RegExp): string | null {
  const match = pathname.match(pattern);
  return match ? decodeURIComponent(match[1]) : null;
}

async function route(context: RequestContext): Promise<Response> {
  const { request, url } = context;
  const method = request.method.toUpperCase();
  const path = url.pathname.replace(/\/+$/, "") || "/";

  if (path === "/api/health" && method === "GET") {
    return json({ ok: true, service: "notesflash-cloud", time: Date.now() });
  }
  if (path === "/setup" && method === "GET") return setupPage();
  if (path === "/api/meta" && method === "GET") {
    return json({
      name: context.env.INSTANCE_NAME ?? "NotesFlash Cloud",
      apiVersion: 1,
      capabilities: ["notes", "images", "lexical-search", "semantic-search", "pairing"],
    });
  }
  if (path === "/api/setup/status" && method === "GET") return setupStatus(context);
  if (path === "/api/setup" && method === "POST") return initializeInstance(context);
  if (path === "/api/devices/pair" && method === "POST") return pairDevice(context);

  // Signed image URLs let the PWA render an ordinary <img src> without
  // exposing its Bearer token. Authenticated image requests remain supported.
  const publicImageId = pathId(path, /^\/api\/images\/([^/]+)$/);
  if (publicImageId && method === "GET") {
    context.principal = await authenticate(request, context.env) ?? undefined;
    return getImage(context, publicImageId);
  }

  context.principal = await authenticate(request, context.env) ?? undefined;
  if (!context.principal) {
    throw new AppError(401, "AUTH_REQUIRED", "A valid Bearer device token is required.");
  }

  if (path === "/api/pairing-codes" && method === "POST") {
    return createPairingCodeHandler(context);
  }
  if (path === "/api/auth/logout" && method === "POST") return logoutCurrentSession(context);
  if (path === "/api/devices" && method === "GET") return listDevices(context);

  const deviceId = pathId(path, /^\/api\/devices\/([^/]+)$/);
  if (deviceId && method === "DELETE") return revokeDevice(context, deviceId);

  if (path === "/api/notes" && method === "GET") return listNotes(context);
  if (path === "/api/notes" && method === "POST") return createNote(context);

  const restoreNoteId = pathId(path, /^\/api\/notes\/([^/]+)\/restore$/);
  if (restoreNoteId && method === "POST") return restoreNote(context, restoreNoteId);

  const noteId = pathId(path, /^\/api\/notes\/([^/]+)$/);
  if (noteId && method === "GET") return getNoteHandler(context, noteId);
  if (noteId && method === "PATCH") return updateNote(context, noteId);
  if (noteId && method === "DELETE") return deleteNote(context, noteId);

  if (path === "/api/search/lexical" && method === "GET") return lexicalSearch(context);
  if (path === "/api/search/semantic" && method === "POST") return semanticSearch(context);
  if (path === "/api/search/status" && method === "GET") return searchIndexStatus(context);

  if (path === "/api/images" && method === "POST") return uploadImage(context);
  const imageId = pathId(path, /^\/api\/images\/([^/]+)$/);
  if (imageId && method === "DELETE") return deleteImage(context, imageId);

  throw new AppError(404, "ROUTE_NOT_FOUND", "The requested endpoint does not exist.");
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const requestId = request.headers.get("cf-ray") ?? newId();
    try {
      if (request.method.toUpperCase() === "OPTIONS") {
        return preflight(request, env);
      }

      const response = await route({
        env,
        request,
        url: new URL(request.url),
        requestId,
      });
      const headers = new Headers(response.headers);
      headers.set("x-request-id", requestId);
      return applyCors(
        new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers,
        }),
        request,
        env,
      );
    } catch (error) {
      const response = errorResponse(error, requestId);
      response.headers.set("x-request-id", requestId);
      return applyCors(response, request, env);
    }
  },

  async queue(batch: MessageBatch<IndexJob>, env: Env): Promise<void> {
    await consumeIndexQueue(batch, env);
  },

  async scheduled(_controller: ScheduledController, env: Env, context: ExecutionContext): Promise<void> {
    context.waitUntil(retryPendingIndexes(env));
  },
} satisfies ExportedHandler<Env, IndexJob>;
