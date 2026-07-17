import type { Env, RequestContext } from "./types";

export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
  }
}

export function json(data: unknown, status = 200, headers?: HeadersInit): Response {
  const responseHeaders = new Headers(headers);
  responseHeaders.set("content-type", "application/json; charset=utf-8");
  responseHeaders.set("cache-control", "no-store, private");
  responseHeaders.set("pragma", "no-cache");
  responseHeaders.set("x-content-type-options", "nosniff");
  responseHeaders.set("referrer-policy", "no-referrer");
  return new Response(JSON.stringify(data), { status, headers: responseHeaders });
}

export function errorResponse(error: unknown, requestId: string): Response {
  if (error instanceof AppError) {
    return json(
      {
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
          requestId,
        },
      },
      error.status,
    );
  }

  console.error("Unhandled request error", requestId, error);
  return json(
    {
      error: {
        code: "INTERNAL_ERROR",
        message: "The server could not complete this request.",
        requestId,
      },
    },
    500,
  );
}

function allowedOrigin(request: Request, env: Env): string | null {
  const origin = request.headers.get("origin");
  if (!origin) return null;

  const configured = (env.ALLOWED_ORIGINS ?? "*")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  if (configured.includes("*")) return "*";
  return configured.includes(origin) ? origin : null;
}

export function applyCors(response: Response, request: Request, env: Env): Response {
  const origin = allowedOrigin(request, env);
  if (!origin) return response;

  const headers = new Headers(response.headers);
  headers.set("access-control-allow-origin", origin);
  headers.set("access-control-expose-headers", "etag, x-request-id");
  headers.append("vary", "Origin");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export function preflight(request: Request, env: Env): Response {
  const origin = allowedOrigin(request, env);
  if (!origin) throw new AppError(403, "ORIGIN_NOT_ALLOWED", "This origin is not allowed.");

  return new Response(null, {
    status: 204,
    headers: {
      "access-control-allow-origin": origin,
      "access-control-allow-methods": "GET,POST,PATCH,DELETE,OPTIONS",
      "access-control-allow-headers":
        "authorization,content-type,idempotency-key,x-file-name",
      "access-control-max-age": "86400",
      vary: "Origin",
    },
  });
}

export async function readJson<T extends object>(request: Request): Promise<T> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    throw new AppError(415, "JSON_REQUIRED", "Content-Type must be application/json.");
  }

  try {
    const value: unknown = await request.json();
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error("JSON object required");
    }
    return value as T;
  } catch {
    throw new AppError(400, "INVALID_JSON", "The request body is not valid JSON.");
  }
}

export function requireString(
  value: unknown,
  name: string,
  options: { min?: number; max?: number; allowEmpty?: boolean } = {},
): string {
  if (typeof value !== "string") {
    throw new AppError(400, "INVALID_INPUT", `${name} must be a string.`);
  }
  const min = options.min ?? 0;
  const max = options.max ?? Number.MAX_SAFE_INTEGER;
  if ((!options.allowEmpty && value.trim().length === 0) || value.length < min || value.length > max) {
    throw new AppError(400, "INVALID_INPUT", `${name} has an invalid length.`);
  }
  return value;
}

export function requireInteger(value: unknown, name: string, min = 0): number {
  if (!Number.isInteger(value) || (value as number) < min) {
    throw new AppError(400, "INVALID_INPUT", `${name} must be an integer of at least ${min}.`);
  }
  return value as number;
}

export function requirePrincipal(context: RequestContext) {
  if (!context.principal) {
    throw new AppError(401, "AUTH_REQUIRED", "A valid device token is required.");
  }
  return context.principal;
}
