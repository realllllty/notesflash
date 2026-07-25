import { sha256Hex } from "./crypto";
import { AppError } from "./http";
import type { RequestContext } from "./types";

/**
 * Fixed-window rate limit keyed by a hash of the Cloudflare client address.
 * The raw address is never persisted. Shared by pairing/setup and the search
 * lab so every unauthenticated-facing surface has the same cheap guard.
 */
export async function enforceRateLimit(
  context: RequestContext,
  scope: string,
  limit: number,
  windowMs: number,
  message = "Too many attempts. Wait for the current rate-limit window to expire.",
): Promise<void> {
  const now = Date.now();
  const windowStartedAt = Math.floor(now / windowMs) * windowMs;
  const expiresAt = windowStartedAt + windowMs;
  const clientAddress = context.request.headers.get("cf-connecting-ip") ?? "unknown";
  const key = await sha256Hex(`${scope}:${clientAddress}:${windowStartedAt}`);
  const row = await context.env.DB.prepare(
    `INSERT INTO rate_limit_windows(key, scope, window_started_at, expires_at, attempts)
     VALUES (?, ?, ?, ?, 1)
     ON CONFLICT(key) DO UPDATE SET attempts = attempts + 1
     RETURNING attempts`,
  )
    .bind(key, scope, windowStartedAt, expiresAt)
    .first<{ attempts: number }>();

  if ((row?.attempts ?? limit + 1) > limit) {
    throw new AppError(429, "RATE_LIMITED", message, {
      retryAfterMs: Math.max(0, expiresAt - now),
    });
  }
}
