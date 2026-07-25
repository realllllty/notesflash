#!/usr/bin/env node
/**
 * Create the line-level Vectorize index if it does not exist yet.
 *
 * Semantic search stores one vector per note line window, and the vector width
 * follows the configured embedding model. Wrangler cannot create a Vectorize
 * index from `wrangler.jsonc`, so `npm run deploy` runs this first; it is safe
 * to re-run because an existing index is treated as success.
 */
import { execFileSync } from "node:child_process";

const INDEX_NAME = "notesflash-chunks";
/** Matches `@cf/google/embeddinggemma-300m`, the calibrated default model. */
const DIMENSIONS = "768";
const METRIC = "cosine";

function run(args) {
  return execFileSync("npx", ["wrangler", ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

try {
  const output = run(["vectorize", "info", INDEX_NAME]);
  console.log(`Vectorize index ${INDEX_NAME} already exists.`);
  const dimensions = output.match(/dimensions[^0-9]*(\d+)/i)?.[1];
  if (dimensions && dimensions !== DIMENSIONS) {
    console.error(
      `Index ${INDEX_NAME} has ${dimensions} dimensions but the configured model needs ${DIMENSIONS}.`,
    );
    console.error("Delete the index or change EMBEDDING_MODEL before deploying.");
    process.exit(1);
  }
  process.exit(0);
} catch {
  console.log(`Creating Vectorize index ${INDEX_NAME} (${DIMENSIONS} dimensions, ${METRIC}).`);
}

try {
  run([
    "vectorize",
    "create",
    INDEX_NAME,
    `--dimensions=${DIMENSIONS}`,
    `--metric=${METRIC}`,
    "--description=NotesFlash line-level semantic index",
  ]);
  console.log(`Created ${INDEX_NAME}.`);
} catch (error) {
  const message = `${error.stdout ?? ""}${error.stderr ?? ""}${error.message ?? ""}`;
  if (/already exists/i.test(message)) {
    console.log(`${INDEX_NAME} already exists.`);
    process.exit(0);
  }
  console.error(`Could not create the Vectorize index ${INDEX_NAME}.`);
  console.error(message.trim().slice(0, 1_500));
  console.error(
    `Run this once with an API token that can manage Vectorize:\n` +
      `  npx wrangler vectorize create ${INDEX_NAME} --dimensions=${DIMENSIONS} --metric=${METRIC}`,
  );
  process.exit(1);
}
