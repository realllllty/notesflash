import { describe, expect, it, vi } from "vitest";

import { embeddingModelSpec } from "../src/embedding-models";
import type { Env } from "../src/types";
import { DEFAULT_PRUNE, pruneOrphanChunkVectors } from "../src/vector-prune";

const spec = embeddingModelSpec("@cf/google/embeddinggemma-300m");

function harness(options: {
  indexIds: string[];
  knownIds: string[];
  queryError?: Error;
  deleteError?: Error;
  vectorCount?: number;
}) {
  const deleted: string[][] = [];
  const probes: number[][] = [];

  const env = {
    DB: {
      prepare(sql: string) {
        let bound: unknown[] = [];
        return {
          bind(...values: unknown[]) {
            bound = values;
            return this;
          },
          async all() {
            expect(sql).toContain("FROM note_chunks");
            const ids = bound.map(String);
            return {
              results: ids
                .filter((id) => options.knownIds.includes(id))
                .map((id) => ({ chunk_id: id })),
            };
          },
        };
      },
    },
    CHUNK_INDEX: {
      describe: vi.fn(async () => ({ vectorCount: options.vectorCount ?? options.indexIds.length })),
      query: vi.fn(async (vector: number[]) => {
        if (options.queryError) throw options.queryError;
        probes.push(vector);
        return { matches: options.indexIds.map((id) => ({ id, score: 0.1 })) };
      }),
      deleteByIds: vi.fn(async (ids: string[]) => {
        if (options.deleteError) throw options.deleteError;
        deleted.push(ids);
      }),
    },
  } as unknown as Env;

  return { env, deleted, probes };
}

describe("pruneOrphanChunkVectors", () => {
  it("deletes only vectors that D1 cannot account for", async () => {
    const test = harness({
      indexIds: ["note-a:aaaaaa:0", "note-a:aaaaaa:1", "note-gone:bbbbbb:0"],
      knownIds: ["note-a:aaaaaa:0", "note-a:aaaaaa:1"],
    });

    const result = await pruneOrphanChunkVectors(test.env, spec, { ...DEFAULT_PRUNE, probes: 2 });

    expect(result.inspected).toBe(3);
    expect(result.orphaned).toBe(1);
    expect(result.deleted).toBe(1);
    expect(test.deleted).toEqual([["note-gone:bbbbbb:0"]]);
  });

  it("uses unit-length probe vectors of the model's width", async () => {
    const test = harness({ indexIds: [], knownIds: [] });

    await pruneOrphanChunkVectors(test.env, spec, { ...DEFAULT_PRUNE, probes: 3 });

    expect(test.probes).toHaveLength(3);
    for (const probe of test.probes) {
      expect(probe).toHaveLength(spec.dimensions);
      const magnitude = Math.sqrt(probe.reduce((sum, value) => sum + value * value, 0));
      expect(magnitude).toBeCloseTo(1, 6);
    }
    // Deterministic seeds mean two passes inspect the same region.
    expect(test.probes[0]).not.toEqual(test.probes[1]);
  });

  it("does nothing when every vector is known", async () => {
    const test = harness({
      indexIds: ["note-a:aaaaaa:0"],
      knownIds: ["note-a:aaaaaa:0"],
    });

    const result = await pruneOrphanChunkVectors(test.env, spec);

    expect(result.orphaned).toBe(0);
    expect(test.deleted).toHaveLength(0);
  });

  it("respects the deletion cap", async () => {
    const indexIds = Array.from({ length: 12 }, (_, index) => `note-gone:cccccc:${index}`);
    const test = harness({ indexIds, knownIds: [] });

    const result = await pruneOrphanChunkVectors(test.env, spec, {
      ...DEFAULT_PRUNE,
      probes: 1,
      maxDeletions: 5,
    });

    expect(result.orphaned).toBe(5);
    expect(test.deleted.flat()).toHaveLength(5);
  });


  it("never sends more than 100 ids in one delete payload", async () => {
    // Vectorize rejects larger payloads with VECTOR_DELETE_ERROR 40007.
    const indexIds = Array.from({ length: 250 }, (_, index) => `note-gone:eeeeee:${index}`);
    const test = harness({ indexIds, knownIds: [] });

    await pruneOrphanChunkVectors(test.env, spec, {
      ...DEFAULT_PRUNE,
      probes: 1,
      maxDeletions: 250,
    });

    expect(test.deleted.length).toBeGreaterThan(1);
    for (const batch of test.deleted) expect(batch.length).toBeLessThanOrEqual(100);
  });

  it("survives probe and delete failures", async () => {
    const failingProbe = harness({ indexIds: ["x"], knownIds: [], queryError: new Error("down") });
    expect((await pruneOrphanChunkVectors(failingProbe.env, spec)).deleted).toBe(0);

    const failingDelete = harness({
      indexIds: ["note-gone:dddddd:0"],
      knownIds: [],
      deleteError: new Error("delete failed"),
    });
    const result = await pruneOrphanChunkVectors(failingDelete.env, spec, {
      ...DEFAULT_PRUNE,
      probes: 1,
    });
    expect(result.orphaned).toBe(1);
    expect(result.deleted).toBe(0);
  });
});
