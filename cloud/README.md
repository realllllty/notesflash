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
- Workers AI (`@cf/baai/bge-m3`) for document and query embeddings.
- Vectorize cosine search for semantic recall.
- Cloudflare Queue consumer for asynchronous document indexing. Saving a note
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
    |-- D1: notes, trigram FTS, devices, sessions, image metadata
    |-- R2: private image bytes
    |-- Workers AI: text -> 1024-dimensional BGE-M3 vector
    |-- Vectorize: cosine Top-K search
    `-- Queue: asynchronous note indexing and vector deletion
```

The write path is deliberately decoupled:

```text
POST/PATCH note -> D1 commit + FTS trigger -> return note immediately
                                      `----> Queue -> Workers AI -> Vectorize
```

The client should call lexical search as the user types, then call semantic
search after its own debounce/trigger policy. If AI, Queue, or Vectorize is
unavailable, literal search and note CRUD continue to work.

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

The default [Cloudflare BGE-M3 model](https://developers.cloudflare.com/workers-ai/models/bge-m3/)
outputs 1024 dimensions. If the model changes, create
a new Vectorize index with the model's dimension and update both
`EMBEDDING_MODEL` and `EMBEDDING_DIMENSIONS`. Vectors from different embedding
models must never be mixed in one semantic index.

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
| `VECTOR_INDEX` | Vectorize cosine index | required for semantic search |
| `AI` | Workers AI binding | required for semantic search |
| `INDEX_QUEUE` | Queue producer/consumer | required for async indexing |
| `ASSETS` | same-origin PWA static assets | `./public` |
| `INSTANCE_NAME` | display name | `NotesFlash Cloud` |
| `ALLOWED_ORIGINS` | comma-separated origins or `*` | `*` |
| `EMBEDDING_MODEL` | Workers AI model | `@cf/baai/bge-m3` |
| `EMBEDDING_DIMENSIONS` | validation and Vectorize dimension | `1024` |
| `SEMANTIC_MIN_SCORE` | minimum cosine score returned as semantic recall | `0.45` |
| `MAX_IMAGE_BYTES` | maximum multipart file size | `12582912` (12 MiB) |
| `SESSION_TTL_DAYS` | device token lifetime | `180` |
| `TRASH_RETENTION_DAYS` | soft-deleted note/image retention before purge | `30` |

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
  "limit": 20
}
```

Both endpoints return `results`. Each result includes the complete note plus:

```json
{
  "matchType": "lexical",
  "score": 1
}
```

The frontend can show lexical results immediately, then merge semantic results
with Reciprocal Rank Fusion. Exact literal matches should retain more weight
than vector-only matches. Vector matches below `SEMANTIC_MIN_SCORE` are omitted;
calibrate the default `0.45` against a real Chinese note corpus after deployment.

Index health is available at:

```http
GET /api/search/status
```

## Queue consistency model

Queue delivery is at least once, so every vector job is idempotent:

- A job carries `noteId`, `version`, and `contentHash`.
- The consumer ignores a job that no longer matches D1.
- A vector ID contains the note version and hash prefix.
- D1 is updated to point at the vector only with a conditional version/hash
  update.
- If that condition loses a race, the just-created stale vector is deleted.
- Before D1 stops referencing an older vector, the consumer emits a separate
  idempotent delete job; deletion refuses to remove any vector still referenced
  by a live note.
- Semantic search only accepts vectors referenced by the current D1 row.

A cron trigger runs every 15 minutes to retry pending/failed indexing, reindex
notes whose model/content hash drifted, retry deleted-vector cleanup, and remove
expired pairing codes, sessions, rate-limit windows, orphan uploads, and
idempotency records. Once vector cleanup has completed, notes and attached R2
images older than `TRASH_RETENTION_DAYS` are permanently purged. A Queue outage
never rolls back or misreports a committed D1 note mutation.

## Security boundaries

- Notes and image metadata are stored in the user's D1; image bytes are stored
  in the user's private R2 bucket.
- Workers AI sees plaintext during embedding. This is self-hosted cloud storage,
  not zero-knowledge end-to-end encryption.
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
- One embedding vector is generated per note. Very long documents are truncated
  to at most 60,000 characters with model-side truncation enabled; complete
  bodies remain available to literal search.
- Image dimensions are not decoded server-side in the MVP; width/height are null.
- There is no local offline draft guarantee. The client must visibly distinguish
  `saving`, `saved`, and save-error states; it flushes before normal navigation,
  but a force-killed browser before the cloud save completes can still lose the
  in-memory draft by design.
- Note deletion is soft deletion for the configured retention window (30 days
  by default), after which Cron permanently removes D1 text and attached R2 images.
- R2 backup/export and Passkey login can be added later without changing the
  note/search contracts defined here.
