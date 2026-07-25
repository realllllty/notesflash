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
- Cloudflare AI Search with trigram keyword retrieval, multilingual vector
  retrieval, and reciprocal-rank fusion (RRF). Each title and each non-empty
  logical body line is an independent item; exceptionally long lines are split
  into provider-safe parts anchored to that same line. Results still report the
  exact line and character range that matched.
- Workers AI query translation (`@cf/meta/m2m100-1.2b`) adds the opposite-language
  form of an independent Chinese/English query. Managed AI Search query rewrite
  is intentionally disabled because it only rewrites follow-up conversation
  messages, not NotesFlash's first standalone search.
- Cloudflare Queue consumers maintain AI Search and the retained Vectorize
  fallback asynchronously. Saving a note never waits for either semantic index.
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
    |-- D1: notes, trigram FTS, AI Search line manifest, devices, sessions, images
    |-- R2: private image bytes
    |-- Workers AI: Chinese/English query translation
    |-- AI Search: trigram keyword + multilingual vector retrieval, fused by RRF
    |-- Vectorize: explicit legacy semantic fallback
    `-- Queue: independent asynchronous AI Search and Vectorize maintenance
```

The write path is deliberately decoupled:

```text
POST/PATCH note -> D1 commit + FTS trigger -> return note immediately
                                      `----> Queue -> title/line manifest -> AI Search
                                      `----> Queue -> legacy chunks -> Workers AI -> Vectorize
```

The read path keeps literal search first:

```text
query -> D1 FTS5 trigram ── hit ──► return literal matches
              `── empty ──► original query + optional zh/en translation
                            -> AI Search hybrid retrieval + RRF
                            -> validate item key/hash/version against current D1
                            -> aggregate provider-ranked lines per note
                            -> results[].matches[] with current D1 offsets
```

The client should call lexical search as the user types, then call semantic
search only when the completed lexical request returns zero rows. AI Search
failure is returned as an explicit `503`, never disguised as a real empty result;
literal search and note CRUD continue to work. An operator can explicitly set
`SEMANTIC_BACKEND=vectorize` to use the retained implementation during rollback.

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
2. Cloudflare creates/binds the Worker
   resources declared in `wrangler.jsonc`, including the default AI Search
   namespace binding.
3. Workers Builds runs `npm install` and `npm run deploy`; no NotesFlash setup
   secret or manually copied environment variable is required.
4. The resulting Worker root serves the PWA. The owner immediately opens
   `/setup`, explicitly claims the uninitialized instance, and receives the
   first short-lived one-time pairing code.

Cloudflare's deployment UI evolves over time. If a binding is not auto-created
by the current Deploy Button flow, use the manual provisioning commands below.
No NotesFlash-operated backend is required in either path.

## Manual provisioning fallback

Prerequisites: Node.js 20+ and a Cloudflare account with Workers enabled. AI
Search is currently Open Beta. NotesFlash uses built-in AI Search storage and
uploads lines through the Items Workers binding, so Cloudflare's separate R2
data-source service token is not required. See Cloudflare's current
[Workers binding guide](https://developers.cloudflare.com/ai-search/get-started/workers/)
and [service-token boundary](https://developers.cloudflare.com/ai-search/configuration/indexing/service-api-token/).

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

Then run the complete deployment workflow:

```bash
npm run deploy
```

Do not replace this with `npm run deploy:worker` on a clean account: the complete
workflow first creates/verifies the retained `notesflash-chunks` Vectorize index,
then applies D1 migrations and deploys the Worker.

The Worker uses the `default` AI Search namespace binding and idempotently opens
or creates the `notesflash-search` instance with keyword + vector indexing,
trigram tokenization, and RRF. The Workers binding authorizes this internally;
there is no user-supplied AI Search instance ID, API token, or service token.

The retained Vectorize fallback uses
[EmbeddingGemma 300M](https://developers.cloudflare.com/workers-ai/models/embeddinggemma-300m/),
which outputs 768 dimensions. `npm run deploy` first runs
`scripts/ensure-vectorize.mjs`, which creates the `notesflash-chunks` index with
that dimension and the cosine metric if it does not exist, and refuses to
continue when an existing index has a different width. Changing
`EMBEDDING_MODEL` therefore also means creating a matching index and re-indexing:
vectors from different embedding models must never be mixed.

`cloud/eval` now separates a 30-query calibration suite from a frozen 25-query
short cross-language holdout. The holdout covers bare and contextual forms of
`entry`, `exit`, `settings`, `auth`, and `upload`, plus nearby wrong senses. It
also measures candidate recall at the production depth of 40 and end-to-end line
recall. An older published model table was invalidated after the synthetic
`[EVAL:key]` title marker was found in document embeddings; do not reuse those
numbers. The Worker now strips that marker during sweeps, and a fresh remote run
is required before changing the default model or primary threshold again.

The AI Search adapter tests prove request, provider-order, freshness, privacy,
queue, and failure contracts with deterministic mocks. They do not prove live
retrieval quality or latency for an Open Beta provider. Before calling AI Search
an accuracy improvement, deploy it to an isolated instance and evaluate frozen
positive/negative multilingual suites without tuning on the holdout. This is a
separate release gate, not a claim made by the local implementation.

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
the two semantic providers require remote Cloudflare resources. The template
does not set `remote: true` on `AI_SEARCH`, so an ordinary `wrangler dev` cannot
write local test data into a deployed AI Search instance by accident. Use an
explicit isolated Wrangler environment/namespace for live integration tests.
The default flow does not require a `.dev.vars` file.

Run the type check:

```bash
npm run check
```

## Configuration

| Binding / variable | Purpose | Default |
|---|---|---|
| `DB` | D1 database | required |
| `IMAGES` | private R2 bucket | required |
| `AI_SEARCH` | default AI Search namespace; contains the managed `notesflash-search` instance | required for the default semantic backend |
| `CHUNK_INDEX` | legacy Vectorize line-level index | required while the explicit rollback backend is retained |
| `VECTOR_INDEX` | legacy note-level index; only used to clean up vectors written before chunk indexing | required until legacy cleanup completes |
| `AI` | Workers AI binding for query translation and the Vectorize fallback | required |
| `INDEX_QUEUE` | Queue producer/consumer | required for async indexing |
| `ASSETS` | same-origin PWA static assets | `./public` |
| `INSTANCE_NAME` | display name | `NotesFlash Cloud` |
| `ALLOWED_ORIGINS` | comma-separated origins or `*` | `*` |
| `SEMANTIC_BACKEND` | semantic implementation: `ai-search` or explicit `vectorize` rollback | `ai-search` |
| `AI_SEARCH_ENABLED` | maintain the independent AI Search item index | `true` |
| `AI_SEARCH_INSTANCE_NAME` | managed instance inside the namespace | `notesflash-search` |
| `AI_SEARCH_QUERY_TRANSLATION` | add a Chinese/English translation to short, clearly single-language standalone queries | `true` |
| `AI_SEARCH_QUERY_REWRITE` | managed conversation rewrite; intentionally disabled for standalone search | `false` |
| `AI_SEARCH_RERANKING` | optional managed reranker after hybrid retrieval | `false` |
| `AI_SEARCH_MAX_RESULTS` | provider items over-fetched before note aggregation (AI Search maximum 50) | `50` |
| `AI_SEARCH_MAX_MATCHES_PER_NOTE` | line matches returned for one note | `3` |
| `AI_SEARCH_MAX_ITEMS_PER_NOTE` | safety ceiling for title + non-empty line items | `2000` |
| `EMBEDDING_MODEL` | embedding model for chunks and queries | `@cf/google/embeddinggemma-300m` |
| `EMBEDDING_INSTRUCTION` | retrieval instruction, for instruction-aware models only | unset |
| `SEMANTIC_MIN_COSINE` | absolute cosine floor; rejects "nothing matches" queries | `0.3` |
| `SEMANTIC_RELATIVE_MIN_RATIO` | keep chunks scoring at least this share of the best chunk | `0.6` |
| `SEMANTIC_SHORT_QUERY_RESCUE` | enable contextual same-chunk consensus for ambiguous short queries; currently calibrated for EmbeddingGemma only | `true` |
| `SEMANTIC_SHORT_QUERY_MAX_CODEPOINTS` | maximum Unicode code points eligible for consensus rescue | `24` |
| `SEMANTIC_SHORT_QUERY_MAX_TOKENS` | maximum whitespace-delimited tokens eligible for consensus rescue | `3` |
| `SEMANTIC_SHORT_QUERY_RAW_MIN_COSINE` | lower raw floor allowed only with expanded-view agreement | `0.235` |
| `SEMANTIC_SHORT_QUERY_EXPANDED_MIN_COSINE` | contextual-view floor required on the exact same chunk | `0.3` |
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

The `EMBEDDING_*`, cosine, chunk-window, short-query rescue, and span-refinement
settings configure only the explicit `vectorize` rollback path. AI Search owns
hybrid retrieval and RRF ordering when `SEMANTIC_BACKEND=ai-search`; NotesFlash
does not reinterpret its keyword/vector component scores.

`SEMANTIC_CHUNK_TITLE_CONTEXT` keeps otherwise ambiguous lines such as
`--remote` next to their note title during embedding. `SEMANTIC_SPAN_REFINE`
costs one extra batched embedding call
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
  "limit": 8
}
```

Semantic search is always a fallback: if a literal title/body match exists, the
endpoint returns no semantic results and does not invoke Workers AI or AI Search.
The legacy `fallbackOnly` boolean is still accepted for wire compatibility, but
both `true` and `false` are ignored and cannot bypass the server-side literal
preflight.

When literal search is empty and `SEMANTIC_BACKEND=ai-search`, the Worker may
translate a Chinese query to English or an English query to Chinese with
`@cf/meta/m2m100-1.2b`, then sends the original and translated forms in one AI
Search request. Retrieval is explicitly `hybrid`: the managed service combines
trigram keyword retrieval and multilingual vector retrieval with reciprocal-rank
fusion (`RRF`). Query rewrite is explicitly disabled because Cloudflare only
rewrites follow-up messages with conversation history; it does not rewrite the
first independent `entry` or `migrate` query.

Mixed technical input such as `wrangler 迁移 --remote`, and queries longer than
256 Unicode code points, are sent unchanged so translation cannot rewrite an
identifier or add latency to an already descriptive query. The original query
is always retained even when a translation is added.

AI Search returns provider-ranked item keys, not authoritative note data. The
Worker resolves those keys through `ai_search_items` and accepts a hit only when
the item is ready, its uploaded-text hash matches provider metadata, the note is
not deleted, and its current D1 content hash is the indexed hash. The response
order from AI Search remains authoritative: no local cosine threshold, score
bonus, or second ranking formula is applied. Multiple matched items from one
note are grouped while preserving their first provider rank. Titles, body text,
line numbers, and character offsets always come from current D1 data rather than
the eventually-consistent provider response.

Indexing is asynchronous. A newly saved note is immediately available through
D1 character search; it becomes eligible for semantic fallback after its title
and non-empty logical lines report ready. Empty lines and image marker lines are
not uploaded. A legal line whose UTF-8 representation could exceed AI Search's
4 MB file limit is split at a Unicode-safe boundary while retaining one logical
line number. AI Search item state is independent from `embedding_status`, so an
AI Search outage never causes the Vectorize fallback to be rebuilt or damaged.

Every provider upload is fenced in D1 with a leased operation token before the
Worker writes AI Search. Cleanup waits for that fence, persists the returned
provider ID, and only then deletes the provider item and its manifest row. If an
upload succeeded before its ID reached D1, recovery uses only the documented
Items binding pagination fields (`page`, `per_page`, `source`, `sort_by`), stores
the next page/pass in D1, checks exact item keys, and confirms a match with
`items.get(id).info()`. It never sends the REST-only `key` filter and never treats
a completed page scan as proof that an item is absent. This keeps Queue retries,
same-key `7042` recovery, disabled-backend cleanup, and search-lab deletion
fail-closed without exceeding the six-connection or per-invocation budgets.

The response identifies `backend: "cloudflare-ai-search"`,
`rankingStrategy: "cloudflare-ai-search-hybrid-rrf"`,
translation/rewrite/reranking state, anonymous
provider/result counts, and phase timings. `Server-Timing` separates translation,
managed retrieval, D1 resolution, hydration, and total latency. A provider or
setup failure returns a stable `503`; it is never converted to `200` with an
empty result set. Set `SEMANTIC_BACKEND=vectorize` only as an explicit deployment
rollback; that response identifies `backend: "legacy-vectorize"`.

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

This reports the active backend, anonymous note/item counts by AI Search state,
and (when available) aggregate AI Search instance statistics. It also retains
the legacy chunk-row and Vectorize counts so an operator can verify the explicit
rollback path. It never returns an AI Search item key or ID, note ID, title,
body, image URL, or query text.

### Operator search lab

`POST /api/internal/search-lab` is the retained operator observability and
calibration surface. It is disabled unless `LAB_ENABLED` is exactly `true` and
`LAB_TOKEN_SHA256` holds the SHA-256 hex of a high-entropy token; only the hash
is stored in configuration. The kill switch applies to every actor. Requests
authenticate with `x-lab-token: <plaintext>` or a paired-device Bearer token,
but paired devices receive read-only actions only. Ordinary unauthenticated or
misconfigured requests are masked as `404 ROUTE_NOT_FOUND`; repeated requests
can still be distinguished by the endpoint's rate-limit response, so this is a
reduced-information surface rather than a secrecy boundary.

| Action | Purpose |
|---|---|
| `sweep` | Score several model/chunking/threshold strategies in-request, without touching the Vectorize index. Results include full score distributions for offline threshold sweeps. |
| `live` | Run the retained `legacy-vectorize` comparator directly. The response explicitly says `productionHandler: false`; it is not evidence about the active AI Search backend. |
| `api` | Call the real `/api/search/semantic` handler for the configured backend and verify the privacy-safe response contract, including that `charStart`/`charEnd` address the same hidden text. |
| `probe` | Check which embedding models answer and how they score a known cross-language pair. |
| `provider-probe` | Exercise the AI Search instance and a fixed synthetic Items upload/delete, returning only a scrubbed provider stage/error and no item key or ID. |
| `corpus-stats` | Anonymous note, Vectorize, and AI Search state/item coverage counts; no provider key, item ID, note ID, or text. |
| `seed` / `cleanup` | Insert or remove the evaluation corpus for both independent indexes. Cleanup deletes provider items before D1; for a large corpus it returns a bounded-progress `503` and must be retried before any note row is hard-deleted. |
| `prune-vectors` | Delete chunk vectors that no longer belong to any note. |
| `reindex` | Mark every live note pending and enqueue both Vectorize and AI Search jobs when AI Search maintenance is enabled. |

All responses are anonymous-only. The endpoint never returns note IDs, titles,
bodies, matched text, or image URLs; `includeText: true` is rejected. Stable
opaque refs are used for real notes, while synthetic eval keys identify only
the temporary harness corpus. Responses otherwise carry scores, line numbers,
character offsets, aggregate counts, and the submitted query. Operators should
treat stored lab/CI output as potentially sensitive. `cloud/eval/run-eval.mjs`
drives the endpoint and reports candidate
recall@40, Recall@1/3/8, MRR, end-to-end line recall@1/@3, forbidden-note
rates@1/@3/@8, negative-query discipline, score separation, and latency.

Keep `LAB_ENABLED=true` only on instances where ongoing operator observability is
intentional, and retain the high-entropy token outside the repository. Set it to
`false` to close the route completely. Calibration and mutation actions
(`sweep`, `probe`, `seed`, `cleanup`, `prune-vectors`, and `reindex`) require the
dedicated lab token.

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
- With the default backend, AI Search built-in storage persists a plaintext copy
  of every uploaded title/body-line item and processes semantic queries. Item
  keys hash the note ID, and custom metadata does not contain the raw note ID.
  Provider-item deletion is asynchronous: D1 retention purge waits until the
  corresponding AI Search manifest is empty.
- Workers AI sees plaintext short queries during optional zh/en translation. It
  also sees note chunks and queries when the explicit Vectorize fallback is in
  use. This is self-hosted cloud storage, not zero-knowledge end-to-end encryption.
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
- AI Search indexing produces one item for the title and normally one item for
  every non-empty logical body line, up to `AI_SEARCH_MAX_ITEMS_PER_NOTE`.
  Exceptionally long lines use multiple Unicode-safe provider items with the
  same line anchor. Complete bodies remain available to literal search. The
  retained Vectorize rollback continues to use its older overlapping-window
  representation.
- The default semantic query performs at most one Workers AI translation and one
  managed AI Search request, followed by bounded D1 resolution and hydration.
  Query request count does not grow with note count; index storage grows with
  the number of titles and non-empty logical lines.
- Image dimensions are not decoded server-side in the MVP; width/height are null.
- There is no local offline draft guarantee. The client must visibly distinguish
  `saving`, `saved`, and save-error states; it flushes before normal navigation,
  but a force-killed browser before the cloud save completes can still lose the
  in-memory draft by design.
- Note deletion is soft deletion for the configured retention window (30 days
  by default), after which Cron permanently removes D1 text and attached R2 images.
- R2 backup/export and Passkey login can be added later without changing the
  note/search contracts defined here.
