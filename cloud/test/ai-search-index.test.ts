import { describe, expect, it, vi } from "vitest";

import { buildAiSearchItems } from "../src/ai-search-items";
import {
  deleteAiSearchItemsForNotes,
  syncAiSearchNote,
  verifyAiSearchNote,
} from "../src/ai-search-index";
import type {
  AiSearchItemRow,
  Env,
  NoteRow,
  SyncAiSearchNoteJob,
  VerifyAiSearchNoteJob,
} from "../src/types";

function note(overrides: Partial<NoteRow> = {}): NoteRow {
  const contentHash = overrides.content_hash ?? "hash-current";
  return {
    rowid: 1,
    id: "note-1",
    title: "恢复说明",
    body: "迁移入口位于设置页面。\n第二行说明。",
    version: 2,
    content_hash: contentHash,
    mutation_id: null,
    created_at: 1,
    updated_at: 2,
    last_opened_at: null,
    pinned: 0,
    archived: 0,
    deleted_at: null,
    embedding_status: "ready",
    embedding_model: null,
    embedded_content_hash: null,
    embedding_vector_id: null,
    embedding_updated_at: null,
    embedding_error_code: null,
    ai_search_status: "pending",
    ai_search_indexed_content_hash: null,
    ai_search_updated_at: null,
    ai_search_error_code: null,
    ...overrides,
  };
}

function itemRow(overrides: Partial<AiSearchItemRow> = {}): AiSearchItemRow {
  return {
    item_key: "nf_old_body_0_hash.txt",
    item_id: "provider-old-id",
    note_id: "note-1",
    note_content_hash: "hash-old",
    note_version: 1,
    item_index: 0,
    kind: "body",
    raw_line_index: 0,
    line_number: 1,
    char_start: 0,
    char_end: 3,
    text: "旧行",
    index_text_hash: "old-index-hash",
    sync_state: "ready",
    provider_status: "completed",
    error_code: null,
    upload_token: null,
    provider_scan_page: 1,
    provider_scan_pass: 0,
    provider_scan_total_count: null,
    created_at: 1,
    updated_at: 2,
    ...overrides,
  };
}

function syncJob(overrides: Partial<SyncAiSearchNoteJob> = {}): SyncAiSearchNoteJob {
  return {
    type: "sync-ai-search-note",
    eventId: "sync-event",
    noteId: "note-1",
    version: 2,
    contentHash: "hash-current",
    createdAt: 1,
    ...overrides,
  };
}

function verifyJob(overrides: Partial<VerifyAiSearchNoteJob> = {}): VerifyAiSearchNoteJob {
  return {
    type: "verify-ai-search-note",
    eventId: "verify-event",
    noteId: "note-1",
    version: 2,
    contentHash: "hash-current",
    attempt: 0,
    createdAt: 1,
    ...overrides,
  };
}

function itemKeyConflict(): Error & { code: number } {
  return Object.assign(new Error("AI Search item key already exists"), { code: 7042 });
}

interface HarnessOptions {
  notes?: NoteRow[];
  rows?: AiSearchItemRow[];
  uploadStatus?: "queued" | "running" | "completed" | "error" | "skipped" | "outdated";
  uploadError?: Error;
  uploadGate?: Promise<void>;
  onUploadStarted?: () => void;
  recoveredByKey?: Map<string, { id: string; key: string; status: string }>;
  providerItems?: Array<{ id: string; key: string; status: string; metadata?: Record<string, unknown> }>;
  listError?: Error;
  deleteErrorsById?: Map<string, Error>;
  infoById?: Map<string, { id: string; key: string; status: string }>;
  reuseStaleBeforeDelete?: boolean;
  semanticBackend?: "ai-search" | "vectorize";
  aiSearchEnabled?: "true" | "false";
}

function harness(options: HarnessOptions = {}) {
  const notes = options.notes ?? [note()];
  const rows = [...(options.rows ?? [])];
  const executed: Array<{ sql: string; bound: unknown[] }> = [];
  const sent: Array<{ body: unknown; options: unknown }> = [];
  const upload = vi.fn(async (
    key: string,
    _content: string,
    uploadOptions?: { metadata?: Record<string, unknown> },
  ) => {
    options.onUploadStarted?.();
    if (options.uploadGate) await options.uploadGate;
    if (options.uploadError) throw options.uploadError;
    return {
      id: `provider-${key}`,
      key,
      status: options.uploadStatus ?? "completed",
      metadata: uploadOptions?.metadata,
    };
  });
  const providerCatalog = options.providerItems ?? [...(options.recoveredByKey?.values() ?? [])];
  const providerList = vi.fn(async (
    params: {
      page?: number;
      per_page?: number;
      status?: string;
      sort_by?: string;
      search?: string;
      source?: string;
    },
  ) => {
    if (options.listError) throw options.listError;
    const page = params.page ?? 1;
    const perPage = params.per_page ?? 20;
    return {
      result: providerCatalog.slice((page - 1) * perPage, page * perPage),
      result_info: {
        count: Math.min(perPage, Math.max(0, providerCatalog.length - (page - 1) * perPage)),
        page,
        per_page: perPage,
        total_count: providerCatalog.length,
      },
    };
  });
  const providerDelete = vi.fn(async (id: string) => {
    const error = options.deleteErrorsById?.get(id);
    if (error) throw error;
  });
  const providerSync = vi.fn(async () => undefined);
  const providerInfo = vi.fn(async (id: string) => {
    const configured = options.infoById?.get(id);
    if (configured) return configured;
    const catalogItem = providerCatalog.find((item) => item.id === id);
    if (catalogItem) return catalogItem;
    const row = rows.find((item) => item.item_id === id);
    return {
      id,
      key: row?.item_key ?? `key-for-${id}`,
      status: "completed",
      metadata: row
        ? { schema_version: 1, index_hash: row.index_text_hash }
        : undefined,
    };
  });
  const providerGet = vi.fn((id: string) => ({
    info: () => providerInfo(id),
    sync: providerSync,
  }));
  const instanceInfo = vi.fn(async () => ({
    id: "notesflash-search",
    embedding_model: "@cf/google/embeddinggemma-300m",
    index_method: { vector: true, keyword: true },
    fusion_method: "rrf",
    indexing_options: { keyword_tokenizer: "trigram" },
    retrieval_options: { keyword_match_mode: "or" },
    rewrite_query: false,
    reranking: false,
    score_threshold: 0.4,
    max_num_results: 50,
    cache: false,
    custom_metadata: [
      { field_name: "schema_version", data_type: "number" },
      { field_name: "note_id", data_type: "text" },
      { field_name: "kind", data_type: "text" },
      { field_name: "raw_line_index", data_type: "number" },
      { field_name: "index_hash", data_type: "text" },
    ],
  }));
  const instance = {
    search: vi.fn(),
    info: instanceInfo,
    update: vi.fn(async () => ({})),
    items: {
      upload,
      list: providerList,
      delete: providerDelete,
      get: providerGet,
    },
    jobs: {},
  };
  const namespace = {
    list: vi.fn(async () => ({
      result: [{
        id: "notesflash-search",
        index_method: { vector: true, keyword: true },
        fusion_method: "rrf",
        indexing_options: { keyword_tokenizer: "trigram" },
        retrieval_options: { keyword_match_mode: "or" },
        chunk: false,
        reranking: false,
        cache: false,
        max_num_results: 50,
      }],
    })),
    get: vi.fn(() => instance),
    create: vi.fn(),
  };

  function preparedStatement(sql: string) {
    let bound: unknown[] = [];
    return {
      bind(...values: unknown[]) {
        bound = values;
        return this;
      },
      async first() {
        executed.push({ sql, bound });
        if (sql.includes("SELECT COUNT(*) AS remaining_items FROM ai_search_items")) {
          const noteIds = new Set(bound.map(String));
          return {
            remaining_items: rows.filter((row) => noteIds.has(row.note_id)).length,
          };
        }
        if (sql.includes("SELECT 1 AS current FROM notes")) {
          const current = notes.find((row) =>
            row.id === String(bound[0]) && row.version === Number(bound[1]) &&
            row.content_hash === String(bound[2]) && row.deleted_at === null &&
            (!sql.includes("ai_search_status = 'processing'") ||
              row.ai_search_status === "processing")
          );
          return current ? { current: 1 } : null;
        }
        if (sql.includes("SELECT 1 AS live FROM notes")) {
          const live = notes.find((row) => row.id === String(bound[0]) && row.deleted_at === null);
          return live ? { live: 1 } : null;
        }
        if (sql.includes("SELECT 1 AS mapped FROM ai_search_items")) {
          return rows.some((row) => row.note_id === String(bound[0])) ? { mapped: 1 } : null;
        }
        if (sql.includes("SELECT 1 AS pending FROM ai_search_items")) {
          const noteId = String(bound[0]);
          let pending = rows.filter((row) => row.note_id === noteId);
          if (sql.includes("note_content_hash != ? OR note_version != ?")) {
            pending = pending.filter((row) =>
              row.note_content_hash !== String(bound[1]) || row.note_version !== Number(bound[2])
            );
          } else if (sql.includes("note_content_hash = ?")) {
            pending = pending.filter((row) =>
              row.note_content_hash === String(bound[1]) && row.note_version === Number(bound[2])
            );
          }
          if (sql.includes("sync_state IN ('pending', 'failed', 'uploading')")) {
            pending = pending.filter((row) =>
              row.sync_state === "pending" || row.sync_state === "failed" ||
              row.sync_state === "uploading"
            );
          }
          return pending.length > 0 ? { pending: 1 } : null;
        }
        if (sql.includes("SELECT * FROM ai_search_items")) {
          return rows.find((row) =>
            row.item_key === String(bound[0]) &&
            row.note_content_hash === String(bound[1]) &&
            row.note_version === Number(bound[2])
          ) ?? null;
        }
        if (sql.includes("SELECT * FROM notes WHERE id = ?")) {
          return notes.find((row) => row.id === String(bound[0])) ?? null;
        }
        return null;
      },
      async all() {
        executed.push({ sql, bound });
        if (!sql.includes("FROM ai_search_items")) return { results: [] };
        const usesNoteIdGroup = sql.includes("note_id IN (");
        const noteIdBindings = usesNoteIdGroup
          ? bound.slice(0, sql.includes("LIMIT ?") ? -1 : bound.length).map(String)
          : [String(bound[0])];
        const noteIds = new Set(noteIdBindings);
        let selected = rows.filter((row) => noteIds.has(row.note_id));
        if (sql.includes("note_content_hash != ? OR note_version != ?")) {
          selected = selected.filter((row) =>
            row.note_content_hash !== String(bound[1]) || row.note_version !== Number(bound[2])
          );
        } else if (sql.includes("note_content_hash != ?")) {
          selected = selected.filter((row) => row.note_content_hash !== String(bound[1]));
        } else if (sql.includes("note_content_hash = ?")) {
          selected = selected.filter((row) => row.note_content_hash === String(bound[1]));
        }
        if (sql.includes("note_version = ?")) {
          selected = selected.filter((row) => row.note_version === Number(bound[2]));
        }
        if (sql.includes("sync_state IN ('pending', 'failed', 'uploading')")) {
          selected = selected.filter((row) =>
            row.sync_state === "pending" || row.sync_state === "failed" ||
            row.sync_state === "uploading"
          );
        }
        if (sql.includes("ORDER BY item_index")) {
          selected = [...selected].sort((left, right) => left.item_index - right.item_index);
        } else if (sql.includes("ORDER BY note_id")) {
          selected = [...selected].sort((left, right) =>
            left.note_id.localeCompare(right.note_id) ||
            left.item_index - right.item_index ||
            left.item_key.localeCompare(right.item_key)
          );
        }
        if (usesNoteIdGroup && sql.includes("LIMIT ?")) {
          selected = selected.slice(0, Number(bound.at(-1)));
        }
        const result = selected.map((row) => ({ ...row }));
        if (options.reuseStaleBeforeDelete &&
            sql.includes("note_content_hash != ? OR note_version != ?")) {
          for (const stale of selected) {
            stale.note_content_hash = String(bound[1]);
            stale.note_version = Number(bound[2]);
          }
        }
        return { results: result };
      },
      async run() {
        executed.push({ sql, bound });
        if (sql.includes("INSERT INTO ai_search_items")) {
          const sourceNote = notes.find((item) =>
            item.id === String(bound[14]) && item.version === Number(bound[15]) &&
            item.content_hash === String(bound[16]) && item.deleted_at === null &&
            item.ai_search_status === "processing"
          );
          if (!sourceNote) return { meta: { changes: 0 } };
          const key = String(bound[0]);
          const existing = rows.find((row) => row.item_key === key);
          if (existing?.upload_token && existing.updated_at > Number(bound[17])) {
            return { meta: { changes: 0 } };
          }
          const next = {
            item_key: key,
            item_id: existing?.item_id ?? null,
            note_id: String(bound[1]),
            note_content_hash: String(bound[2]),
            note_version: Number(bound[3]),
            item_index: Number(bound[4]),
            kind: String(bound[5]) as "title" | "body",
            raw_line_index: bound[6] === null ? null : Number(bound[6]),
            line_number: bound[7] === null ? null : Number(bound[7]),
            char_start: bound[8] === null ? null : Number(bound[8]),
            char_end: bound[9] === null ? null : Number(bound[9]),
            text: String(bound[10]),
            index_text_hash: String(bound[11]),
            sync_state: existing?.item_id &&
                (existing.sync_state === "submitted" || existing.sync_state === "ready")
              ? existing.sync_state
              : "pending" as const,
            provider_status: existing?.provider_status ?? null,
            error_code: null,
            upload_token: existing?.upload_token ?? null,
            provider_scan_page: existing?.provider_scan_page ?? 1,
            provider_scan_pass: existing?.provider_scan_pass ?? 0,
            provider_scan_total_count: existing?.provider_scan_total_count ?? null,
            created_at: existing?.created_at ?? Number(bound[12]),
            updated_at: Number(bound[13]),
          } satisfies AiSearchItemRow;
          if (existing) Object.assign(existing, next, { upload_token: null });
          else rows.push(next);
        } else if (sql.includes("SET sync_state = 'deleting', updated_at = ?")) {
          const row = rows.find((item) => item.item_key === String(bound[1]));
          if (row) row.sync_state = "deleting";
        } else if (sql.includes("sync_state = 'uploading', upload_token = ?")) {
          const row = rows.find((item) =>
            item.item_key === String(bound[2]) &&
            item.note_content_hash === String(bound[3]) &&
            item.note_version === Number(bound[4]) &&
            item.sync_state === String(bound[5]) &&
            item.updated_at === Number(bound[6]) &&
            item.upload_token === (bound[7] === null ? null : String(bound[7]))
          );
          const current = notes.find((item) =>
            item.id === String(bound[9]) && item.version === Number(bound[10]) &&
            item.content_hash === String(bound[11]) && item.deleted_at === null &&
            item.ai_search_status === "processing"
          );
          if (!row || !current) return { meta: { changes: 0 } };
          row.sync_state = "uploading";
          row.upload_token = String(bound[0]);
          row.updated_at = Number(bound[1]);
          return { meta: { changes: 1 } };
        } else if (sql.includes("sync_state = 'deleting', upload_token = ?")) {
          const row = rows.find((item) =>
            item.item_key === String(bound[2]) &&
            item.note_content_hash === String(bound[3]) &&
            item.note_version === Number(bound[4]) &&
            item.sync_state === String(bound[5]) &&
            item.updated_at === Number(bound[6]) &&
            item.upload_token === (bound[7] === null ? null : String(bound[7]))
          );
          if (!row) return { meta: { changes: 0 } };
          row.sync_state = "deleting";
          row.upload_token = String(bound[0]);
          row.updated_at = Number(bound[1]);
          return { meta: { changes: 1 } };
        } else if (sql.includes("sync_state = ?, upload_token = NULL")) {
          const row = rows.find((item) =>
            item.item_key === String(bound[2]) &&
            item.note_content_hash === String(bound[3]) &&
            item.note_version === Number(bound[4]) &&
            item.upload_token === String(bound[5])
          );
          if (!row) return { meta: { changes: 0 } };
          row.sync_state = String(bound[0]) as AiSearchItemRow["sync_state"];
          row.upload_token = null;
          row.updated_at = Number(bound[1]);
          return { meta: { changes: 1 } };
        } else if (sql.includes("sync_state = 'failed', upload_token = NULL")) {
          const row = rows.find((item) =>
            item.item_key === String(bound[2]) &&
            item.note_content_hash === String(bound[3]) &&
            item.note_version === Number(bound[4]) &&
            item.upload_token === String(bound[5])
          );
          if (!row) return { meta: { changes: 0 } };
          row.sync_state = "failed";
          row.upload_token = null;
          row.error_code = String(bound[0]);
          row.updated_at = Number(bound[1]);
          return { meta: { changes: 1 } };
        } else if (sql.includes("sync_state = CASE WHEN sync_state = 'deleting'")) {
          const row = rows.find((item) =>
            item.item_key === String(bound[4]) &&
            item.note_content_hash === String(bound[5]) &&
            item.note_version === Number(bound[6]) &&
            item.upload_token === String(bound[7])
          );
          if (!row) return { meta: { changes: 0 } };
          row.item_id = String(bound[0]);
          if (row.sync_state !== "deleting") {
            row.sync_state = String(bound[1]) as AiSearchItemRow["sync_state"];
          }
          row.provider_status = String(bound[2]);
          row.upload_token = null;
          row.provider_scan_page = 1;
          row.provider_scan_pass = 0;
          row.provider_scan_total_count = null;
          row.updated_at = Number(bound[3]);
          return { meta: { changes: 1 } };
        } else if (sql.includes("item_id = ?, provider_status = ?, updated_at = ?") &&
                   sql.includes("index_text_hash = ?")) {
          const row = rows.find((item) =>
            item.item_key === String(bound[3]) && item.index_text_hash === String(bound[4]) &&
            item.item_id === null
          );
          if (!row) return { meta: { changes: 0 } };
          row.item_id = String(bound[0]);
          row.provider_status = String(bound[1]);
          row.updated_at = Number(bound[2]);
          return { meta: { changes: 1 } };
        } else if (sql.includes("item_id = ? AND sync_state = 'uploading'")) {
          const row = rows.find((item) =>
            item.item_key === String(bound[3]) &&
            item.note_content_hash === String(bound[4]) &&
            item.note_version === Number(bound[5]) &&
            item.item_id === String(bound[6]) && item.upload_token === null &&
            item.sync_state === "uploading"
          );
          if (!row) return { meta: { changes: 0 } };
          row.sync_state = String(bound[0]) as AiSearchItemRow["sync_state"];
          row.provider_status = String(bound[1]);
          row.updated_at = Number(bound[2]);
          return { meta: { changes: 1 } };
        } else if (
          sql.includes("provider_scan_page = ?, provider_scan_pass = ?") &&
          sql.includes("AND provider_scan_page = ?")
        ) {
          const row = rows.find((item) =>
            item.item_key === String(bound[3]) &&
            item.note_content_hash === String(bound[4]) &&
            item.note_version === Number(bound[5]) &&
            item.item_id === null
          );
          const expectedTotal = bound[8] === null ? null : Number(bound[8]);
          const matchesCursor = row !== undefined &&
            row.provider_scan_page === Number(bound[6]) &&
            row.provider_scan_pass === Number(bound[7]) &&
            row.provider_scan_total_count === expectedTotal;
          if (!row || !matchesCursor) return { meta: { changes: 0 } };
          row.provider_scan_page = Number(bound[0]);
          row.provider_scan_pass = Number(bound[1]);
          row.provider_scan_total_count = bound[2] === null ? null : Number(bound[2]);
          return { meta: { changes: 1 } };
        } else if (
          sql.includes("item_id = ?, provider_status = ?, provider_scan_page = 1")
        ) {
          const row = rows.find((item) =>
            item.item_key === String(bound[3]) &&
            item.note_content_hash === String(bound[4]) &&
            item.note_version === Number(bound[5]) &&
            item.item_id === null
          );
          if (!row) return { meta: { changes: 0 } };
          row.item_id = String(bound[0]);
          row.provider_status = String(bound[1]);
          row.provider_scan_page = 1;
          row.provider_scan_pass = 0;
          row.provider_scan_total_count = null;
          return { meta: { changes: 1 } };
        } else if (sql.includes("item_id = ?, sync_state = ?, provider_status")) {
          const row = rows.find((item) => item.item_key === String(bound[4]));
          if (row) {
            row.item_id = String(bound[0]);
            row.sync_state = String(bound[1]) as AiSearchItemRow["sync_state"];
            row.provider_status = String(bound[2]);
            row.error_code = null;
            row.provider_scan_page = 1;
            row.provider_scan_pass = 0;
            row.provider_scan_total_count = null;
          }
        } else if (sql.includes("PROVIDER_METADATA_MISMATCH")) {
          const row = rows.find((item) => item.item_key === String(bound[3]));
          if (row) {
            row.item_id = String(bound[0]);
            row.sync_state = "pending";
            row.provider_status = String(bound[1]);
            row.error_code = "PROVIDER_METADATA_MISMATCH";
          }
        } else if (sql.includes("sync_state = 'pending', item_id = NULL")) {
          const row = rows.find((item) => item.item_key === String(bound[1]));
          if (row) {
            row.item_id = null;
            row.sync_state = "pending";
            row.provider_status = null;
            if (sql.includes("provider_scan_page = 1")) {
              row.provider_scan_page = 1;
              row.provider_scan_pass = 0;
              row.provider_scan_total_count = null;
            }
          }
        } else if (sql.includes("sync_state = 'failed'") && sql.includes("PROVIDER_ITEM_ERROR")) {
          const row = rows.find((item) => item.item_key === String(bound[3]));
          if (row) {
            row.item_id = String(bound[0]);
            row.sync_state = "failed";
            row.provider_status = String(bound[1]);
            row.error_code = "PROVIDER_ITEM_ERROR";
          }
        } else if (sql.includes("sync_state = 'ready'") && sql.includes("WHERE item_key")) {
          const row = rows.find((item) => item.item_key === String(bound[3]));
          if (row) {
            row.item_id = String(bound[0]);
            row.sync_state = "ready";
            row.provider_status = String(bound[1]);
          }
        } else if (sql.includes("sync_state = 'submitted'") && sql.includes("WHERE item_key")) {
          const row = rows.find((item) => item.item_key === String(bound[3]));
          if (row) {
            row.item_id = String(bound[0]);
            row.sync_state = "submitted";
            row.provider_status = String(bound[1]);
          }
        } else if (sql.startsWith("DELETE FROM ai_search_items")) {
          const index = rows.findIndex((row) => row.item_key === String(bound[0]));
          if (index >= 0) rows.splice(index, 1);
        } else if (sql.includes("ai_search_status = 'processing', ai_search_updated_at")) {
          const current = notes.find((row) => row.id === String(bound[1]));
          if (current && current.version === Number(bound[2]) &&
              current.content_hash === String(bound[3]) &&
              current.ai_search_status !== "disabled") {
            current.ai_search_status = "processing";
          } else {
            return { meta: { changes: 0 } };
          }
        } else if (sql.includes("ai_search_status = 'disabled'")) {
          const current = notes.find((row) => row.id === String(bound[1]));
          if (current?.deleted_at !== null) {
            current.ai_search_status = "disabled";
            current.ai_search_indexed_content_hash = null;
          }
        } else if (sql.includes("ai_search_status = 'ready'")) {
          const current = notes.find((row) => row.id === String(bound[1]));
          if (current && current.version === Number(bound[2]) && current.content_hash === String(bound[3])) {
            current.ai_search_status = "ready";
            current.ai_search_indexed_content_hash = current.content_hash;
            return { meta: { changes: 1 } };
          }
          return { meta: { changes: 0 } };
        }
        return { meta: { changes: 1 } };
      },
    };
  }

  const db = {
    prepare: (sql: string) => preparedStatement(sql),
    async batch(statements: Array<{ run: () => Promise<unknown> }>) {
      const results = [];
      for (const statement of statements) results.push(await statement.run());
      return results;
    },
  };
  const env = {
    DB: db,
    AI_SEARCH: namespace,
    AI: { run: vi.fn() },
    INDEX_QUEUE: {
      send: vi.fn(async (body: unknown, sendOptions?: unknown) => {
        sent.push({ body, options: sendOptions });
      }),
    },
    SEMANTIC_BACKEND: options.semanticBackend ?? "ai-search",
    AI_SEARCH_ENABLED: options.aiSearchEnabled,
  } as unknown as Env;

  return {
    env,
    notes,
    rows,
    executed,
    sent,
    upload,
    providerList,
    providerDelete,
    providerGet,
    providerInfo,
    namespace,
  };
}

describe("AI Search index synchronization", () => {
  it("persists every provider item ID returned by upload and schedules bounded verification", async () => {
    const test = harness();

    await syncAiSearchNote(test.env, syncJob());

    expect(test.upload).toHaveBeenCalledTimes(3);
    expect(test.rows).toHaveLength(3);
    expect(test.rows.every((row) => row.item_id === `provider-${row.item_key}`)).toBe(true);
    expect(test.rows.every((row) => row.sync_state === "ready")).toBe(true);
    for (const call of test.upload.mock.calls) {
      const [key, content, uploadOptions] = call;
      expect(key).toMatch(/^nf_[a-f0-9]{20}_(?:title|body_\d+)_[a-f0-9]{64}\.txt$/);
      expect(content).toEqual(expect.any(String));
      expect(uploadOptions).toMatchObject({
        metadata: {
          schema_version: "1",
          index_hash: expect.any(String),
        },
      });
      expect(Object.values(uploadOptions?.metadata ?? {}).every(
        (value) => typeof value === "string",
      )).toBe(true);
      expect(uploadOptions?.metadata).not.toHaveProperty("note_id");
    }
    expect(test.sent).toHaveLength(1);
    expect(test.sent[0]).toMatchObject({
      body: {
        type: "verify-ai-search-note",
        noteId: "note-1",
        version: 2,
        contentHash: "hash-current",
        attempt: 0,
      },
      options: { delaySeconds: 5 },
    });
  });

  it("recovers a 7042 same-key upload conflict and persists the recovered provider ID", async () => {
    const current = note({ body: "只有一行" });
    const desired = await buildAiSearchItems({
      id: current.id,
      title: current.title,
      body: current.body,
      version: current.version,
      contentHash: current.content_hash,
    });
    const recoveredByKey = new Map(desired.map((item) => [
      item.itemKey,
      {
        id: `recovered-${item.itemIndex}`,
        key: item.itemKey,
        status: "completed",
        metadata: item.metadata,
      },
    ]));
    const test = harness({
      notes: [current],
      uploadError: itemKeyConflict(),
      recoveredByKey,
    });

    await syncAiSearchNote(test.env, syncJob());

    expect(test.upload).toHaveBeenCalledTimes(2);
    expect(test.providerList).toHaveBeenCalledTimes(2);
    for (const [params] of test.providerList.mock.calls) {
      expect(params).toEqual({
        page: 1,
        per_page: 50,
        source: "builtin",
        sort_by: "modified_at",
      });
      expect(params).not.toHaveProperty("key");
      expect(params).not.toHaveProperty("search");
    }
    expect(test.rows.map((row) => row.item_id)).toEqual(["recovered-0", "recovered-1"]);
  });

  it("does not misclassify a non-7042 upload failure as a key conflict", async () => {
    const providerError = new Error("provider quota temporarily unavailable");
    const test = harness({ uploadError: providerError });

    await expect(syncAiSearchNote(test.env, syncJob())).rejects.toMatchObject({
      code: "AI_SEARCH_PROVIDER_UPLOAD_FAILED",
    });

    expect(test.providerList).not.toHaveBeenCalled();
    expect(test.rows.every((row) => row.item_id === null)).toBe(true);
    expect(test.rows.every((row) => row.sync_state === "failed")).toBe(true);
    expect(test.rows.every((row) => row.upload_token === null)).toBe(true);
    expect(test.rows.every((row) => row.error_code === "AI_SEARCH_RATE_LIMITED")).toBe(true);
  });

  it("retains a privacy-safe provider error token for aggregate diagnostics", async () => {
    const providerError = new Error("rate_limit_exceeded");
    const test = harness({ uploadError: providerError });

    await expect(syncAiSearchNote(test.env, syncJob())).rejects.toMatchObject({
      code: "AI_SEARCH_PROVIDER_UPLOAD_FAILED",
    });

    expect(test.rows.every((row) => row.error_code === "AI_SEARCH_RATE_LIMITED")).toBe(true);
  });

  it("categorizes provider prose without persisting the prose itself", async () => {
    const providerError = new Error("The item already exists in built-in storage");
    const test = harness({ uploadError: providerError });

    await expect(syncAiSearchNote(test.env, syncJob())).rejects.toMatchObject({
      code: "AI_SEARCH_PROVIDER_UPLOAD_FAILED",
    });

    expect(test.rows.every((row) => row.error_code === "AI_SEARCH_ITEM_CONFLICT")).toBe(true);
    expect(test.rows.some((row) => row.error_code?.includes("built-in storage"))).toBe(false);
  });

  it("resumes the official full-list cursor across invocations and finds an exact key on page two", async () => {
    const target = itemRow({ item_key: "page-two-target", item_id: null });
    const providerItems = [
      ...Array.from({ length: 50 }, (_, index) => ({
        id: `noise-${index}`,
        key: `noise-key-${index}`,
        status: "completed",
      })),
      {
        id: "provider-page-two",
        key: target.item_key,
        status: "completed",
        metadata: { schema_version: 1, index_hash: target.index_text_hash },
      },
    ];
    const test = harness({
      rows: [target],
      uploadError: itemKeyConflict(),
      providerItems,
    });

    await expect(deleteAiSearchItemsForNotes(test.env, [target.note_id]))
      .resolves.toEqual({ deletedItems: 0, complete: false, remainingItems: 1 });
    expect(target).toMatchObject({
      item_id: null,
      provider_scan_page: 2,
      provider_scan_pass: 0,
      provider_scan_total_count: 51,
    });

    await expect(deleteAiSearchItemsForNotes(test.env, [target.note_id]))
      .resolves.toEqual({ deletedItems: 1, complete: true, remainingItems: 0 });
    expect(test.upload).toHaveBeenCalledOnce();
    expect(test.providerList.mock.calls.map(([params]) => params.page)).toEqual([1, 2]);
    for (const [params] of test.providerList.mock.calls) {
      expect(params).toMatchObject({ per_page: 50, source: "builtin", sort_by: "modified_at" });
      expect(params).not.toHaveProperty("key");
      expect(params).not.toHaveProperty("search");
    }
    expect(test.providerGet).toHaveBeenCalledWith("provider-page-two");
    expect(test.providerDelete).toHaveBeenCalledWith("provider-page-two");
  });

  it("ignores an old sync job before it can upload or mutate the current manifest", async () => {
    const existing = itemRow({
      item_key: "current-key",
      item_id: "current-provider-id",
      note_content_hash: "hash-current",
      note_version: 2,
    });
    const test = harness({ rows: [existing] });

    await syncAiSearchNote(test.env, syncJob({ version: 1, contentHash: "hash-old" }));

    expect(test.upload).not.toHaveBeenCalled();
    expect(test.namespace.list).not.toHaveBeenCalled();
    expect(test.rows).toEqual([existing]);
    expect(test.sent).toEqual([]);
    expect(test.notes[0].ai_search_status).toBe("pending");
  });

  it("makes a delayed verifier for an old generation a true no-op", async () => {
    const stale = itemRow({
      item_key: "private-stale-key",
      item_id: "provider-stale-id",
      note_content_hash: "hash-old",
      note_version: 1,
    });
    const test = harness({ rows: [stale] });

    await verifyAiSearchNote(test.env, verifyJob({ version: 1, contentHash: "hash-old" }));

    expect(test.namespace.list).not.toHaveBeenCalled();
    expect(test.providerDelete).not.toHaveBeenCalled();
    expect(test.rows).toEqual([stale]);
  });

  it("deletes rows from older generations by provider item ID after the current generation is ready", async () => {
    const current = note({ ai_search_status: "processing" });
    const desired = await buildAiSearchItems({
      id: current.id,
      title: current.title,
      body: current.body,
      version: current.version,
      contentHash: current.content_hash,
    });
    const currentRows: AiSearchItemRow[] = desired.map((item) => itemRow({
      item_key: item.itemKey,
      item_id: `provider-current-${item.itemIndex}`,
      note_id: current.id,
      note_content_hash: current.content_hash,
      note_version: current.version,
      item_index: item.itemIndex,
      kind: item.kind,
      raw_line_index: item.rawLineIndex,
      line_number: item.lineNumber,
      char_start: item.charStart,
      char_end: item.charEnd,
      text: item.text,
      index_text_hash: item.indexTextHash,
      sync_state: "ready",
      provider_status: "completed",
      error_code: null,
      created_at: 1,
      updated_at: 2,
    }));
    const stale = itemRow({
      item_key: "private-stale-key",
      item_id: "provider-stale-id",
      note_content_hash: "hash-old",
      note_version: 1,
    });
    const test = harness({ notes: [current], rows: [...currentRows, stale] });

    await verifyAiSearchNote(test.env, verifyJob());

    expect(test.providerDelete).toHaveBeenCalledOnce();
    expect(test.providerDelete).toHaveBeenCalledWith("provider-stale-id");
    expect(test.providerDelete).not.toHaveBeenCalledWith("private-stale-key");
    expect(test.rows).toEqual(currentRows);
    expect(current.ai_search_status).toBe("ready");
    expect(current.ai_search_indexed_content_hash).toBe("hash-current");
  });

  it("does not delete an item key that a newer generation reused after stale selection", async () => {
    const current = note({ ai_search_status: "processing" });
    const desired = await buildAiSearchItems({
      id: current.id,
      title: current.title,
      body: current.body,
      version: current.version,
      contentHash: current.content_hash,
    });
    const currentRows: AiSearchItemRow[] = desired.map((item) => itemRow({
      item_key: item.itemKey,
      item_id: `provider-current-${item.itemIndex}`,
      note_content_hash: current.content_hash,
      note_version: current.version,
      item_index: item.itemIndex,
      kind: item.kind,
      raw_line_index: item.rawLineIndex,
      line_number: item.lineNumber,
      char_start: item.charStart,
      char_end: item.charEnd,
      text: item.text,
      index_text_hash: item.indexTextHash,
      sync_state: "ready",
    }));
    const stale = itemRow({
      item_key: "reused-key",
      item_id: "provider-reused",
      note_content_hash: "hash-old",
      note_version: 1,
    });
    const test = harness({
      notes: [current],
      rows: [...currentRows, stale],
      reuseStaleBeforeDelete: true,
    });

    await verifyAiSearchNote(test.env, verifyJob());

    expect(test.providerDelete).not.toHaveBeenCalled();
    expect(test.rows.find((row) => row.item_key === "reused-key")).toMatchObject({
      item_id: "provider-reused",
      note_content_hash: "hash-current",
      note_version: 2,
    });
  });

  it("requeues synchronization when completed provider metadata does not match the manifest", async () => {
    const current = note({ ai_search_status: "processing" });
    const desired = await buildAiSearchItems({
      id: current.id,
      title: current.title,
      body: current.body,
      version: current.version,
      contentHash: current.content_hash,
    });
    const rows = desired.map((item, index) => itemRow({
      item_key: item.itemKey,
      item_id: `provider-current-${index}`,
      note_content_hash: current.content_hash,
      note_version: current.version,
      item_index: item.itemIndex,
      kind: item.kind,
      raw_line_index: item.rawLineIndex,
      line_number: item.lineNumber,
      char_start: item.charStart,
      char_end: item.charEnd,
      text: item.text,
      index_text_hash: item.indexTextHash,
      sync_state: index === 0 ? "submitted" : "ready",
    }));
    const infoById = new Map([[
      "provider-current-0",
      {
        id: "provider-current-0",
        key: desired[0].itemKey,
        status: "completed",
        metadata: { schema_version: 1, index_hash: "wrong-hash" },
      },
    ]]);
    const test = harness({ notes: [current], rows, infoById });

    await verifyAiSearchNote(test.env, verifyJob());

    expect(rows[0]).toMatchObject({
      sync_state: "pending",
      error_code: "PROVIDER_METADATA_MISMATCH",
    });
    expect(test.sent).toHaveLength(1);
    expect(test.sent[0]).toMatchObject({
      body: { type: "sync-ai-search-note", contentHash: "hash-current" },
      options: { delaySeconds: 1 },
    });
    expect(current.ai_search_status).toBe("processing");
  });

  it.each(["missing", "error"] as const)(
    "requeues synchronization when a provider item is %s",
    async (failure) => {
      const current = note({ ai_search_status: "processing" });
      const desired = await buildAiSearchItems({
        id: current.id,
        title: current.title,
        body: current.body,
        version: current.version,
        contentHash: current.content_hash,
      });
      const rows = desired.map((item, index) => itemRow({
        item_key: item.itemKey,
        item_id: index === 0 && failure === "missing" ? null : `provider-current-${index}`,
        note_content_hash: current.content_hash,
        note_version: current.version,
        item_index: item.itemIndex,
        kind: item.kind,
        raw_line_index: item.rawLineIndex,
        line_number: item.lineNumber,
        char_start: item.charStart,
        char_end: item.charEnd,
        text: item.text,
        index_text_hash: item.indexTextHash,
        sync_state: index === 0 ? "submitted" : "ready",
      }));
      const infoById = failure === "error"
        ? new Map([[
          "provider-current-0",
          {
            id: "provider-current-0",
            key: desired[0].itemKey,
            status: "error",
            metadata: desired[0].metadata,
          },
        ]])
        : undefined;
      const test = harness({ notes: [current], rows, infoById });

      await verifyAiSearchNote(test.env, verifyJob());

      expect(rows[0].sync_state).toBe(failure === "missing" ? "pending" : "failed");
      expect(test.sent).toHaveLength(1);
      expect(test.sent[0]).toMatchObject({
        body: { type: "sync-ai-search-note", contentHash: "hash-current" },
        options: { delaySeconds: 1 },
      });
      expect(test.sent[0].body).not.toMatchObject({ type: "verify-ai-search-note" });
    },
  );

  it("uploads only one 200-item page and enqueues a sync continuation", async () => {
    const current = note({
      body: Array.from({ length: 250 }, (_, index) => `logical line ${index}`).join("\n"),
    });
    const test = harness({ notes: [current] });

    await syncAiSearchNote(test.env, syncJob());

    expect(test.upload).toHaveBeenCalledTimes(200);
    expect(test.rows).toHaveLength(251);
    expect(test.rows.filter((row) => row.sync_state === "ready")).toHaveLength(200);
    expect(test.rows.filter((row) => row.sync_state === "pending")).toHaveLength(51);
    expect(test.sent).toHaveLength(1);
    expect(test.sent[0]).toMatchObject({
      body: {
        type: "sync-ai-search-note",
        noteId: "note-1",
        version: 2,
        contentHash: "hash-current",
      },
      options: { delaySeconds: 1 },
    });
    expect(test.sent[0].body).not.toMatchObject({ type: "verify-ai-search-note" });
  });

  it("deletes only one 200-item page from a removed note and defers disabling it", async () => {
    const deleted = note({ deleted_at: 100, ai_search_status: "processing" });
    const rows = Array.from({ length: 250 }, (_, index) => itemRow({
      item_key: `deleted-key-${index}`,
      item_id: `deleted-provider-${index}`,
      note_content_hash: deleted.content_hash,
      note_version: deleted.version,
      item_index: index,
    }));
    const test = harness({ notes: [deleted], rows });

    await syncAiSearchNote(test.env, syncJob());

    expect(test.providerDelete).toHaveBeenCalledTimes(200);
    expect(test.rows).toHaveLength(50);
    expect(deleted.ai_search_status).toBe("processing");
    expect(test.sent).toHaveLength(1);
    expect(test.sent[0]).toMatchObject({
      body: { type: "sync-ai-search-note", noteId: "note-1" },
      options: { delaySeconds: 1 },
    });
  });

  it("cleans one 200-item stale page and continues verification for the remainder", async () => {
    const current = note({ ai_search_status: "processing" });
    const desired = await buildAiSearchItems({
      id: current.id,
      title: current.title,
      body: current.body,
      version: current.version,
      contentHash: current.content_hash,
    });
    const currentRows: AiSearchItemRow[] = desired.map((item) => itemRow({
      item_key: item.itemKey,
      item_id: `current-provider-${item.itemIndex}`,
      note_content_hash: current.content_hash,
      note_version: current.version,
      item_index: item.itemIndex,
      kind: item.kind,
      raw_line_index: item.rawLineIndex,
      line_number: item.lineNumber,
      char_start: item.charStart,
      char_end: item.charEnd,
      text: item.text,
      index_text_hash: item.indexTextHash,
      sync_state: "ready",
    }));
    const staleRows = Array.from({ length: 250 }, (_, index) => itemRow({
      item_key: `stale-key-${index}`,
      item_id: `stale-provider-${index}`,
      note_content_hash: "hash-old",
      note_version: 1,
      item_index: 1_000 + index,
    }));
    const test = harness({ notes: [current], rows: [...currentRows, ...staleRows] });

    await verifyAiSearchNote(test.env, verifyJob());

    expect(test.providerDelete).toHaveBeenCalledTimes(200);
    expect(test.rows.filter((row) => row.note_content_hash === "hash-old")).toHaveLength(50);
    expect(test.rows.filter((row) => row.note_content_hash === "hash-current")).toHaveLength(
      currentRows.length,
    );
    expect(current.ai_search_status).toBe("ready");
    expect(test.sent).toHaveLength(1);
    expect(test.sent[0]).toMatchObject({
      body: { type: "verify-ai-search-note", attempt: 0 },
      options: { delaySeconds: 1 },
    });
  });

  it("polls provider status for at most 200 submitted items per verifier invocation", async () => {
    const current = note({
      body: Array.from({ length: 250 }, (_, index) => `queued logical line ${index}`).join("\n"),
      ai_search_status: "processing",
    });
    const desired = await buildAiSearchItems({
      id: current.id,
      title: current.title,
      body: current.body,
      version: current.version,
      contentHash: current.content_hash,
    });
    const rows: AiSearchItemRow[] = desired.map((item) => itemRow({
      item_key: item.itemKey,
      item_id: `queued-provider-${item.itemIndex}`,
      note_content_hash: current.content_hash,
      note_version: current.version,
      item_index: item.itemIndex,
      kind: item.kind,
      raw_line_index: item.rawLineIndex,
      line_number: item.lineNumber,
      char_start: item.charStart,
      char_end: item.charEnd,
      text: item.text,
      index_text_hash: item.indexTextHash,
      sync_state: "submitted",
      provider_status: "queued",
    }));
    const test = harness({ notes: [current], rows });

    await verifyAiSearchNote(test.env, verifyJob());

    expect(test.providerInfo).toHaveBeenCalledTimes(200);
    expect(rows.filter((row) => row.sync_state === "ready")).toHaveLength(200);
    expect(rows.filter((row) => row.sync_state === "submitted")).toHaveLength(51);
    expect(current.ai_search_status).toBe("processing");
    expect(test.sent).toHaveLength(1);
    expect(test.sent[0]).toMatchObject({
      body: { type: "verify-ai-search-note", attempt: 0 },
      options: { delaySeconds: 1 },
    });
  });

  it("recovers a missing provider ID by exact key before deleting a removed note", async () => {
    const deleted = note({ deleted_at: 100, ai_search_status: "pending" });
    const withId = itemRow({ item_key: "with-id-key", item_id: "provider-with-id" });
    const withoutId = itemRow({ item_key: "without-id-key", item_id: null });
    const recoveredByKey = new Map([
      ["without-id-key", {
        id: "provider-recovered",
        key: "without-id-key",
        status: "completed",
        metadata: { schema_version: 1, index_hash: "old-index-hash" },
      }],
    ]);
    const test = harness({
      notes: [deleted],
      rows: [withId, withoutId],
      uploadError: itemKeyConflict(),
      recoveredByKey,
    });

    await syncAiSearchNote(test.env, syncJob());

    expect(test.providerDelete.mock.calls.map(([id]) => id).sort()).toEqual([
      "provider-recovered",
      "provider-with-id",
    ]);
    expect(test.providerList).toHaveBeenCalledWith({
      page: 1,
      per_page: 50,
      source: "builtin",
      sort_by: "modified_at",
    });
    expect(test.providerList.mock.calls[0][0]).not.toHaveProperty("key");
    expect(test.providerList.mock.calls[0][0]).not.toHaveProperty("search");
    expect(test.rows).toEqual([]);
    expect(deleted.ai_search_status).toBe("disabled");
  });

  it("cleans globally bounded pages across repeated calls without deleting notes", async () => {
    const first = note({ id: "note-1" });
    const second = note({ id: "note-2", rowid: 2 });
    const rows = [
      ...Array.from({ length: 250 }, (_, index) => itemRow({
        item_key: `first-key-${index}`,
        item_id: `first-provider-${index}`,
        note_id: first.id,
        item_index: index,
      })),
      ...Array.from({ length: 3 }, (_, index) => itemRow({
        item_key: `second-key-${index}`,
        item_id: `second-provider-${index}`,
        note_id: second.id,
        item_index: index,
      })),
    ];
    const test = harness({ notes: [first, second], rows });

    const results = [];
    const perCallDeletes = [];
    for (let invocation = 0; invocation < 3; invocation += 1) {
      const before = test.providerDelete.mock.calls.length;
      results.push(await deleteAiSearchItemsForNotes(
        test.env,
        [first.id, first.id, second.id],
      ));
      perCallDeletes.push(test.providerDelete.mock.calls.length - before);
    }

    expect(results).toEqual([
      { deletedItems: 100, complete: false, remainingItems: 153 },
      { deletedItems: 100, complete: false, remainingItems: 53 },
      { deletedItems: 53, complete: true, remainingItems: 0 },
    ]);
    expect(perCallDeletes).toEqual([100, 100, 53]);
    expect(perCallDeletes.every((count) => count <= 100)).toBe(true);
    expect(test.providerDelete).toHaveBeenCalledTimes(253);
    expect(test.rows).toEqual([]);
    expect(test.notes).toEqual([first, second]);
    expect(test.executed.some(({ sql }) => /^DELETE FROM notes\b/.test(sql))).toBe(false);
    expect(test.executed.filter(({ sql }) =>
      sql.includes("ORDER BY note_id ASC, item_index ASC, item_key ASC LIMIT ?")
    )).toHaveLength(3);
  });

  it("keeps the D1 mapping and fails when provider deletion fails", async () => {
    const row = itemRow({ item_key: "kept-key", item_id: "provider-failure" });
    const providerError = new Error("provider temporarily unavailable");
    const test = harness({
      rows: [row],
      deleteErrorsById: new Map([["provider-failure", providerError]]),
    });

    await expect(deleteAiSearchItemsForNotes(test.env, [row.note_id]))
      .rejects.toBe(providerError);

    expect(test.rows).toEqual([row]);
    expect(test.executed.some(({ sql }) => sql.startsWith("DELETE FROM ai_search_items")))
      .toBe(false);
  });

  it("does not treat an unstructured upstream 404 as item absence", async () => {
    const row = itemRow({ item_key: "ambiguous-404-key", item_id: "ambiguous-provider" });
    const providerError = new Error("404 upstream route unavailable");
    const test = harness({
      rows: [row],
      deleteErrorsById: new Map([["ambiguous-provider", providerError]]),
    });

    await expect(deleteAiSearchItemsForNotes(test.env, [row.note_id]))
      .rejects.toBe(providerError);
    expect(test.rows).toEqual([row]);
  });

  it("keeps a missing-ID mapping when exact-key reconciliation fails", async () => {
    const row = itemRow({ item_key: "reconcile-key", item_id: null });
    const providerError = new Error("provider list temporarily unavailable");
    const test = harness({
      rows: [row],
      uploadError: itemKeyConflict(),
      listError: providerError,
    });

    await expect(deleteAiSearchItemsForNotes(test.env, [row.note_id]))
      .rejects.toBe(providerError);

    expect(test.providerList).toHaveBeenCalledWith({
      page: 1,
      per_page: 50,
      source: "builtin",
      sort_by: "modified_at",
    });
    expect(test.rows).toEqual([row]);
    expect(test.providerDelete).not.toHaveBeenCalled();
    expect(test.executed.some(({ sql }) => sql.startsWith("DELETE FROM ai_search_items")))
      .toBe(false);
  });

  it("keeps a missing-ID mapping and returns incomplete after a full scan miss", async () => {
    const row = itemRow({ item_key: "eventually-consistent-key", item_id: null });
    const test = harness({ rows: [row], uploadError: itemKeyConflict() });

    await expect(deleteAiSearchItemsForNotes(test.env, [row.note_id]))
      .resolves.toEqual({ deletedItems: 0, complete: false, remainingItems: 1 });

    expect(test.providerList).toHaveBeenCalledOnce();
    expect(test.rows).toEqual([row]);
    expect(row).toMatchObject({ provider_scan_page: 1, provider_scan_pass: 1 });
    expect(test.providerDelete).not.toHaveBeenCalled();
    expect(test.executed.some(({ sql }) => sql.startsWith("DELETE FROM ai_search_items")))
      .toBe(false);
  });

  it("keeps mappings while provider uploads are in flight, then deletes them after IDs are fenced into D1", async () => {
    let releaseUpload!: () => void;
    let resolveUploadsStarted!: () => void;
    let uploadStarts = 0;
    const uploadGate = new Promise<void>((resolve) => {
      releaseUpload = resolve;
    });
    const uploadsStarted = new Promise<void>((resolve) => {
      resolveUploadsStarted = resolve;
    });
    const current = note();
    const test = harness({
      notes: [current],
      uploadGate,
      onUploadStarted: () => {
        uploadStarts += 1;
        if (uploadStarts === 3) resolveUploadsStarted();
      },
    });

    const syncing = syncAiSearchNote(test.env, syncJob());
    await uploadsStarted;
    current.ai_search_status = "disabled";

    await expect(deleteAiSearchItemsForNotes(test.env, [current.id]))
      .resolves.toEqual({ deletedItems: 0, complete: false, remainingItems: 3 });
    expect(test.providerDelete).not.toHaveBeenCalled();
    expect(test.rows).toHaveLength(3);
    expect(test.rows.every((row) => row.upload_token !== null)).toBe(true);

    releaseUpload();
    await syncing;
    expect(test.rows.every((row) => row.item_id !== null && row.upload_token === null)).toBe(true);

    await expect(deleteAiSearchItemsForNotes(test.env, [current.id]))
      .resolves.toEqual({ deletedItems: 3, complete: true, remainingItems: 0 });
    expect(test.providerDelete).toHaveBeenCalledTimes(3);
  });

  it("takes over a stale upload lease during deleted-note cleanup", async () => {
    const deleted = note({ deleted_at: 100, ai_search_status: "disabled" });
    const stale = itemRow({
      item_key: "stale-upload-claim",
      item_id: null,
      sync_state: "uploading",
      upload_token: "abandoned-upload-token",
      updated_at: Date.now() - 21 * 60 * 1_000,
    });
    const test = harness({ notes: [deleted], rows: [stale] });

    await syncAiSearchNote(test.env, syncJob());

    expect(test.upload).toHaveBeenCalledWith(
      stale.item_key,
      stale.text,
      {
        metadata: expect.objectContaining({
          schema_version: "1",
          raw_line_index: "0",
          index_hash: stale.index_text_hash,
        }),
      },
    );
    const recoveryMetadata = test.upload.mock.calls[0]?.[2]?.metadata ?? {};
    expect(Object.values(recoveryMetadata).every((value) => typeof value === "string")).toBe(true);
    expect(test.providerDelete).toHaveBeenCalledWith(`provider-${stale.item_key}`);
    expect(test.rows).toEqual([]);
    expect(deleted.ai_search_status).toBe("disabled");
  });

  it("keeps deleted cleanup running while maintenance is disabled and no-ops live disabled jobs", async () => {
    const deleted = note({ deleted_at: 100, ai_search_status: "pending" });
    const deletedRow = itemRow({ item_key: "disabled-cleanup", item_id: "disabled-provider" });
    const cleanup = harness({
      notes: [deleted],
      rows: [deletedRow],
      semanticBackend: "vectorize",
      aiSearchEnabled: "false",
    });

    await syncAiSearchNote(cleanup.env, syncJob());
    expect(cleanup.providerDelete).toHaveBeenCalledWith("disabled-provider");
    expect(cleanup.rows).toEqual([]);
    expect(deleted.ai_search_status).toBe("disabled");

    const liveDisabled = note({ ai_search_status: "disabled" });
    const blocked = harness({ notes: [liveDisabled] });
    await syncAiSearchNote(blocked.env, syncJob());
    await verifyAiSearchNote(blocked.env, verifyJob());
    expect(blocked.namespace.get).not.toHaveBeenCalled();
    expect(blocked.upload).not.toHaveBeenCalled();
  });

  it("cleans persisted mappings while the runtime backend is Vectorize-disabled", async () => {
    const row = itemRow({ item_key: "rollback-key", item_id: "rollback-provider" });
    const test = harness({
      rows: [row],
      semanticBackend: "vectorize",
      aiSearchEnabled: "false",
    });

    await expect(deleteAiSearchItemsForNotes(test.env, [row.note_id]))
      .resolves.toEqual({ deletedItems: 1, complete: true, remainingItems: 0 });

    expect(test.providerDelete).toHaveBeenCalledWith("rollback-provider");
    expect(test.rows).toEqual([]);
  });

  it("treats provider NotFound as an idempotent cleanup success", async () => {
    const row = itemRow({ item_key: "gone-key", item_id: "provider-gone" });
    const notFound = Object.assign(new Error("item_not_found"), { code: 7041 });
    const test = harness({
      rows: [row],
      deleteErrorsById: new Map([["provider-gone", notFound]]),
    });

    await expect(deleteAiSearchItemsForNotes(test.env, [row.note_id]))
      .resolves.toEqual({ deletedItems: 1, complete: true, remainingItems: 0 });

    expect(test.rows).toEqual([]);
  });
});
