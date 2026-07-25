/**
 * Minimal client for the operator-only search lab endpoint.
 *
 * The token is read from the environment or a gitignored local file; it is
 * never printed. Only its presence is reported.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

export const DEFAULT_LAB_URL = "https://notesflash-cloud.17828126523l.workers.dev";
export const TOKEN_FILE = resolve(here, "..", ".lab-token.local");

export function labConfig() {
  const baseUrl = (process.env.NOTESFLASH_LAB_URL ?? DEFAULT_LAB_URL).replace(/\/+$/, "");
  let token = process.env.NOTESFLASH_LAB_TOKEN ?? "";
  if (!token) {
    try {
      token = readFileSync(TOKEN_FILE, "utf8").trim();
    } catch {
      token = "";
    }
  }
  if (!token) {
    throw new Error(
      `No lab token found. Set NOTESFLASH_LAB_TOKEN or write the token to ${TOKEN_FILE}.`,
    );
  }
  return { baseUrl, token };
}

export async function callLab(body, { timeoutMs = 120_000 } = {}) {
  const { baseUrl, token } = labConfig();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = Date.now();
  try {
    const response = await fetch(`${baseUrl}/api/internal/search-lab`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-lab-token": token,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const text = await response.text();
    if (!response.ok) {
      throw new Error(`lab request failed: HTTP ${response.status} ${text.slice(0, 400)}`);
    }
    return { payload: JSON.parse(text), elapsedMs: Date.now() - startedAt };
  } finally {
    clearTimeout(timer);
  }
}
