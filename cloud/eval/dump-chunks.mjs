#!/usr/bin/env node
/**
 * Print the chunks a note body would produce, with exact character offsets.
 *
 * Usage:
 *   node cloud/eval/dump-chunks.mjs <file> [--title "..."] [--target 220] [--max 400] [--lines 3] [--no-title-context]
 *   echo "正文" | node cloud/eval/dump-chunks.mjs -
 *
 * Requires Node 22.6+ (TypeScript type stripping) because it imports the same
 * chunking module the Worker uses; there is no second implementation to drift.
 */
import { readFileSync } from "node:fs";

import { buildNoteChunks, resolveChunkingOptions } from "../src/chunking.ts";

function parseArgs(argv) {
  const args = { file: null, title: "示例标题", overrides: {} };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--title") args.title = argv[++index] ?? "";
    else if (value === "--target") args.overrides.targetChars = Number(argv[++index]);
    else if (value === "--max") args.overrides.maxChars = Number(argv[++index]);
    else if (value === "--min") args.overrides.minChars = Number(argv[++index]);
    else if (value === "--lines") args.overrides.maxLines = Number(argv[++index]);
    else if (value === "--overlap") args.overrides.overlapLines = Number(argv[++index]);
    else if (value === "--no-title-context") args.overrides.titleContext = false;
    else if (value === "--no-title-chunk") args.overrides.includeTitleChunk = false;
    else if (!args.file) args.file = value;
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
if (!args.file) {
  console.error("usage: node cloud/eval/dump-chunks.mjs <file|-> [--title T] [--target N] [--max N] [--lines N]");
  process.exit(1);
}

const body = args.file === "-"
  ? readFileSync(0, "utf8")
  : readFileSync(args.file, "utf8");
const options = resolveChunkingOptions(args.overrides);
const chunks = buildNoteChunks({ title: args.title, body }, options);

console.log(`options: ${JSON.stringify(options)}`);
console.log(`body: ${body.length} chars, ${body.split("\n").length} lines -> ${chunks.length} chunks\n`);

for (const chunk of chunks) {
  const range = chunk.kind === "title"
    ? "title"
    : `L${chunk.lineStart}-${chunk.lineEnd} @${chunk.charStart}..${chunk.charEnd} (primary L${chunk.primaryLine})`;
  console.log(`#${chunk.chunkIndex} [${chunk.kind}] ${range} ${chunk.text.length} chars`);
  console.log(`  text: ${JSON.stringify(chunk.text.slice(0, 160))}`);
  if (chunk.embedText !== chunk.text) {
    console.log(`  embed: ${JSON.stringify(chunk.embedText.slice(0, 160))}`);
  }
  if (chunk.kind === "body" && body.slice(chunk.charStart, chunk.charEnd) !== chunk.text) {
    console.error("  OFFSET MISMATCH");
    process.exitCode = 1;
  }
}
