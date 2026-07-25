import {
  AI_SEARCH_ITEM_SCHEMA_VERSION,
  buildAiSearchItems,
  type DesiredAiSearchItem,
} from "./ai-search-items";
import { aiSearchConfig, aiSearchInstance } from "./ai-search";
import { newId } from "./crypto";
import { AppError } from "./http";
import type {
  AiSearchItemRow,
  Env,
  NoteRow,
  SyncAiSearchNoteJob,
  VerifyAiSearchNoteJob,
} from "./types";

const D1_BATCH = 40;
/** Workers allows at most six simultaneous outbound connections per request. */
const UPLOAD_CONCURRENCY = 6;
const PROVIDER_CONCURRENCY = 6;
const MAX_VERIFY_ATTEMPTS = 8;
/** Longer than the Queue consumer's maximum provider-work window. */
const UPLOAD_LEASE_MS = 20 * 60 * 1_000;
/** One official Items-list page is persisted per missing-ID lookup. */
const PROVIDER_SCAN_PAGE_SIZE = 50;
/** Leave subrequest headroom when a deletion page contains many missing IDs. */
const PROVIDER_SCAN_BUDGET = 50;
const STRICT_CLEANUP_PAGE_SIZE = 100;
const STRICT_CLEANUP_NOTE_ID_BATCH = 40;
/**
 * One uploaded/deleted item also consumes D1 and provider-status subrequests.
 * Keeping a job to 200 provider items leaves headroom below Workers Free's
 * 1000 internal-subrequest ceiling, including conflict recovery and bookkeeping.
 */
const AI_SEARCH_PAGE_SIZE = 200;

function errorCode(error: unknown): string {
  if (error instanceof AppError) return error.code.slice(0, 100);
  if (error && typeof error === "object" && "code" in error) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === "string" || typeof code === "number") return String(code).slice(0, 100);
  }
  return error instanceof Error ? error.name.slice(0, 100) : "UNKNOWN_ERROR";
}

function isNotFound(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const record = error as Record<string, unknown>;
  if (
    record.code === 7041 || record.code === "7041" ||
    record.code === 7002 || record.code === "7002"
  ) return true;
  const message = [record.name, record.message]
    .filter((value) => typeof value === "string")
    .join(" ");
  return /AiSearchNotFoundError|item_not_found|ai_search_not_found/i.test(message);
}

function isItemKeyConflict(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const record = error as Record<string, unknown>;
  if (record.code === 7042 || record.code === "7042") return true;
  const message = [record.name, record.message]
    .filter((value) => typeof value === "string")
    .join(" ");
  return /item_key_already_exist|item.?key.?conflict/i.test(message);
}

function providerItemMatches(
  info: AiSearchItemInfo,
  itemKey: string,
  indexTextHash: string,
): boolean {
  return info.key === itemKey &&
    info.metadata?.schema_version === AI_SEARCH_ITEM_SCHEMA_VERSION &&
    info.metadata?.index_hash === indexTextHash;
}

async function inBatches<T>(
  values: readonly T[],
  concurrency: number,
  operation: (value: T) => Promise<void>,
): Promise<void> {
  for (let offset = 0; offset < values.length; offset += concurrency) {
    const outcomes = await Promise.allSettled(
      values.slice(offset, offset + concurrency).map(operation),
    );
    const failed = outcomes.find(
      (outcome): outcome is PromiseRejectedResult => outcome.status === "rejected",
    );
    if (failed) throw failed.reason;
  }
}

async function runStatements(env: Env, statements: D1PreparedStatement[]): Promise<void> {
  for (let offset = 0; offset < statements.length; offset += D1_BATCH) {
    await env.DB.batch(statements.slice(offset, offset + D1_BATCH));
  }
}

type ProviderRecovery =
  | { state: "found"; item: AiSearchItemInfo }
  | { state: "pending" };

function safeScanPage(value: number): number {
  return Number.isSafeInteger(value) && value >= 1 ? value : 1;
}

function safeScanPass(value: number): number {
  return Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

function uploadLeaseIsActive(row: AiSearchItemRow, now = Date.now()): boolean {
  return row.upload_token !== null && row.updated_at > now - UPLOAD_LEASE_MS;
}

async function claimProviderUpload(
  env: Env,
  note: NoteRow,
  row: AiSearchItemRow,
): Promise<string | null> {
  const now = Date.now();
  if (
    row.sync_state === "uploading" && uploadLeaseIsActive(row, now) ||
    !["pending", "failed", "uploading"].includes(row.sync_state)
  ) return null;
  const token = newId();
  const result = await env.DB.prepare(
    `UPDATE ai_search_items SET
       sync_state = 'uploading', upload_token = ?, error_code = NULL, updated_at = ?
     WHERE item_key = ? AND note_content_hash = ? AND note_version = ?
       AND sync_state = ? AND updated_at = ?
       AND ((upload_token IS NULL AND ? IS NULL) OR upload_token = ?)
       AND EXISTS (
         SELECT 1 FROM notes
         WHERE id = ? AND version = ? AND content_hash = ?
           AND deleted_at IS NULL AND ai_search_status = 'processing'
       )`,
  )
    .bind(
      token,
      now,
      row.item_key,
      row.note_content_hash,
      row.note_version,
      row.sync_state,
      row.updated_at,
      row.upload_token,
      row.upload_token,
      note.id,
      note.version,
      note.content_hash,
    )
    .run();
  return (result.meta.changes ?? 0) === 1 ? token : null;
}

async function failProviderUpload(
  env: Env,
  row: AiSearchItemRow,
  token: string,
  error: unknown,
): Promise<void> {
  await env.DB.prepare(
    `UPDATE ai_search_items SET
       sync_state = 'failed', upload_token = NULL, error_code = ?, updated_at = ?
     WHERE item_key = ? AND note_content_hash = ? AND note_version = ?
       AND upload_token = ?`,
  )
    .bind(
      errorCode(error),
      Date.now(),
      row.item_key,
      row.note_content_hash,
      row.note_version,
      token,
    )
    .run();
}

async function releaseProviderFence(
  env: Env,
  row: AiSearchItemRow,
  token: string,
  state: "uploading" | "deleting" | "failed",
): Promise<void> {
  await env.DB.prepare(
    `UPDATE ai_search_items SET
       sync_state = ?, upload_token = NULL, updated_at = ?
     WHERE item_key = ? AND note_content_hash = ? AND note_version = ?
       AND upload_token = ?`,
  )
    .bind(
      state,
      Date.now(),
      row.item_key,
      row.note_content_hash,
      row.note_version,
      token,
    )
    .run();
}

async function claimProviderDelete(
  env: Env,
  row: AiSearchItemRow,
): Promise<string | null> {
  const now = Date.now();
  if (uploadLeaseIsActive(row, now)) return null;
  const token = newId();
  const result = await env.DB.prepare(
    `UPDATE ai_search_items SET
       sync_state = 'deleting', upload_token = ?, updated_at = ?
     WHERE item_key = ? AND note_content_hash = ? AND note_version = ?
       AND sync_state = ? AND updated_at = ?
       AND ((upload_token IS NULL AND ? IS NULL) OR upload_token = ?)`,
  )
    .bind(
      token,
      now,
      row.item_key,
      row.note_content_hash,
      row.note_version,
      row.sync_state,
      row.updated_at,
      row.upload_token,
      row.upload_token,
    )
    .run();
  return (result.meta.changes ?? 0) === 1 ? token : null;
}

async function finishProviderUpload(
  env: Env,
  row: AiSearchItemRow,
  token: string,
  item: AiSearchItemInfo,
  ready: boolean,
): Promise<boolean> {
  const result = await env.DB.prepare(
    `UPDATE ai_search_items SET
       item_id = ?,
       sync_state = CASE WHEN sync_state = 'deleting' THEN 'deleting' ELSE ? END,
       provider_status = ?, error_code = NULL, upload_token = NULL,
       provider_scan_page = 1, provider_scan_pass = 0,
       provider_scan_total_count = NULL, updated_at = ?
     WHERE item_key = ? AND note_content_hash = ? AND note_version = ?
       AND upload_token = ?`,
  )
    .bind(
      item.id,
      ready ? "ready" : "submitted",
      item.status,
      Date.now(),
      row.item_key,
      row.note_content_hash,
      row.note_version,
      token,
    )
    .run();
  if ((result.meta.changes ?? 0) === 1) return true;

  // An edit may have reused the immutable key while the provider call was in
  // flight. Adopt the ID into that current same-text mapping without clearing a
  // different operation token; cleanup will still respect its fence.
  const adopted = await env.DB.prepare(
    `UPDATE ai_search_items SET
       item_id = ?, provider_status = ?, updated_at = ?
     WHERE item_key = ? AND index_text_hash = ? AND item_id IS NULL`,
  )
    .bind(item.id, item.status, Date.now(), row.item_key, row.index_text_hash)
    .run();
  return (adopted.meta.changes ?? 0) === 1;
}

async function finishRecoveredProviderItem(
  env: Env,
  row: AiSearchItemRow,
  item: AiSearchItemInfo,
  ready: boolean,
): Promise<boolean> {
  const result = await env.DB.prepare(
    `UPDATE ai_search_items SET
       sync_state = ?, provider_status = ?, error_code = NULL, updated_at = ?
     WHERE item_key = ? AND note_content_hash = ? AND note_version = ?
       AND item_id = ? AND sync_state = 'uploading' AND upload_token IS NULL`,
  )
    .bind(
      ready ? "ready" : "submitted",
      item.status,
      Date.now(),
      row.item_key,
      row.note_content_hash,
      row.note_version,
      item.id,
    )
    .run();
  return (result.meta.changes ?? 0) === 1;
}

async function persistProviderScan(
  env: Env,
  row: AiSearchItemRow,
  page: number,
  pass: number,
  totalCount: number | null,
): Promise<boolean> {
  const result = await env.DB.prepare(
    `UPDATE ai_search_items SET
       provider_scan_page = ?, provider_scan_pass = ?,
       provider_scan_total_count = ?
     WHERE item_key = ? AND note_content_hash = ? AND note_version = ?
       AND item_id IS NULL
       AND provider_scan_page = ? AND provider_scan_pass = ?
       AND (
         (provider_scan_total_count IS NULL AND ? IS NULL)
         OR provider_scan_total_count = ?
       )`,
  )
    .bind(
      page,
      pass,
      totalCount,
      row.item_key,
      row.note_content_hash,
      row.note_version,
      safeScanPage(row.provider_scan_page),
      safeScanPass(row.provider_scan_pass),
      row.provider_scan_total_count,
      row.provider_scan_total_count,
    )
    .run();
  return (result.meta.changes ?? 0) === 1;
}

async function persistRecoveredProviderItem(
  env: Env,
  row: AiSearchItemRow,
  item: AiSearchItemInfo,
): Promise<boolean> {
  const result = await env.DB.prepare(
    `UPDATE ai_search_items SET
       item_id = ?, provider_status = ?, provider_scan_page = 1,
       provider_scan_pass = 0, provider_scan_total_count = NULL, updated_at = ?
     WHERE item_key = ? AND note_content_hash = ? AND note_version = ?
       AND item_id IS NULL`,
  )
    .bind(
      item.id,
      item.status,
      Date.now(),
      row.item_key,
      row.note_content_hash,
      row.note_version,
    )
    .run();
  return (result.meta.changes ?? 0) === 1;
}

/**
 * Recover a provider ID using only the documented Items Workers binding.
 *
 * Cloudflare documents `search` as item-text search, not a filename lookup, so
 * the scan deliberately omits it and checks each returned key for exact
 * equality. One page is consumed per call, and D1 persists the next page/pass
 * so Queue and protected-lab retries resume instead of restarting. Page-number
 * pagination has no snapshot guarantee; a completed miss therefore starts a
 * new pass and remains fail-closed rather than deleting the only D1 handle.
 */
async function recoverProviderItem(
  env: Env,
  instance: AiSearchInstance,
  row: AiSearchItemRow,
): Promise<ProviderRecovery> {
  const page = safeScanPage(row.provider_scan_page);
  const pass = safeScanPass(row.provider_scan_pass);
  const expectedTotal = Number.isSafeInteger(row.provider_scan_total_count) &&
      (row.provider_scan_total_count as number) >= 0
    ? row.provider_scan_total_count
    : null;
  const params: AiSearchListItemsParams = {
    page,
    per_page: PROVIDER_SCAN_PAGE_SIZE,
    source: "builtin",
    sort_by: "modified_at",
  };
  const listed = await instance.items.list(params);
  if (!listed || !Array.isArray(listed.result) || listed.result.length > PROVIDER_SCAN_PAGE_SIZE) {
    throw new AppError(
      503,
      "INVALID_AI_SEARCH_ITEM_LIST",
      "Cloudflare AI Search returned an invalid item list.",
    );
  }

  const exact = listed.result.filter((item) => item?.key === row.item_key);
  if (exact.length > 1) {
    throw new AppError(
      503,
      "INVALID_AI_SEARCH_ITEM_LIST",
      "Cloudflare AI Search returned duplicate item keys.",
    );
  }
  if (exact.length === 1) {
    const listedItem = exact[0];
    if (typeof listedItem.id !== "string" || listedItem.id.length === 0) {
      throw new AppError(503, "INVALID_AI_SEARCH_ITEM", "AI Search returned no item ID.");
    }
    if (!providerItemMatches(listedItem, row.item_key, row.index_text_hash)) {
      throw new AppError(
        503,
        "AI_SEARCH_ITEM_METADATA_MISMATCH",
        "AI Search item metadata does not match the D1 manifest.",
      );
    }
    let item: AiSearchItemInfo;
    try {
      item = await instance.items.get(listedItem.id).info();
    } catch (error) {
      // A stale list entry is not proof that the target was deleted. Keep the
      // mapping/cursor and retry this page until an authoritative info read can
      // confirm the same provider object.
      if (isNotFound(error)) return { state: "pending" };
      throw error;
    }
    if (item.id !== listedItem.id || !providerItemMatches(item, row.item_key, row.index_text_hash)) {
      throw new AppError(
        503,
        "AI_SEARCH_ITEM_METADATA_MISMATCH",
        "AI Search item identity does not match the D1 manifest.",
      );
    }
    return await persistRecoveredProviderItem(env, row, item)
      ? { state: "found", item }
      : { state: "pending" };
  }

  const info = listed.result_info;
  const observedTotal = info === undefined
    ? null
    : Number.isSafeInteger(info.total_count) && info.total_count >= 0
    ? info.total_count
    : null;
  if (info !== undefined && observedTotal === null) {
    throw new AppError(
      503,
      "INVALID_AI_SEARCH_ITEM_LIST",
      "Cloudflare AI Search returned invalid pagination metadata.",
    );
  }
  if (
    info !== undefined &&
    ((info.page !== undefined && info.page !== page) ||
      (info.per_page !== undefined && info.per_page !== PROVIDER_SCAN_PAGE_SIZE))
  ) {
    throw new AppError(
      503,
      "INVALID_AI_SEARCH_ITEM_LIST",
      "Cloudflare AI Search returned inconsistent pagination metadata.",
    );
  }

  // `modified_at` ordering has no snapshot or stable tie-break guarantee. The
  // count is diagnostic only: a change must not restart and starve the scan,
  // while an unchanged value must not be mistaken for proof of absence.
  const passTotal = observedTotal ?? expectedTotal;
  const hasNextPage = observedTotal !== null
    ? page * PROVIDER_SCAN_PAGE_SIZE < observedTotal
    : listed.result.length === PROVIDER_SCAN_PAGE_SIZE;
  if (hasNextPage) {
    await persistProviderScan(env, row, page + 1, pass, passTotal);
    return { state: "pending" };
  }

  await persistProviderScan(env, row, 1, pass + 1, null);
  return { state: "pending" };
}

function providerMetadataForRow(row: AiSearchItemRow): Record<string, string | number> {
  return {
    schema_version: AI_SEARCH_ITEM_SCHEMA_VERSION,
    kind: row.kind,
    raw_line_index: row.raw_line_index ?? -1,
    index_hash: row.index_text_hash,
  };
}

/**
 * Establish an authoritative provider ID before deleting a missing-ID mapping.
 * A genuinely absent item is uploaded from the exact D1 manifest and can then
 * be deleted immediately. A 7042 means a prior upload exists, so recovery
 * resumes the persisted official-list scan and remains fail-closed until found.
 */
async function recoverProviderItemForDeletion(
  env: Env,
  instance: AiSearchInstance,
  row: AiSearchItemRow,
): Promise<ProviderRecovery> {
  // A prior 7042 already proved that this key exists. Continue the persisted
  // scan directly so repeated cleanup invocations cannot perturb provider
  // ordering by issuing the same conflicting upload before every page.
  if (
    safeScanPage(row.provider_scan_page) !== 1 ||
    safeScanPass(row.provider_scan_pass) !== 0 ||
    row.provider_scan_total_count !== null
  ) {
    return recoverProviderItem(env, instance, row);
  }
  let uploaded: AiSearchItemInfo;
  try {
    uploaded = await instance.items.upload(row.item_key, row.text, {
      metadata: providerMetadataForRow(row),
    });
  } catch (error) {
    if (!isItemKeyConflict(error)) throw error;
    return recoverProviderItem(env, instance, row);
  }
  if (
    typeof uploaded.id !== "string" || uploaded.id.length === 0 ||
    uploaded.key !== row.item_key
  ) {
    throw new AppError(503, "INVALID_AI_SEARCH_ITEM", "AI Search returned an invalid item.");
  }
  return await persistRecoveredProviderItem(env, row, uploaded)
    ? { state: "found", item: uploaded }
    : { state: "pending" };
}

async function uploadItem(
  env: Env,
  instance: AiSearchInstance,
  note: NoteRow,
  item: DesiredAiSearchItem,
  row: AiSearchItemRow,
): Promise<void> {
  if (row.sync_state === "uploading" && uploadLeaseIsActive(row)) {
    throw new AppError(
      503,
      "AI_SEARCH_ITEM_RECOVERY_PENDING",
      "AI Search item recovery is waiting for an active upload lease.",
    );
  }
  if (row.sync_state === "uploading" && row.upload_token === null) {
    const recovery = await recoverProviderItem(env, instance, row);
    if (recovery.state !== "found") {
      throw new AppError(
        503,
        "AI_SEARCH_ITEM_RECOVERY_PENDING",
        "AI Search item recovery is still scanning provider pages.",
      );
    }
    const ready = (recovery.item.status === "completed" || recovery.item.status === "skipped") &&
      providerItemMatches(recovery.item, item.itemKey, item.indexTextHash);
    if (!await finishRecoveredProviderItem(env, row, recovery.item, ready)) {
      throw new AppError(
        503,
        "AI_SEARCH_ITEM_FENCE_LOST",
        "AI Search item recovery could not finalize its D1 mapping.",
      );
    }
    return;
  }
  const uploadToken = await claimProviderUpload(env, note, row);
  if (!uploadToken) {
    throw new AppError(
      503,
      "AI_SEARCH_ITEM_RECOVERY_PENDING",
      "AI Search item upload could not acquire its durable fence.",
    );
  }

  let uploaded: AiSearchItemInfo;
  try {
    uploaded = await instance.items.upload(item.itemKey, item.indexText, {
      metadata: item.metadata,
    });
  } catch (error) {
    // The binding documents upload as upsert, while the provider can still
    // return 7042 after a prior upload won the key. Only that explicit conflict
    // is recoverable; auth, validation, quota, and outage errors retain their
    // original failure semantics.
    if (!isItemKeyConflict(error)) {
      await failProviderUpload(env, row, uploadToken, error);
      throw error;
    }
    const recovery = await recoverProviderItem(env, instance, row);
    if (recovery.state !== "found") {
      await releaseProviderFence(env, row, uploadToken, "uploading");
      throw new AppError(
        503,
        "AI_SEARCH_ITEM_RECOVERY_PENDING",
        "AI Search item recovery is still scanning provider pages.",
      );
    }
    uploaded = recovery.item;
  }
  if (typeof uploaded.id !== "string" || uploaded.id.length === 0) {
    const error = new AppError(503, "INVALID_AI_SEARCH_ITEM", "AI Search returned no item ID.");
    await failProviderUpload(env, row, uploadToken, error);
    throw error;
  }
  if (uploaded.status === "error") {
    const error = new AppError(
      503,
      "AI_SEARCH_ITEM_FAILED",
      "AI Search rejected an indexed line.",
    );
    await failProviderUpload(env, row, uploadToken, error);
    throw error;
  }
  const ready = (uploaded.status === "completed" || uploaded.status === "skipped") &&
    providerItemMatches(uploaded, item.itemKey, item.indexTextHash);
  if (!await finishProviderUpload(env, row, uploadToken, uploaded, ready)) {
    throw new AppError(
      503,
      "AI_SEARCH_ITEM_FENCE_LOST",
      "AI Search item upload could not persist its provider ID safely.",
    );
  }
}

async function markManifest(
  env: Env,
  note: NoteRow,
  items: DesiredAiSearchItem[],
): Promise<void> {
  const now = Date.now();
  const desiredKeys = new Set(items.map((item) => item.itemKey));
  const existing = (await env.DB.prepare(
    "SELECT * FROM ai_search_items WHERE note_id = ?",
  )
    .bind(note.id)
    .all<AiSearchItemRow>()).results;

  const statements = items.map((item) => env.DB.prepare(
    `INSERT INTO ai_search_items(
       item_key, item_id, note_id, note_content_hash, note_version, item_index,
       kind, raw_line_index, line_number, char_start, char_end, text,
       index_text_hash, sync_state, provider_status, error_code, created_at, updated_at
     )
     SELECT ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', NULL, NULL, ?, ?
     WHERE EXISTS (
       SELECT 1 FROM notes
       WHERE id = ? AND version = ? AND content_hash = ?
         AND deleted_at IS NULL AND ai_search_status = 'processing'
     )
     ON CONFLICT(item_key) DO UPDATE SET
       note_content_hash = excluded.note_content_hash,
       note_version = excluded.note_version,
       item_index = excluded.item_index,
       kind = excluded.kind,
       raw_line_index = excluded.raw_line_index,
       line_number = excluded.line_number,
       char_start = excluded.char_start,
       char_end = excluded.char_end,
       text = excluded.text,
       index_text_hash = excluded.index_text_hash,
       sync_state = CASE
         WHEN ai_search_items.index_text_hash = excluded.index_text_hash
          AND ai_search_items.item_id IS NOT NULL
          AND ai_search_items.sync_state IN ('submitted', 'ready')
         THEN ai_search_items.sync_state
         ELSE 'pending'
       END,
       upload_token = NULL,
       error_code = NULL,
       updated_at = excluded.updated_at
     WHERE ai_search_items.upload_token IS NULL
        OR ai_search_items.updated_at <= ?`,
  ).bind(
    item.itemKey,
    note.id,
    note.content_hash,
    note.version,
    item.itemIndex,
    item.kind,
    item.rawLineIndex,
    item.lineNumber,
    item.charStart,
    item.charEnd,
    item.text,
    item.indexTextHash,
    now,
    now,
    note.id,
    note.version,
    note.content_hash,
    now - UPLOAD_LEASE_MS,
  ));
  for (const row of existing) {
    if (desiredKeys.has(row.item_key)) continue;
    statements.push(
      env.DB.prepare(
        `UPDATE ai_search_items SET sync_state = 'deleting', updated_at = ?
         WHERE item_key = ? AND note_id = ?
           AND note_content_hash = ? AND note_version = ?
           AND (upload_token IS NULL OR updated_at <= ?)`,
      ).bind(
        now,
        row.item_key,
        note.id,
        row.note_content_hash,
        row.note_version,
        now - UPLOAD_LEASE_MS,
      ),
    );
  }
  await runStatements(env, statements);
}

async function manifestIsComplete(
  env: Env,
  note: NoteRow,
  items: DesiredAiSearchItem[],
): Promise<boolean> {
  const rows = (await env.DB.prepare(
    `SELECT item_key FROM ai_search_items
     WHERE note_id = ? AND note_content_hash = ? AND note_version = ?`,
  )
    .bind(note.id, note.content_hash, note.version)
    .all<{ item_key: string }>()).results;
  if (rows.length !== items.length) return false;
  const keys = new Set(rows.map((row) => row.item_key));
  return items.every((item) => keys.has(item.itemKey));
}

async function enqueueVerification(
  env: Env,
  job: Pick<SyncAiSearchNoteJob, "noteId" | "version" | "contentHash">,
  attempt: number,
  delaySeconds: number,
): Promise<void> {
  await env.INDEX_QUEUE.send({
    type: "verify-ai-search-note",
    eventId: newId(),
    noteId: job.noteId,
    version: job.version,
    contentHash: job.contentHash,
    attempt,
    createdAt: Date.now(),
  }, { delaySeconds });
}

async function enqueueSyncContinuation(
  env: Env,
  job: Pick<SyncAiSearchNoteJob, "noteId" | "version" | "contentHash">,
  delaySeconds = 1,
): Promise<void> {
  await env.INDEX_QUEUE.send({
    type: "sync-ai-search-note",
    eventId: newId(),
    noteId: job.noteId,
    version: job.version,
    contentHash: job.contentHash,
    createdAt: Date.now(),
  }, { delaySeconds });
}

async function deleteProviderRows(
  env: Env,
  instance: AiSearchInstance,
  rows: AiSearchItemRow[],
): Promise<{ deletedItems: number; recoveryPending: boolean }> {
  let deletedItems = 0;
  let recoveryPending = false;
  let recoveryBudget = PROVIDER_SCAN_BUDGET;
  const reusedKeys = new Map<string, string>();
  await inBatches(rows, PROVIDER_CONCURRENCY, async (row) => {
    // A newer manifest may have reused this immutable item key after the stale
    // rows were selected. Re-read the generation before touching the provider,
    // and guard the final D1 delete for the same reason.
    const current = await env.DB.prepare(
      `SELECT * FROM ai_search_items
       WHERE item_key = ? AND note_content_hash = ? AND note_version = ?`,
    )
      .bind(row.item_key, row.note_content_hash, row.note_version)
      .first<AiSearchItemRow>();
    if (!current) return;
    if (uploadLeaseIsActive(current)) {
      recoveryPending = true;
      return;
    }
    const deleteToken = await claimProviderDelete(env, current);
    if (!deleteToken) {
      recoveryPending = true;
      return;
    }

    try {
      let itemId = current.item_id;
      if (!itemId) {
        if (recoveryBudget <= 0) {
          await releaseProviderFence(env, current, deleteToken, "deleting");
          recoveryPending = true;
          return;
        }
        recoveryBudget -= 1;
        const recovery = await recoverProviderItemForDeletion(env, instance, current);
        if (recovery.state !== "found") {
          await releaseProviderFence(env, current, deleteToken, "deleting");
          recoveryPending = true;
          return;
        }
        itemId = recovery.item.id;
      }
      if (itemId) {
        try {
          await instance.items.delete(itemId);
        } catch (error) {
          if (!isNotFound(error)) throw error;
        }
      }
      const deleted = await env.DB.prepare(
        `DELETE FROM ai_search_items
         WHERE item_key = ? AND note_content_hash = ? AND note_version = ?
           AND upload_token = ?`,
      )
        .bind(
          current.item_key,
          current.note_content_hash,
          current.note_version,
          deleteToken,
        )
        .run();
      if ((deleted.meta.changes ?? 0) < 1) {
        await releaseProviderFence(env, current, deleteToken, "deleting");
        // The provider delete raced a manifest that reused this immutable key.
        // The current content is identical, but its provider item has just been
        // removed, so force that row back through upload instead of leaving a
        // permanently "ready" mapping to a missing item.
        reusedKeys.set(current.item_key, current.note_id);
      } else {
        deletedItems += deleted.meta.changes ?? 0;
      }
    } catch (error) {
      await releaseProviderFence(env, current, deleteToken, "deleting");
      throw error;
    }
  });

  if (reusedKeys.size > 0) {
    const now = Date.now();
    await runStatements(env, [...reusedKeys.keys()].map((itemKey) =>
      env.DB.prepare(
        `UPDATE ai_search_items SET
           item_id = NULL, sync_state = 'pending', provider_status = NULL,
           error_code = NULL, upload_token = NULL, provider_scan_page = 1,
           provider_scan_pass = 0, provider_scan_total_count = NULL,
           updated_at = ?
         WHERE item_key = ?`,
      ).bind(now, itemKey)
    ));
    for (const noteId of new Set(reusedKeys.values())) {
      const live = await env.DB.prepare(
        `SELECT id, version, content_hash FROM notes
         WHERE id = ? AND deleted_at IS NULL`,
      )
        .bind(noteId)
        .first<Pick<NoteRow, "id" | "version" | "content_hash">>();
      if (!live) continue;
      await env.DB.prepare(
        `UPDATE notes SET ai_search_status = 'pending',
           ai_search_indexed_content_hash = NULL, ai_search_updated_at = NULL,
           ai_search_error_code = NULL
         WHERE id = ? AND version = ? AND content_hash = ? AND deleted_at IS NULL`,
      )
        .bind(live.id, live.version, live.content_hash)
        .run();
      await enqueueSyncContinuation(env, {
        noteId: live.id,
        version: live.version,
        contentHash: live.content_hash,
      });
    }
  }
  return { deletedItems, recoveryPending };
}

/**
 * Removes one globally bounded page of AI Search items mapped to the supplied
 * notes before a caller hard-deletes them. This function deliberately does not
 * delete notes: the caller must observe `complete: true` first. A provider/list
 * failure escapes while the corresponding D1 mapping still exists, so an
 * ON DELETE CASCADE cannot erase the only reliable cleanup handle.
 */
export async function deleteAiSearchItemsForNotes(
  env: Env,
  noteIds: readonly string[],
): Promise<{ deletedItems: number; complete: boolean; remainingItems: number }> {
  const uniqueNoteIds = [...new Set(noteIds)];
  const noteIdGroups: string[][] = [];
  for (let offset = 0; offset < uniqueNoteIds.length; offset += STRICT_CLEANUP_NOTE_ID_BATCH) {
    noteIdGroups.push(uniqueNoteIds.slice(offset, offset + STRICT_CLEANUP_NOTE_ID_BATCH));
  }

  const rows: AiSearchItemRow[] = [];
  for (const group of noteIdGroups) {
    const capacity = STRICT_CLEANUP_PAGE_SIZE - rows.length;
    if (capacity <= 0) break;
    const placeholders = group.map(() => "?").join(", ");
    const selected = (await env.DB.prepare(
      `SELECT * FROM ai_search_items
       WHERE note_id IN (${placeholders})
       ORDER BY note_id ASC, item_index ASC, item_key ASC LIMIT ?`,
    )
      .bind(...group, capacity)
      .all<AiSearchItemRow>()).results.slice(0, capacity);
    rows.push(...selected);
  }

  let deletedItems = 0;
  if (rows.length > 0) {
    // Existing mappings must remain cleanable during a Vectorize rollback even
    // when AI_SEARCH_ENABLED is false. A missing binding still fails safely.
    const config = aiSearchConfig(env);
    const instance = await aiSearchInstance(env, { ...config, enabled: true });
    ({ deletedItems } = await deleteProviderRows(env, instance, rows));
  }

  let remainingItems = 0;
  for (const group of noteIdGroups) {
    const placeholders = group.map(() => "?").join(", ");
    const remaining = await env.DB.prepare(
      `SELECT COUNT(*) AS remaining_items FROM ai_search_items
       WHERE note_id IN (${placeholders})`,
    )
      .bind(...group)
      .first<{ remaining_items: number }>();
    remainingItems += Math.max(0, Number(remaining?.remaining_items ?? 0));
  }

  return { deletedItems, complete: remainingItems === 0, remainingItems };
}

async function disableDeletedNote(
  env: Env,
  instance: AiSearchInstance,
  noteId: string,
  job: Pick<SyncAiSearchNoteJob, "noteId" | "version" | "contentHash">,
): Promise<void> {
  const restored = await env.DB.prepare(
    "SELECT 1 AS live FROM notes WHERE id = ? AND deleted_at IS NULL",
  )
    .bind(noteId)
    .first<{ live: number }>();
  if (restored) return;

  const rows = (await env.DB.prepare(
    `SELECT * FROM ai_search_items
     WHERE note_id = ? ORDER BY item_index ASC LIMIT 200`,
  )
    .bind(noteId)
    .all<AiSearchItemRow>()).results.slice(0, AI_SEARCH_PAGE_SIZE);
  await deleteProviderRows(env, instance, rows);

  const remaining = await env.DB.prepare(
    "SELECT 1 AS pending FROM ai_search_items WHERE note_id = ? LIMIT 1",
  )
    .bind(noteId)
    .first<{ pending: number }>();
  if (remaining) {
    await enqueueSyncContinuation(env, job);
    return;
  }
  await env.DB.prepare(
    `UPDATE notes SET
       ai_search_status = 'disabled', ai_search_indexed_content_hash = NULL,
       ai_search_updated_at = ?, ai_search_error_code = NULL
     WHERE id = ? AND deleted_at IS NOT NULL`,
  )
    .bind(Date.now(), noteId)
    .run();
}

export async function syncAiSearchNote(env: Env, job: SyncAiSearchNoteJob): Promise<void> {
  const config = aiSearchConfig(env);
  const note = await env.DB.prepare("SELECT * FROM notes WHERE id = ?")
    .bind(job.noteId)
    .first<NoteRow>();
  if (!note) return;
  if (note.deleted_at === null && note.ai_search_status === "disabled") return;
  // Disabling maintenance stops live-note uploads, but it must never strand
  // provider mappings for a deleted note and thereby block retention cleanup.
  if (!config.enabled && note.deleted_at === null) return;
  // A superseded live job must be a true no-op. In particular it must not open
  // or create the provider instance, because a stale message should not fail
  // when the current generation has already moved on.
  if (
    note.deleted_at === null &&
    (note.version !== job.version || note.content_hash !== job.contentHash)
  ) return;
  if (note.deleted_at !== null) {
    const mapping = await env.DB.prepare(
      "SELECT 1 AS mapped FROM ai_search_items WHERE note_id = ? LIMIT 1",
    )
      .bind(note.id)
      .first<{ mapped: number }>();
    if (!mapping) {
      await env.DB.prepare(
        `UPDATE notes SET
           ai_search_status = 'disabled', ai_search_indexed_content_hash = NULL,
           ai_search_updated_at = ?, ai_search_error_code = NULL
         WHERE id = ? AND deleted_at IS NOT NULL`,
      )
        .bind(Date.now(), note.id)
        .run();
      return;
    }
    const instance = await aiSearchInstance(env, { ...config, enabled: true });
    await disableDeletedNote(env, instance, note.id, job);
    return;
  }
  const instance = await aiSearchInstance(env, config);
  const processingUpdate = await env.DB.prepare(
     `UPDATE notes SET
       ai_search_status = 'processing', ai_search_updated_at = ?, ai_search_error_code = NULL
     WHERE id = ? AND version = ? AND content_hash = ? AND deleted_at IS NULL
       AND ai_search_status != 'disabled'`,
  )
    .bind(Date.now(), note.id, note.version, note.content_hash)
    .run();
  if ((processingUpdate.meta.changes ?? 0) !== 1) return;

  const desired = await buildAiSearchItems({
    id: note.id,
    title: note.title,
    body: note.body,
    version: note.version,
    contentHash: note.content_hash,
  }, config.maxItemsPerNote);

  // Hashing a very large note can yield while another device saves a new
  // version. Avoid writing a stale manifest when that race is already visible.
  const stillCurrent = await env.DB.prepare(
    `SELECT 1 AS current FROM notes
     WHERE id = ? AND version = ? AND content_hash = ? AND deleted_at IS NULL
       AND ai_search_status = 'processing'`,
  )
    .bind(note.id, note.version, note.content_hash)
    .first<{ current: number }>();
  if (!stillCurrent) return;
  // Continuation jobs should not rewrite a 2000-line manifest before every
  // 200-item upload page. A partial/failed first pass does not satisfy this
  // exact key-set check and is rebuilt idempotently on retry.
  if (!await manifestIsComplete(env, note, desired)) {
    await markManifest(env, note, desired);
  }

  const rows = (await env.DB.prepare(
    `SELECT * FROM ai_search_items
     WHERE note_id = ? AND note_content_hash = ? AND note_version = ?
       AND sync_state IN ('pending', 'failed', 'uploading')
     ORDER BY item_index ASC LIMIT 200`,
  )
    .bind(note.id, note.content_hash, note.version)
    .all<AiSearchItemRow>()).results.slice(0, AI_SEARCH_PAGE_SIZE);
  const desiredByKey = new Map(desired.map((item) => [item.itemKey, item]));
  await inBatches(rows, UPLOAD_CONCURRENCY, async (row) => {
    const item = desiredByKey.get(row.item_key);
    if (!item) return;
    try {
      await uploadItem(env, instance, note, item, row);
    } catch (error) {
      if (!(error instanceof AppError && error.code === "AI_SEARCH_ITEM_RECOVERY_PENDING")) {
        await env.DB.prepare(
          `UPDATE ai_search_items SET
             sync_state = CASE WHEN upload_token IS NULL THEN 'failed' ELSE sync_state END,
             error_code = ?,
             updated_at = CASE WHEN upload_token IS NULL THEN ? ELSE updated_at END
           WHERE item_key = ? AND note_content_hash = ? AND note_version = ?`,
        )
          .bind(errorCode(error), Date.now(), row.item_key, note.content_hash, note.version)
          .run();
      }
      throw error;
    }
  });

  const remainingUploads = await env.DB.prepare(
    `SELECT 1 AS pending FROM ai_search_items
     WHERE note_id = ? AND note_content_hash = ? AND note_version = ?
       AND sync_state IN ('pending', 'failed', 'uploading')
     LIMIT 1`,
  )
    .bind(note.id, note.content_hash, note.version)
    .first<{ pending: number }>();
  if (remainingUploads) {
    await enqueueSyncContinuation(env, job);
    return;
  }
  await enqueueVerification(env, job, 0, 5);
}

async function providerInfo(
  env: Env,
  instance: AiSearchInstance,
  row: AiSearchItemRow,
): Promise<AiSearchItemInfo | null> {
  let itemId = row.item_id;
  if (!itemId) {
    const recovery = await recoverProviderItem(env, instance, row);
    if (recovery.state !== "found") return null;
    return recovery.item;
  }
  try {
    return await instance.items.get(itemId).info();
  } catch (error) {
    if (isNotFound(error)) return null;
    throw error;
  }
}

export async function verifyAiSearchNote(env: Env, job: VerifyAiSearchNoteJob): Promise<void> {
  const config = aiSearchConfig(env);
  if (!config.enabled) return;
  const note = await env.DB.prepare("SELECT * FROM notes WHERE id = ?")
    .bind(job.noteId)
    .first<NoteRow>();
  if (note?.deleted_at === null && note.ai_search_status === "disabled") return;
  if (note && note.deleted_at === null &&
      (note.version !== job.version || note.content_hash !== job.contentHash)) {
    // Current sync owns stale cleanup. A delayed verifier from an older
    // generation must never delete an item that the current generation reused.
    return;
  }
  const instance = await aiSearchInstance(env, config);
  if (!note || note.deleted_at !== null) {
    await disableDeletedNote(env, instance, job.noteId, job);
    return;
  }

  const desired = await buildAiSearchItems({
    id: note.id,
    title: note.title,
    body: note.body,
    version: note.version,
    contentHash: note.content_hash,
  }, config.maxItemsPerNote);
  const rows = (await env.DB.prepare(
    `SELECT * FROM ai_search_items
     WHERE note_id = ? AND note_content_hash = ? AND note_version = ?
     ORDER BY item_index ASC`,
  )
    .bind(note.id, note.content_hash, note.version)
    .all<AiSearchItemRow>()).results;
  const rowsByKey = new Map(rows.map((row) => [row.item_key, row]));
  if (desired.some((item) => !rowsByKey.has(item.itemKey))) {
    await enqueueSyncContinuation(env, job);
    return;
  }

  if (rows.some((row) =>
    row.sync_state === "pending" || row.sync_state === "uploading" ||
    row.sync_state === "failed" || row.sync_state === "deleting"
  )) {
    await enqueueSyncContinuation(env, job);
    return;
  }

  let stillProcessing = false;
  let needsSync = false;
  let madeProgress = false;
  const verificationRows = rows
    .filter((row) => row.sync_state !== "ready")
    .slice(0, AI_SEARCH_PAGE_SIZE);
  for (const row of verificationRows) {
    const info = await providerInfo(env, instance, row);
    if (!info) {
      await env.DB.prepare(
        `UPDATE ai_search_items SET sync_state = 'pending', item_id = NULL,
           provider_status = NULL, updated_at = ?
         WHERE item_key = ? AND note_content_hash = ? AND note_version = ?`,
      )
        .bind(Date.now(), row.item_key, note.content_hash, note.version)
        .run();
      needsSync = true;
      continue;
    }
    if (info.status === "completed" || info.status === "skipped") {
      if (!providerItemMatches(info, row.item_key, row.index_text_hash)) {
        await env.DB.prepare(
          `UPDATE ai_search_items SET item_id = ?, sync_state = 'pending',
             provider_status = ?, error_code = 'PROVIDER_METADATA_MISMATCH', updated_at = ?
           WHERE item_key = ? AND note_content_hash = ? AND note_version = ?`,
        )
          .bind(
            info.id,
            info.status,
            Date.now(),
            row.item_key,
            note.content_hash,
            note.version,
          )
          .run();
        needsSync = true;
        continue;
      }
      await env.DB.prepare(
        `UPDATE ai_search_items SET item_id = ?, sync_state = 'ready',
           provider_status = ?, error_code = NULL, updated_at = ?
         WHERE item_key = ? AND note_content_hash = ? AND note_version = ?`,
      )
        .bind(info.id, info.status, Date.now(), row.item_key, note.content_hash, note.version)
        .run();
      madeProgress = true;
      continue;
    }
    if (info.status === "error") {
      await env.DB.prepare(
        `UPDATE ai_search_items SET item_id = ?, sync_state = 'failed',
           provider_status = ?, error_code = 'PROVIDER_ITEM_ERROR', updated_at = ?
         WHERE item_key = ? AND note_content_hash = ? AND note_version = ?`,
      )
        .bind(info.id, info.status, Date.now(), row.item_key, note.content_hash, note.version)
        .run();
      needsSync = true;
      continue;
    }
    if (info.status === "outdated") needsSync = true;
    await env.DB.prepare(
      `UPDATE ai_search_items SET item_id = ?, sync_state = 'submitted',
         provider_status = ?, updated_at = ?
       WHERE item_key = ? AND note_content_hash = ? AND note_version = ?`,
    )
      .bind(info.id, info.status, Date.now(), row.item_key, note.content_hash, note.version)
      .run();
    stillProcessing = true;
  }

  if (needsSync) {
    await enqueueSyncContinuation(env, job);
    return;
  }

  if (stillProcessing) {
    if (!madeProgress && job.attempt >= MAX_VERIFY_ATTEMPTS) {
      await env.DB.prepare(
        `UPDATE notes SET ai_search_status = 'failed',
           ai_search_error_code = 'AI_SEARCH_VERIFY_TIMEOUT', ai_search_updated_at = ?
         WHERE id = ? AND version = ? AND content_hash = ?
           AND ai_search_status != 'disabled'`,
      )
        .bind(Date.now(), note.id, note.version, note.content_hash)
        .run();
      return;
    }
    const nextAttempt = madeProgress ? 0 : job.attempt + 1;
    await enqueueVerification(
      env,
      job,
      nextAttempt,
      Math.min(60, 5 * 2 ** Math.min(nextAttempt, 3)),
    );
    return;
  }

  // This invocation may have confirmed a full 200-item page. Continue in a
  // fresh invocation before stale deletion so status checks + cleanup never
  // share enough provider/D1 work to approach the subrequest ceiling.
  if (verificationRows.length > 0) {
    await enqueueVerification(env, job, 0, 1);
    return;
  }

  const readyUpdate = await env.DB.prepare(
    `UPDATE notes SET
       ai_search_status = 'ready', ai_search_indexed_content_hash = content_hash,
       ai_search_updated_at = ?, ai_search_error_code = NULL
     WHERE id = ? AND version = ? AND content_hash = ? AND deleted_at IS NULL
       AND ai_search_status = 'processing'`,
  )
    .bind(Date.now(), note.id, note.version, note.content_hash)
    .run();
  if ((readyUpdate.meta.changes ?? 0) !== 1) return;

  const stale = (await env.DB.prepare(
    `SELECT * FROM ai_search_items
     WHERE note_id = ? AND (note_content_hash != ? OR note_version != ?)
     ORDER BY item_index ASC LIMIT 200`,
  )
    .bind(note.id, note.content_hash, note.version)
    .all<AiSearchItemRow>()).results.slice(0, AI_SEARCH_PAGE_SIZE);
  await deleteProviderRows(env, instance, stale);
  const remainingStale = await env.DB.prepare(
    `SELECT 1 AS pending FROM ai_search_items
     WHERE note_id = ? AND (note_content_hash != ? OR note_version != ?)
     LIMIT 1`,
  )
    .bind(note.id, note.content_hash, note.version)
    .first<{ pending: number }>();
  if (remainingStale) await enqueueVerification(env, job, 0, 1);
}

export async function markAiSearchJobFailed(
  env: Env,
  job: SyncAiSearchNoteJob | VerifyAiSearchNoteJob,
  error: unknown,
): Promise<void> {
  await env.DB.prepare(
     `UPDATE notes SET ai_search_status = 'failed', ai_search_error_code = ?,
       ai_search_updated_at = ?
     WHERE id = ? AND version = ? AND content_hash = ?
       AND ai_search_status != 'disabled'`,
  )
    .bind(errorCode(error), Date.now(), job.noteId, job.version, job.contentHash)
    .run();
}
