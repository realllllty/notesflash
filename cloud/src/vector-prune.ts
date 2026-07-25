/**
 * Garbage-collect chunk vectors that no longer belong to any note.
 *
 * Vectorize can only delete by ID, and a hard note deletion cascades its
 * `note_chunks` rows away, so an ID can be lost before the vector is removed
 * (for example when a row is deleted directly in D1). Orphans are not just
 * wasted storage: they occupy candidate slots in every query, which quietly
 * reduces recall. This pass samples the index with probe vectors, keeps only IDs
 * that D1 cannot account for, and deletes those.
 */
import type { EmbeddingModelSpec } from "./embedding-models";
import type { Env } from "./types";

const D1_PARAMETER_BATCH = 80;
const DELETE_BATCH = 200;

export interface PruneOptions {
  /** Probe queries per pass; each probe returns up to `topK` IDs. */
  probes: number;
  /** Candidate IDs requested per probe (Vectorize caps this at 100). */
  topK: number;
  /** Upper bound on deletions in one call. */
  maxDeletions: number;
}

export const DEFAULT_PRUNE: PruneOptions = {
  probes: 6,
  topK: 100,
  maxDeletions: 500,
};

export interface PruneResult {
  inspected: number;
  orphaned: number;
  deleted: number;
  vectorCountBefore: number | null;
  vectorCountAfter: number | null;
  /** Reason the deletion stopped early, if it did. */
  error: string | null;
}

/** Deterministic pseudo-random unit vectors, so a pass is reproducible. */
function probeVector(dimensions: number, seed: number): number[] {
  const vector = new Array<number>(dimensions);
  let state = seed * 2_654_435_761 + 1;
  for (let index = 0; index < dimensions; index += 1) {
    state = (state * 1_103_515_245 + 12_345) % 2_147_483_648;
    vector[index] = state / 1_073_741_824 - 1;
  }
  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1;
  return vector.map((value) => value / magnitude);
}

async function vectorCount(env: Env): Promise<number | null> {
  try {
    const details = await env.CHUNK_INDEX.describe() as unknown as Record<string, unknown>;
    if (typeof details.vectorCount === "number") return details.vectorCount;
    if (typeof details.vectorsCount === "number") return details.vectorsCount;
    return null;
  } catch {
    return null;
  }
}

export async function pruneOrphanChunkVectors(
  env: Env,
  spec: EmbeddingModelSpec,
  options: PruneOptions = DEFAULT_PRUNE,
): Promise<PruneResult> {
  const before = await vectorCount(env);
  const seen = new Set<string>();

  for (let probe = 0; probe < options.probes; probe += 1) {
    try {
      const response = await env.CHUNK_INDEX.query(probeVector(spec.dimensions, probe + 1), {
        topK: options.topK,
        returnValues: false,
        returnMetadata: "none",
      });
      for (const match of response.matches ?? []) {
        if (typeof match.id === "string") seen.add(match.id);
      }
    } catch (error) {
      console.warn("Orphan vector probe failed", error);
      break;
    }
  }

  const ids = [...seen];
  const known = new Set<string>();
  for (let offset = 0; offset < ids.length; offset += D1_PARAMETER_BATCH) {
    const batch = ids.slice(offset, offset + D1_PARAMETER_BATCH);
    const rows = (await env.DB.prepare(
      `SELECT chunk_id FROM note_chunks WHERE chunk_id IN (${batch.map(() => "?").join(",")})`,
    )
      .bind(...batch)
      .all<{ chunk_id: string }>()).results;
    for (const row of rows) known.add(row.chunk_id);
  }

  const orphans = ids.filter((id) => !known.has(id)).slice(0, options.maxDeletions);
  let deleted = 0;
  let error: string | null = null;
  for (let offset = 0; offset < orphans.length; offset += DELETE_BATCH) {
    const batch = orphans.slice(offset, offset + DELETE_BATCH);
    try {
      await env.CHUNK_INDEX.deleteByIds(batch);
      deleted += batch.length;
    } catch (failure) {
      error = failure instanceof Error
        ? `${failure.name}: ${failure.message}`.slice(0, 300)
        : "unknown error";
      console.error("Could not delete orphan chunk vectors", error);
      break;
    }
  }

  return {
    inspected: ids.length,
    orphaned: orphans.length,
    deleted,
    vectorCountBefore: before,
    vectorCountAfter: deleted > 0 ? await vectorCount(env) : before,
    error,
  };
}
