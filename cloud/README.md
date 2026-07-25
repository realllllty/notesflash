# NotesFlash Cloud MVP

`cloud/` is the self-contained Cloudflare application for NotesFlash. One Deploy
Button creates the user's API Worker and data resources and serves the installable
PWA from the same `workers.dev` origin. The macOS client talks directly to that
Worker. The application publisher does not run an OAuth or data service and does
not receive note text, images, device tokens, embeddings, or search queries.

## What this MVP includes

- Cloudflare Worker JSON API written in strict TypeScript.
- Worker Static Assets containing the same compact installable PWA as the desktop UI.
- D1 as the source of truth for notes, devices, pairing codes, sessions, and
  image metadata.
- A flat note collection: no folder, notebook, or hierarchy tables.
- Literal character search using D1 FTS5 `trigram`, with a safe `instr()`
  fallback for short queries and for environments where trigram is unavailable.
- Workers AI multilingual embeddings (`@cf/google/embeddinggemma-300m`) plus a
  Vectorize index of line-level chunks for semantic search. A result reports the
  exact line and character range that matched, and a query in one language finds
  content written in another because the embedding space is shared.
- Cloudflare Queue consumer for asynchronous chunk indexing. Saving a note
  never waits for embedding generation.
- R2 for private image objects. Images are served through the Worker using either
  device authentication or a short-lived HMAC capability URL.
- Optimistic note versions and HTTP `409 VERSION_CONFLICT` responses.
- Explicit first-claim initialization, rate-limited one-time pairing codes,
  logout/session revocation, and hashed device tokens.
- CORS, consistent JSON errors, request IDs, input limits, idempotent note
  creation, and scheduled retry/cleanup.

## Resource and data flow

```text
macOS client ── HTTPS + device token ──► NotesFlash Worker ◄── same-origin PWA
    |-- Static Assets: PWA shell, manifest, service worker, icons
    |-- D1: notes, trigram FTS, note_chunks line anchors, devices, sessions, images
    |-- R2: private image bytes
    |-- Workers AI: query embedding, chunk embeddings, optional span refinement
    |-- Vectorize: line-level chunk vectors, cosine top-K
    `-- Queue: asynchronous chunk indexing and vector deletion
```

The write path is deliberately decoupled:

```text
POST/PATCH note -> D1 commit + FTS trigger -> return note immediately
                                      `----> Queue -> chunking -> Workers AI
                                                   -> Vectorize + note_chunks
```

The read path keeps literal search first:

```text
query -> D1 FTS5 trigram ── hit ──► return literal matches
              `── empty ──► embed query -> Vectorize top-K chunks
                            -> resolve line anchors in D1 -> aggregate per note
                            -> threshold -> results[].matches[] with offsets
```

The client should call lexical search as the user types, then call semantic
search only when the completed lexical request returns zero rows. If Workers AI
or Vectorize is unavailable, literal search and note CRUD continue to work.

## Deploy to Cloudflare

After the current `cloud/` directory has been pushed to the public repository,
the product can expose this official button:

```md
[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](
  https://deploy.workers.cloudflare.com/?url=https://github.com/realllllty/notesflash/tree/main/cloud
)
```

The intended guided-deployment experience is:

1. The user signs in to Cloudflare and authorizes the public template.
2. Cloudflare creates/binds the Worker resources declared in `wrangler.jsonc`.
3. Workers Builds runs `npm install` and `npm run deploy`; no NotesFlash setup
   secret or manually copied environment variable is required.
4. The resulting Worker root serves the PWA. The owner immediately opens
   `/setup`, explicitly claims the uninitialized instance, and receives the
   first short-lived one-time pairing code.

Cloudflare's deployment UI evolves over time. If a binding is not auto-created
by the current Deploy Button flow, use the manual provisioning commands below.
No NotesFlash-operated backend is required in either path.

## Manual provisioning fallback

Prerequisites: Node.js 20+ and a Cloudflare account with Workers enabled.

```bash
npm install
npx wrangler login
npx wrangler d1 create notesflash-db
npx wrangler r2 bucket create notesflash-images
npx wrangler queues create notesflash-index
npx wrangler vectorize create notesflash-vectors --dimensions=1024 --metric=cosine
```

Replace the placeholder `database_id` in `wrangler.jsonc` with the ID printed by
`wrangler d1 create`. Resource names must match `wrangler.jsonc`, or the config
must be updated consistently.

Then migrate and deploy:

```bash
npm run db:migrate:remote
npm run deploy:worker
```

The default model is
[EmbeddingGemma 300M](https://developers.cloudflare.com/workers-ai/models/embeddinggemma-300m/),
which outputs 768 dimensions. `npm run deploy` first runs
`scripts/ensure-vectorize.mjs`, which creates the `notesflash-chunks` index with
that dimension and the cosine metric if it does not exist, and refuses to
continue when an existing index has a different width. Changing
`EMBEDDING_MODEL` therefore also means creating a matching index and re-indexing:
vectors from different embedding models must never be mixed.

Model selection was measured, not assumed. `cloud/eval` holds a 50-note corpus
and 30 golden queries covering cross-language pairs, paraphrase, concept
questions, identifiers, dates, single-relevant-line notes, and negatives. Against
Workers AI's catalogue, EmbeddingGemma reached Recall@1 93% / Recall@3 100% with
100% line accuracy, and left a usable score gap between the strongest
negative-query chunk (0.231) and the weakest true positive (0.345). BGE-M3 and
Qwen3-Embedding scored 67% and 89% at Recall@1 with essentially no such gap,
which is what makes a stable threshold possible here.

## Local development

When changing the shared frontend from the repository root, refresh the
standalone Cloudflare template assets first:

```bash
npm run build:cloud-pwa
```

Then run the Worker from `cloud/`:

```bash
npm install
npm run db:migrate:local
npm run dev
```

Local D1 and R2 emulation are useful for CRUD and image tests. Workers AI and
Vectorize behavior is best verified with an authenticated remote development
session. The default flow does not require a `.dev.vars` file.

Run the type check:

```bash
npm run check
```

## Configuration

| Binding / variable | Purpose | Default |
|---|---|---|
| `DB` | D1 database | required |
| `IMAGES` | private R2 bucket | required |
| `CHUNK_INDEX` | Vectorize index of line-level chunk vectors, queried by `/api/search/semantic` | required |
| `VECTOR_INDEX` | legacy note-level index; only used to clean up vectors written before chunk indexing | required until legacy cleanup completes |
| `AI` | Workers AI binding for chunk and query embeddings | required |
| `INDEX_QUEUE` | Queue producer/consumer | required for async indexing |
| `ASSETS` | same-origin PWA static assets | `./public` |
| `INSTANCE_NAME` | display name | `NotesFlash Cloud` |
| `ALLOWED_ORIGINS` | comma-separated origins or `*` | `*` |
| `EMBEDDING_MODEL` | embedding model for chunks and queries | `@cf/google/embeddinggemma-300m` |
| `EMBEDDING_INSTRUCTION` | retrieval instruction, for instruction-aware models only | unset |
| `SEMANTIC_MIN_COSINE` | absolute cosine floor; rejects "nothing matches" queries | `0.3` |
| `SEMANTIC_RELATIVE_MIN_RATIO` | keep chunks scoring at least this share of the best chunk | `0.6` |
| `SEMANTIC_MULTI_CHUNK_BONUS` | ordering bonus per extra matching chunk in a note | `0.01` |
| `SEMANTIC_MAX_BONUS_CHUNKS` | cap on bonus-eligible chunks | `3` |
| `SEMANTIC_MAX_MATCHES_PER_NOTE` | matched lines returned per note | `3` |
| `SEMANTIC_CHUNK_TOP_K` | chunk candidates pulled from Vectorize (hard maximum 100) | `40` |
| `SEMANTIC_CHUNK_TARGET_CHARS` | preferred characters per chunk window | `220` |
| `SEMANTIC_CHUNK_MAX_CHARS` | hard ceiling per chunk; longer lines split | `400` |
| `SEMANTIC_CHUNK_MIN_CHARS` | windows shorter than this merge into the previous one | `24` |
| `SEMANTIC_CHUNK_MAX_LINES` | maximum logical lines per chunk | `3` |
| `SEMANTIC_CHUNK_OVERLAP_LINES` | lines re-used by the next window | `1` |
| `SEMANTIC_CHUNK_TITLE_CONTEXT` | prefix the note title into embedded chunk text | `true` |
| `SEMANTIC_SPAN_REFINE` | narrow the highlighted range to the matching sentence with one extra embedding call | `true` |
| `SEMANTIC_SPAN_MIN_CHARS` | shortest chunk considered for refinement | `40` |
| `SEMANTIC_SPAN_MAX_CANDIDATES` | candidate spans scored per request | `12` |
| `SEMANTIC_SPAN_MAX_NOTES` | notes whose best match is refined | `1` |
| `SEMANTIC_SPAN_MIN_RATIO` | refined span must keep this share of the chunk score | `1` |
| `SEMANTIC_TOP_K` | semantic result count/cost ceiling (hard maximum 20) | `8` |
| `LAB_ENABLED` | expose the operator search lab; must be exactly `true` | `false` |
| `LAB_TOKEN_SHA256` | SHA-256 hex of the lab token; the plaintext is never stored here | empty |
| `MAX_IMAGE_BYTES` | maximum multipart file size | `12582912` (12 MiB) |
| `SESSION_TTL_DAYS` | device token lifetime | `180` |
| `TRASH_RETENTION_DAYS` | soft-deleted note/image retention before purge | `30` |

`SEMANTIC_CHUNK_TITLE_CONTEXT` is worth 8 percentage points of Recall@1 on the
evaluation corpus, because a line like `--remote` only makes sense next to its
note title. `SEMANTIC_SPAN_REFINE` costs one extra batched embedding call
(250-490ms measured) and only runs when the matched window spans several lines or
a long line; set it to `false` to trade highlight precision for latency.

The bundled PWA is same-origin and does not need a cross-origin allowlist. Keep
`ALLOWED_ORIGINS=*` only if separately hosted web clients must also connect;
otherwise set it to the exact additional web origin. Native clients that do not
send an `Origin` header are not affected by browser CORS.

## Bootstrap and pairing

### 1. Check setup state

```http
GET /api/setup/status
```

An uninitialized response reports `initialized: false`. While the first real
device is still pending, the claiming browser also receives
`canResumeSetup: true`; other browsers receive `false`. The public response does
not reveal private instance metadata.

### 2. Claim an uninitialized instance

After deployment, open:

```text
https://<worker-name>.<account-subdomain>.workers.dev/setup
```

The page is served directly by this Worker; no NotesFlash-operated website,
OAuth callback, or copied Cloudflare credential is involved. It does not claim
the instance merely because somebody loads the page. The owner must explicitly
click the first-claim button, which calls:

```http
POST /api/setup
Content-Type: application/json
```

Response:

```json
{
  "code": "NF-ABCDE-23456",
  "expiresAt": 1784112600000,
  "instanceId": "uuid"
}
```

The claim, internal bootstrap identity, image-signing key, browser-claim hash,
and first pairing-code hash are created atomically in D1. The plaintext code
appears only in this response, expires after ten minutes, and can be consumed
once. The same code is never revealed again. Until the first real device pairs,
the same browser holds a 24-hour HttpOnly, SameSite=Strict bootstrap cookie and
may explicitly generate a replacement code; D1 enforces the same server-side
expiry, and replacement invalidates every earlier unused bootstrap code. Losing
that cookie still requires Cloudflare/D1 recovery.

After D1 `instance_id` has been created, `POST /api/setup` refuses every browser
except the holder of that bootstrap cookie, and that holder can only replace the
still-pending first code. Pairing the first real device revokes the internal
bootstrap identity and deletes the browser-claim hash, permanently closing this
path. This is a TOFU (trust on first use) boundary: without an external identity
provider or pre-shared secret, a person who learns the fresh Worker URL and
clicks the claim button before the owner could claim the instance first. The
intended mitigation is to open `/setup` immediately after deployment. The
explicit click, same-origin checks, rate limiting, atomic D1 claim, and
browser-bound continuation narrow this window but cannot cryptographically
eliminate it.

### 3. Pair another device

Use the first code to pair the macOS app or same-origin PWA:

```http
POST /api/devices/pair
Content-Type: application/json

{
  "code": "NF-ABCDE-23456",
  "deviceName": "Alice's MacBook",
  "platform": "macos"
}
```

After the first real device pairs, an anonymous `/setup` visitor can never create
another code. A connected device must authenticate and create a fresh
ten-minute, one-time code from the app's settings or directly through:

```http
POST /api/pairing-codes
Authorization: Bearer <mac-token>
```

The new device submits that code to the same pairing endpoint:

```http
POST /api/devices/pair
Content-Type: application/json

{
  "code": "NF-ABCDE-23456",
  "deviceName": "Alice's iPhone",
  "platform": "pwa"
}
```

The response contract used by the client is `{ token, instanceId }`; `deviceId`
is also returned for device-management UI. Only SHA-256 token hashes are stored
in D1. A paired device sends:

```http
Authorization: Bearer <token>
```

Initial-claim attempts are limited to 5 per IP per 15-minute window;
pairing-code exchange is limited to 30 attempts per IP per 10-minute window.

There is deliberately no anonymous application-level recovery credential. If
every authenticated device token is lost, the user's Cloudflare account and D1
administration are the break-glass recovery boundary; the NotesFlash publisher
cannot restore access to a self-hosted instance. A pairing code is not a backup
or recovery code.

## Client API contract

All timestamps are Unix milliseconds. Note bodies are plain text; Markdown is
not interpreted by this service.

### Sessions and devices

```http
POST /api/auth/logout
GET /api/devices
DELETE /api/devices/:id
```

`POST /api/auth/logout` revokes the current device session. The client's
“disconnect this device” action attempts this call before removing its local
connection profile. `GET /api/devices` and `DELETE /api/devices/:id` allow an
authenticated device to inspect and revoke another device; the current session
must use logout rather than deleting itself.

### Notes

```http
GET /api/notes?sort=updated_desc&limit=50&offset=0
POST /api/notes
GET /api/notes/:id
PATCH /api/notes/:id
DELETE /api/notes/:id?baseVersion=3
POST /api/notes/:id/restore
```

Create request:

```json
{
  "title": "the current search text",
  "body": "",
  "imageIds": []
}
```

Update request:

```json
{
  "baseVersion": 3,
  "title": "Cloudflare deployment",
  "body": "plain text only",
  "imageIds": ["image-uuid"]
}
```

Note response shape:

```json
{
  "id": "uuid",
  "title": "Cloudflare deployment",
  "body": "plain text only",
  "images": [],
  "version": 4,
  "createdAt": 1784112000000,
  "updatedAt": 1784112000000,
  "embeddingStatus": "pending",
  "pinned": false,
  "archived": false
}
```

Use a unique `Idempotency-Key` header on `POST /api/notes` so a network retry
does not create a duplicate note.

If `baseVersion` is stale, PATCH returns HTTP 409:

```json
{
  "error": {
    "code": "VERSION_CONFLICT",
    "details": {
      "clientBaseVersion": 3,
      "serverNote": {}
    }
  }
}
```

### Images

Upload before creating/updating the note:

```http
POST /api/images
Authorization: Bearer <token>
Content-Type: multipart/form-data; boundary=...

file=<binary image>
```

The response contains an `ImageAsset`. Pass its `id` in the note's `imageIds`.
Supported types are JPEG, PNG, WebP, GIF, and AVIF. SVG is intentionally not
accepted because serving active SVG content safely requires a separate policy.

```http
GET /api/images/:id
DELETE /api/images/:id
```

Image assets returned inside a note include a 24-hour HMAC-signed URL, so the PWA
can use an ordinary `<img src>` without exposing its Bearer token. A direct
Bearer-authenticated `GET /api/images/:id` also works. Refreshing the note/list
renews the signed URL. The HMAC key is generated internally and stored in the
user's D1 `instance_state`; it is not supplied by the user or embedded in a
client. New instances create it during the atomic first claim. An upgraded
existing instance lazily creates it on first use if it is missing.

### Search

Literal character search:

```http
GET /api/search/lexical?q=对象存储&limit=30
```

Semantic search:

```http
POST /api/search/semantic
Content-Type: application/json

{
  "query": "我之前写的云端文件保存方案",
  "limit": 8,
  "fallbackOnly": true
}
```

Semantic search is a fallback by default: if a literal title/body match exists,
the endpoint returns no semantic results and does not invoke Workers AI. Send
`fallbackOnly: false` only for diagnostics or a client that explicitly wants a
hybrid result set.

When literal search is empty, the Worker embeds the query once, asks Vectorize
for the top `SEMANTIC_CHUNK_TOP_K` chunk vectors, resolves each candidate to its
line anchor in `note_chunks`, drops anything whose note was deleted or edited
since indexing, and groups the survivors per note. A note's score is its best
chunk score; additional matching chunks only add a small ordering bonus. Notes
whose chunks are still queued for indexing are scored in-request, bounded to a
handful of the most recently updated ones, so a note stays searchable seconds
after it is saved.

Two thresholds apply together. `SEMANTIC_MIN_COSINE` rejects queries that nothing
in the corpus answers, and `SEMANTIC_RELATIVE_MIN_RATIO` trims the weak tail once
a clearly better chunk exists. A single absolute number cannot do both, which is
why the previous reranker threshold had to be lowered until noise passed with it.

The response reports `rankingStrategy`, `embeddingModel`, `embeddingDimensions`,
`chunking`, `minCosine`, `relativeMinRatio`, `effectiveFloor`, `chunkTopK`,
`candidateChunkCount`, `resolvedChunkCount`, `matchedChunkCount`,
`matchedNoteCount`, `topChunkScore`, `pendingIndexCount`, and `spanRefinement`.
`Server-Timing` separates query embedding, the Vectorize query, anchor
resolution, the freshness pass, span refinement, hydration, and total latency.

Every semantic result includes the complete note plus the lines that matched:

```json
{
  "matchType": "semantic",
  "score": 0.601,
  "matches": [
    {
      "kind": "body",
      "lineNumber": 2,
      "rawLineIndex": 1,
      "lineStart": 2,
      "lineEnd": 2,
      "charStart": 53,
      "charEnd": 102,
      "score": 0.601,
      "text": "Signed image URLs expire after twenty four hours."
    }
  ]
}
```

`charStart`/`charEnd` are offsets into `note.body`, so a client can highlight the
exact span it renders; `lineNumber` is the 1-based logical line to scroll to and
`rawLineIndex` indexes `body.split("\n")` directly. A `kind` of `title` means the
note title matched and carries no line number. Lexical results omit `matches`
because the client already knows where the literal query appears.

Index health is available at:

```http
GET /api/search/status
```

This reports the chunk-recall strategy, embedding model and dimension, chunking
parameters, thresholds, Top-K values, note counts by index state, the number of
current chunk rows, and the Vectorize vector count. A vector count below the
chunk-row count means coverage is incomplete; the scheduled job requeues the
affected notes.

### Operator search lab

`POST /api/internal/search-lab` is an operator-only surface for calibrating
search against the instance's real corpus. It is disabled unless `LAB_ENABLED` is
exactly `true` and `LAB_TOKEN_SHA256` holds the SHA-256 hex of a high-entropy
token; only the hash is ever stored in configuration. Requests authenticate with
`x-lab-token: <plaintext>` or a paired device Bearer token. Anything else gets
the same `404 ROUTE_NOT_FOUND` as an unknown path, so the endpoint does not
advertise itself, and requests are rate limited.

| Action | Purpose |
|---|---|
| `sweep` | Score several model/chunking/threshold strategies in-request, without touching the Vectorize index. Results include full score distributions for offline threshold sweeps. |
| `live` | Run the deployed retrieval path (Vectorize recall plus aggregation). |
| `api` | Call the real `/api/search/semantic` handler and verify the response contract, including that `charStart`/`charEnd` address the returned text. |
| `probe` | Check which embedding models answer and how they score a known cross-language pair. |
| `corpus-stats` | Note counts, chunk statistics, index coverage, and stale rows. |
| `seed` / `cleanup` | Insert or hard-delete the `[EVAL:*]` evaluation corpus. Both refuse to touch any note whose title lacks that prefix. |
| `prune-vectors` | Delete chunk vectors that no longer belong to any note. |
| `reindex` | Mark every live note pending and enqueue indexing. |

Note text is returned only when a request explicitly sets `includeText: true`;
by default responses carry scores, line numbers, character offsets, and aggregate
counts. `cloud/eval/run-eval.mjs` drives the endpoint and prints Recall@1/3/8,
MRR, line accuracy, negative-query discipline, score separation, and latency
percentiles.

Disable the lab (`LAB_ENABLED=false`) before any public release. It can read the
instance's notes and write `[EVAL:*]` notes; it exists for calibration, not for
day-to-day use.

## Queue consistency model

Queue delivery is at least once, so every indexing job is idempotent:

- A job carries `noteId`, `version`, and `contentHash`.
- The consumer ignores a job that no longer matches D1.
- A chunk ID is `<noteId>:<contentHash prefix>:<chunkIndex>`, so re-running a job
  overwrites the same vectors instead of accumulating duplicates.
- Chunk rows for a note are replaced in one batch, and the note is marked ready
  only with a conditional version/hash update.
- If that condition loses a race, the newer job owns the index and the older job
  stops without touching cleanup.
- After D1 points at the new chunks, a separate idempotent job removes vectors
  belonging to older content hashes; a deleted note has all of its chunks removed.
- A scheduled pass deletes chunk vectors that no longer resolve to a note, since
  a lost chunk row would otherwise leave a vector consuming candidate slots.

A cron trigger runs every 5 minutes to retry pending/failed indexing, reindex
notes whose model/content hash drifted or lost their chunk rows, retry chunk and
legacy-vector cleanup, delete chunk vectors that no longer resolve to a note, and
remove expired pairing codes, sessions, rate-limit windows, orphan uploads, and
idempotency records. Once chunk cleanup has completed, notes and attached R2
images older than `TRASH_RETENTION_DAYS` are permanently purged. A Queue outage
never rolls back or misreports a committed D1 note mutation.

## Security boundaries

- Notes and image metadata are stored in the user's D1; image bytes are stored
  in the user's private R2 bucket.
- Workers AI sees plaintext during background embedding and direct reranking.
  This is self-hosted cloud storage, not zero-knowledge end-to-end encryption.
- The API sets `Cache-Control: no-store, private` for notes, search, and images.
- The app may avoid persistent local note storage, but currently edited text
  necessarily exists in process memory.
- Device tokens are high-entropy opaque values; only their SHA-256 hashes are
  stored in D1.
- Revoke a lost device with `DELETE /api/devices/:id` from another paired device;
  the same transaction revokes its sessions and invalidates its unused pairing codes.
- Pairing/setup endpoints use fixed-window D1 rate limits keyed by a hash of the
  Cloudflare client address and never persist the raw address.
- Treat the uninitialized Worker URL as sensitive until the owner completes the
  explicit first claim; this is a TOFU window, not proof of Cloudflare-account
  ownership.
- After initialization, only authenticated devices can issue new pairing codes.
  If all device tokens are lost, recovery requires Cloudflare/D1 administration.
- Deployments upgraded from the older secret-based flow may remove the legacy
  `OWNER_SETUP_SECRET` Worker binding after verifying setup, pairing, and signed
  image delivery on the upgraded version.

## MVP limitations

- This backend is designed for one owner and their devices; it is not a
  multi-tenant sharing service.
- Indexing produces one vector per chunk: a title chunk plus overlapping windows
  of up to `SEMANTIC_CHUNK_MAX_LINES` body lines. Very long lines are split on
  sentence boundaries, so a 12,000-character note still resolves to individual
  lines. Complete bodies remain available to literal search.
- Semantic query cost does not grow with note count: it is one query embedding,
  one Vectorize lookup of `SEMANTIC_CHUNK_TOP_K` candidates, one D1 resolution,
  and optionally one span-refinement call. Index size, not query cost, grows with
  the corpus.
- Image dimensions are not decoded server-side in the MVP; width/height are null.
- There is no local offline draft guarantee. The client must visibly distinguish
  `saving`, `saved`, and save-error states; it flushes before normal navigation,
  but a force-killed browser before the cloud save completes can still lose the
  in-memory draft by design.
- Note deletion is soft deletion for the configured retention window (30 days
  by default), after which Cron permanently removes D1 text and attached R2 images.
- R2 backup/export and Passkey login can be added later without changing the
  note/search contracts defined here.
