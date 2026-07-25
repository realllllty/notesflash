#!/usr/bin/env node
/**
 * Sync `cloud/` into the standalone deploy repository that Cloudflare Workers
 * Builds watches.
 *
 * The deploy repository is the user's own instance source, so it keeps a few
 * deliberate differences from the upstream template:
 * - real D1 `database_id` and R2 `preview_bucket_name`
 * - the operator search lab enabled, with only the SHA-256 of the lab token
 * - no test or eval directories
 *
 * Usage:
 *   node scripts/sync-deploy-repo.mjs [--deploy-dir DIR] [--lab-token-file FILE] [--disable-lab]
 */
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const cloudDir = resolve(repoRoot, "cloud");

const DEPLOY_DATABASE_ID = "c0b9b116-e9a6-4d6f-9d4b-3e1989a7263c";

function parseArgs(argv) {
  const args = { deployDir: "/tmp/notesflash-cloud-upgrade-2de2b3c", labTokenFile: resolve(cloudDir, ".lab-token.local"), disableLab: false };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--deploy-dir") args.deployDir = argv[++index];
    else if (argv[index] === "--lab-token-file") args.labTokenFile = argv[++index];
    else if (argv[index] === "--disable-lab") args.disableLab = true;
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
const deployDir = resolve(args.deployDir);
if (!existsSync(resolve(deployDir, ".git"))) {
  console.error(`${deployDir} is not a git working copy.`);
  process.exit(1);
}

// Source files that are byte-identical between the template and the deployment.
for (const entry of ["src", "migrations", "tsconfig.json"]) {
  const target = resolve(deployDir, entry);
  rmSync(target, { recursive: true, force: true });
  cpSync(resolve(cloudDir, entry), target, { recursive: true });
}
mkdirSync(resolve(deployDir, "migrations"), { recursive: true });

// package.json: drop the eval script, which needs the eval directory.
const pkg = JSON.parse(readFileSync(resolve(cloudDir, "package.json"), "utf8"));
delete pkg.scripts.eval;
writeFileSync(resolve(deployDir, "package.json"), `${JSON.stringify(pkg, null, 2)}\n`);

// wrangler.jsonc: keep the template as the source of truth, then re-apply the
// deployment-specific values by targeted replacement so nothing drifts.
let wrangler = readFileSync(resolve(cloudDir, "wrangler.jsonc"), "utf8");
wrangler = wrangler.replace(
  '"database_id": "00000000-0000-0000-0000-000000000000"',
  `"database_id": "${DEPLOY_DATABASE_ID}"`,
);
wrangler = wrangler.replace(
  '"bucket_name": "notesflash-images"',
  '"bucket_name": "notesflash-images","preview_bucket_name": "notesflash-images"',
);

let labState = "disabled";
if (!args.disableLab && existsSync(args.labTokenFile)) {
  const token = readFileSync(args.labTokenFile, "utf8").trim();
  if (token.length < 32) {
    console.error("The lab token looks too short; expected a 32-byte random value.");
    process.exit(1);
  }
  const hash = createHash("sha256").update(token).digest("hex");
  wrangler = wrangler
    .replace('"LAB_ENABLED": "false"', '"LAB_ENABLED": "true"')
    .replace('"LAB_TOKEN_SHA256": ""', `"LAB_TOKEN_SHA256": "${hash}"`);
  labState = `enabled (sha256 ${hash.slice(0, 12)}…)`;
}
writeFileSync(resolve(deployDir, "wrangler.jsonc"), wrangler);

if (!wrangler.includes(DEPLOY_DATABASE_ID)) {
  console.error("Refusing to finish: the deployment D1 database_id was not applied.");
  process.exit(1);
}

console.log(`synced cloud/ -> ${deployDir}`);
console.log(`search lab: ${labState}`);
console.log("next: review git status in the deploy repository, then commit and push to trigger a build");
