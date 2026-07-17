import { constantTimeEqual, createPairingCode, newId, randomToken, sha256Hex } from "./crypto";
import { getInstanceId } from "./db";
import { AppError, json, readJson, requirePrincipal, requireString } from "./http";
import type { DevicePrincipal, Env, RequestContext } from "./types";

interface SessionRow {
  session_id: string;
  device_id: string;
  device_name: string;
  last_seen_at: number | null;
}

interface BootstrapClaim {
  claimHash: string;
  deviceId: string;
  expiresAt: number;
}

const BOOTSTRAP_COOKIE = "notesflash_bootstrap";
const BOOTSTRAP_COOKIE_TTL_SECONDS = 24 * 60 * 60;

function cookieValue(request: Request, name: string): string | null {
  const header = request.headers.get("cookie");
  if (!header) return null;
  for (const item of header.split(";")) {
    const [rawName, ...rawValue] = item.trim().split("=");
    if (rawName === name) return rawValue.join("=") || null;
  }
  return null;
}

function bootstrapCookie(context: RequestContext, token: string, expiresAt: number): string {
  const secure = context.url.protocol === "https:" ? "; Secure" : "";
  const maxAge = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
  return `${BOOTSTRAP_COOKIE}=${token}; Max-Age=${maxAge}; Path=/api/setup; HttpOnly; SameSite=Strict${secure}`;
}

async function bootstrapClaim(env: Env): Promise<BootstrapClaim | null> {
  const state = await env.DB.prepare(
    `SELECT
       MAX(CASE WHEN key = 'bootstrap_claim_hash' THEN value END) AS claim_hash,
       MAX(CASE WHEN key = 'bootstrap_device_id' THEN value END) AS device_id,
       MAX(CASE WHEN key = 'bootstrap_claim_expires_at' THEN value END) AS expires_at
     FROM instance_state
     WHERE key IN ('bootstrap_claim_hash', 'bootstrap_device_id', 'bootstrap_claim_expires_at')`,
  ).first<{ claim_hash: string | null; device_id: string | null; expires_at: string | null }>();
  const expiresAt = Number(state?.expires_at);
  if (!state?.claim_hash || !state.device_id || !Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
    return null;
  }

  const device = await env.DB.prepare(
    `SELECT id FROM devices
     WHERE id = ? AND platform = 'setup-bootstrap' AND revoked_at IS NULL`,
  )
    .bind(state.device_id)
    .first<{ id: string }>();
  if (!device) return null;
  return { claimHash: state.claim_hash, deviceId: device.id, expiresAt };
}

async function validBootstrapToken(
  context: RequestContext,
  claim: BootstrapClaim | null,
): Promise<string | null> {
  if (!claim) return null;
  const token = cookieValue(context.request, BOOTSTRAP_COOKIE);
  if (!token) return null;
  const candidateHash = await sha256Hex(token);
  return constantTimeEqual(candidateHash, claim.claimHash) ? token : null;
}

async function replaceBootstrapPairingCode(
  env: Env,
  bootstrapDeviceId: string,
): Promise<{ code: string; expiresAt: number }> {
  const code = createPairingCode();
  const codeHash = await sha256Hex(code.toUpperCase());
  const now = Date.now();
  const expiresAt = now + 10 * 60 * 1000;
  const results = await env.DB.batch([
    env.DB.prepare(
      `UPDATE pairing_codes SET used_at = ?
       WHERE created_by_device_id = ? AND used_at IS NULL`,
    ).bind(now, bootstrapDeviceId),
    env.DB.prepare(
      `INSERT INTO pairing_codes(
         id, code_hash, created_by_device_id, created_at, expires_at
       )
       SELECT ?, ?, ?, ?, ?
       WHERE EXISTS (
         SELECT 1 FROM devices
         WHERE id = ? AND platform = 'setup-bootstrap' AND revoked_at IS NULL
       )
       AND EXISTS (
         SELECT 1 FROM instance_state
         WHERE key = 'bootstrap_device_id' AND value = ?
       )`,
    ).bind(
      newId(),
      codeHash,
      bootstrapDeviceId,
      now,
      expiresAt,
      bootstrapDeviceId,
      bootstrapDeviceId,
    ),
  ]);
  if ((results[1].meta.changes ?? 0) !== 1) {
    throw new AppError(409, "SETUP_COMPLETED", "The first device has already completed setup.");
  }
  return { code, expiresAt };
}

async function enforceRateLimit(
  context: RequestContext,
  scope: string,
  limit: number,
  windowMs: number,
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
    throw new AppError(
      429,
      "RATE_LIMITED",
      "Too many pairing attempts. Wait for the current rate-limit window to expire.",
      { retryAfterMs: Math.max(0, expiresAt - now) },
    );
  }
}

function sessionTtlMs(env: Env): number {
  const days = Number.parseInt(env.SESSION_TTL_DAYS ?? "180", 10);
  const safeDays = Number.isFinite(days) && days > 0 ? Math.min(days, 3650) : 180;
  return safeDays * 24 * 60 * 60 * 1000;
}

async function issueSession(env: Env, deviceId: string): Promise<string> {
  const token = randomToken(32);
  const tokenHash = await sha256Hex(token);
  const now = Date.now();
  await env.DB.prepare(
    `INSERT INTO device_sessions(id, device_id, token_hash, created_at, expires_at)
     VALUES (?, ?, ?, ?, ?)`,
  )
    .bind(newId(), deviceId, tokenHash, now, now + sessionTtlMs(env))
    .run();
  return token;
}

export async function authenticate(request: Request, env: Env): Promise<DevicePrincipal | null> {
  const authorization = request.headers.get("authorization") ?? "";
  if (!authorization.startsWith("Bearer ")) return null;
  const token = authorization.slice(7).trim();
  if (!token) return null;

  const tokenHash = await sha256Hex(token);
  const now = Date.now();
  const session = await env.DB.prepare(
    `SELECT
       s.id AS session_id,
       d.id AS device_id,
       d.name AS device_name,
       d.last_seen_at AS last_seen_at
     FROM device_sessions s
     JOIN devices d ON d.id = s.device_id
     WHERE s.token_hash = ?
       AND s.expires_at > ?
       AND s.revoked_at IS NULL
       AND d.revoked_at IS NULL`,
  )
    .bind(tokenHash, now)
    .first<SessionRow>();

  if (!session) return null;
  if (session.last_seen_at === null || now - session.last_seen_at >= 5 * 60 * 1000) {
    await env.DB.prepare(
      "UPDATE devices SET last_seen_at = ? WHERE id = ? AND (last_seen_at IS NULL OR last_seen_at < ?)",
    )
      .bind(now, session.device_id, now - 5 * 60 * 1000)
      .run();
  }

  return {
    deviceId: session.device_id,
    deviceName: session.device_name,
    sessionId: session.session_id,
  };
}

export async function setupStatus(context: RequestContext): Promise<Response> {
  const instanceId = await getInstanceId(context.env);
  const claim = instanceId ? await bootstrapClaim(context.env) : null;
  const resumeToken = await validBootstrapToken(context, claim);
  return json({
    initialized: instanceId !== null,
    canResumeSetup: resumeToken !== null,
    instanceName: context.env.INSTANCE_NAME ?? "NotesFlash Cloud",
  });
}

export async function initializeInstance(context: RequestContext): Promise<Response> {
  await enforceRateLimit(context, "initial-claim", 5, 15 * 60 * 1000);

  const origin = context.request.headers.get("origin");
  const fetchSite = context.request.headers.get("sec-fetch-site");
  if (origin !== context.url.origin || (fetchSite !== null && fetchSite !== "same-origin")) {
    throw new AppError(403, "SAME_ORIGIN_REQUIRED", "Initial setup must be started from this Worker.");
  }

  const existingInstanceId = await getInstanceId(context.env);
  if (existingInstanceId) {
    const claim = await bootstrapClaim(context.env);
    const resumeToken = await validBootstrapToken(context, claim);
    if (!claim || !resumeToken) {
      throw new AppError(409, "ALREADY_INITIALIZED", "This NotesFlash instance is already initialized.");
    }

    const pairing = await replaceBootstrapPairingCode(context.env, claim.deviceId);
    return json(
      { ...pairing, instanceId: existingInstanceId },
      201,
      { "set-cookie": bootstrapCookie(context, resumeToken, claim.expiresAt) },
    );
  }

  const now = Date.now();
  const instanceId = newId();
  const bootstrapDeviceId = newId();
  const bootstrapToken = randomToken(32);
  const bootstrapTokenHash = await sha256Hex(bootstrapToken);
  const bootstrapExpiresAt = now + BOOTSTRAP_COOKIE_TTL_SECONDS * 1000;
  const imageKey = randomToken(32);
  const code = createPairingCode();
  const codeHash = await sha256Hex(code.toUpperCase());
  const expiresAt = now + 10 * 60 * 1000;

  try {
    await context.env.DB.batch([
      context.env.DB.prepare(
        `INSERT INTO devices(id, name, platform, public_key, created_at, last_seen_at)
         VALUES (?, 'Initial setup', 'setup-bootstrap', NULL, ?, NULL)`,
      ).bind(bootstrapDeviceId, now),
      context.env.DB.prepare(
        `INSERT INTO instance_state(key, value, updated_at)
         VALUES ('instance_id', ?, ?)`,
      ).bind(instanceId, now),
      context.env.DB.prepare(
        `INSERT INTO instance_state(key, value, updated_at)
         VALUES ('initialized_at', ?, ?)`,
      ).bind(String(now), now),
      context.env.DB.prepare(
        `INSERT INTO instance_state(key, value, updated_at)
         VALUES ('bootstrap_claim_hash', ?, ?)`,
      ).bind(bootstrapTokenHash, now),
      context.env.DB.prepare(
        `INSERT INTO instance_state(key, value, updated_at)
         VALUES ('bootstrap_device_id', ?, ?)`,
      ).bind(bootstrapDeviceId, now),
      context.env.DB.prepare(
        `INSERT INTO instance_state(key, value, updated_at)
         VALUES ('bootstrap_claim_expires_at', ?, ?)`,
      ).bind(String(bootstrapExpiresAt), now),
      context.env.DB.prepare(
        `INSERT INTO instance_state(key, value, updated_at)
         VALUES ('image_signing_key', ?, ?)
         ON CONFLICT(key) DO NOTHING`,
      ).bind(imageKey, now),
      context.env.DB.prepare(
        `INSERT INTO pairing_codes(
           id, code_hash, created_by_device_id, created_at, expires_at
         ) VALUES (?, ?, ?, ?, ?)`,
      ).bind(newId(), codeHash, bootstrapDeviceId, now, expiresAt),
    ]);
  } catch (error) {
    if (await getInstanceId(context.env)) {
      throw new AppError(
        409,
        "ALREADY_INITIALIZED",
        "Another request has already initialized this NotesFlash instance.",
      );
    }
    throw error;
  }

  return json(
    { code, expiresAt, instanceId },
    201,
    { "set-cookie": bootstrapCookie(context, bootstrapToken, bootstrapExpiresAt) },
  );
}

export async function createPairingCodeHandler(context: RequestContext): Promise<Response> {
  const principal = requirePrincipal(context);
  const code = createPairingCode();
  const codeHash = await sha256Hex(code.toUpperCase());
  const now = Date.now();
  const expiresAt = now + 10 * 60 * 1000;

  await context.env.DB.prepare(
    `INSERT INTO pairing_codes(
       id, code_hash, created_by_device_id, created_at, expires_at
     ) VALUES (?, ?, ?, ?, ?)`,
  )
    .bind(newId(), codeHash, principal.deviceId, now, expiresAt)
    .run();

  return json({ code, expiresAt });
}

export async function pairDevice(context: RequestContext): Promise<Response> {
  const body = await readJson<{
    code?: unknown;
    deviceName?: unknown;
    platform?: unknown;
    publicKey?: unknown;
  }>(context.request);
  await enforceRateLimit(context, "device-pairing", 30, 10 * 60 * 1000);
  const code = requireString(body.code, "code", { min: 8, max: 64 }).toUpperCase();
  const deviceName = requireString(body.deviceName, "deviceName", { min: 1, max: 100 });
  const platform =
    typeof body.platform === "string" && body.platform.length <= 50 ? body.platform : "unknown";
  const publicKey =
    typeof body.publicKey === "string" && body.publicKey.length <= 4096 ? body.publicKey : null;

  const now = Date.now();
  const codeHash = await sha256Hex(code);
  const pairing = await context.env.DB.prepare(
    `SELECT pc.id, pc.created_by_device_id, creator.platform AS created_by_platform
     FROM pairing_codes pc
     JOIN devices creator ON creator.id = pc.created_by_device_id
     WHERE pc.code_hash = ?
       AND pc.used_at IS NULL
       AND pc.expires_at > ?
       AND creator.revoked_at IS NULL`,
  )
    .bind(codeHash, now)
    .first<{ id: string; created_by_device_id: string; created_by_platform: string }>();

  if (!pairing) {
    throw new AppError(400, "INVALID_PAIRING_CODE", "The pairing code is invalid or expired.");
  }

  const deviceId = newId();
  await context.env.DB.prepare(
    `INSERT INTO devices(id, name, platform, public_key, created_at, last_seen_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  )
    .bind(deviceId, deviceName, platform, publicKey, now, now)
    .run();

  const claim = await context.env.DB.prepare(
    `UPDATE pairing_codes
     SET used_at = ?, used_by_device_id = ?
     WHERE id = ? AND used_at IS NULL AND expires_at > ?`,
  )
    .bind(now, deviceId, pairing.id, now)
    .run();

  if ((claim.meta.changes ?? 0) !== 1) {
    await context.env.DB.prepare("DELETE FROM devices WHERE id = ?").bind(deviceId).run();
    throw new AppError(409, "PAIRING_CODE_USED", "The pairing code has already been used.");
  }

  try {
    const token = await issueSession(context.env, deviceId);
    const instanceId = await getInstanceId(context.env);
    if (pairing.created_by_platform === "setup-bootstrap") {
      await context.env.DB.batch([
        context.env.DB.prepare(
          `UPDATE pairing_codes SET used_at = ?
           WHERE created_by_device_id = ? AND used_at IS NULL`,
        ).bind(now, pairing.created_by_device_id),
        context.env.DB.prepare(
          `UPDATE devices SET revoked_at = ?
           WHERE id = ? AND platform = 'setup-bootstrap' AND revoked_at IS NULL`,
        ).bind(now, pairing.created_by_device_id),
        context.env.DB.prepare(
          `DELETE FROM instance_state
           WHERE key IN (
             'bootstrap_claim_hash', 'bootstrap_device_id', 'bootstrap_claim_expires_at'
           )`,
        ),
      ]);
    }
    return json({ token, instanceId, deviceId }, 201);
  } catch (error) {
    await context.env.DB.prepare(
      "UPDATE pairing_codes SET used_at = NULL, used_by_device_id = NULL WHERE id = ?",
    )
      .bind(pairing.id)
      .run();
    await context.env.DB.prepare("DELETE FROM devices WHERE id = ?").bind(deviceId).run();
    throw error;
  }
}

export async function listDevices(context: RequestContext): Promise<Response> {
  requirePrincipal(context);
  const result = await context.env.DB.prepare(
    `SELECT id, name, platform, created_at, last_seen_at, revoked_at
     FROM devices
     WHERE platform NOT IN ('setup-bootstrap', 'setup-web')
     ORDER BY created_at ASC`,
  ).all<{
    id: string;
    name: string;
    platform: string;
    created_at: number;
    last_seen_at: number | null;
    revoked_at: number | null;
  }>();

  return json({
    devices: result.results.map((device) => ({
      id: device.id,
      name: device.name,
      platform: device.platform,
      createdAt: device.created_at,
      lastSeenAt: device.last_seen_at,
      revokedAt: device.revoked_at,
    })),
  });
}

export async function logoutCurrentSession(context: RequestContext): Promise<Response> {
  const principal = requirePrincipal(context);
  await context.env.DB.prepare(
    "UPDATE device_sessions SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL",
  )
    .bind(Date.now(), principal.sessionId)
    .run();
  return json({ ok: true });
}

export async function revokeDevice(context: RequestContext, deviceId: string): Promise<Response> {
  const principal = requirePrincipal(context);
  if (principal.deviceId === deviceId) {
    throw new AppError(400, "CANNOT_REVOKE_CURRENT_DEVICE", "Use logout to remove this device.");
  }
  const now = Date.now();
  const result = await context.env.DB.batch([
    context.env.DB.prepare(
      "UPDATE devices SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL",
    ).bind(now, deviceId),
    context.env.DB.prepare(
      "UPDATE device_sessions SET revoked_at = ? WHERE device_id = ? AND revoked_at IS NULL",
    ).bind(now, deviceId),
    context.env.DB.prepare(
      `UPDATE pairing_codes SET used_at = ?
       WHERE created_by_device_id = ? AND used_at IS NULL`,
    ).bind(now, deviceId),
  ]);
  if ((result[0].meta.changes ?? 0) === 0) {
    throw new AppError(404, "DEVICE_NOT_FOUND", "The device was not found.");
  }
  return json({ ok: true });
}
