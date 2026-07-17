# NotesFlash deployment guide

This document describes the MVP deployment model for NotesFlash:

- the macOS application is a compact Tauri 2 wrapper around the shared Svelte UI;
- the phone client is an installable PWA, not an App Store application;
- every user deploys the NotesFlash Cloud worker into their own Cloudflare account;
- the desktop and PWA pair with that worker using a short-lived one-time code;
- note text is not persisted in a client-side note database;
- note text and metadata live in D1, images live in R2, and semantic vectors live in Vectorize;
- character matching is performed against D1/FTS, while semantic matching uses Workers AI and cosine similarity in Vectorize.

The publisher of NotesFlash does **not** need to run an OAuth callback or a data backend. Cloudflare handles the authorization needed to deploy the template. Runtime authentication is handled by the worker that belongs to the user.

## 1. Runtime topology

```text
iPhone Safari ── GET / ─────────────► user's NotesFlash Worker Static Assets
                                               │ serves installable PWA
                                               ▼
macOS Tauri app ───────────────┐      PWA running on the same origin
                              │ HTTPS + device session
PWA ──────────────────────────┼────────► Worker API and /setup
                              │                 ├── D1: notes, devices, sessions, FTS
setup/recovery browser page ──┘                 ├── R2: note images
                                                ├── Workers AI: document/query embeddings
                                                ├── Vectorize: cosine-similarity index
                                                └── Queue: asynchronous indexing
```

The Cloudflare account token, D1 database ID, R2 credentials, Workers AI credentials, and Vectorize credentials never need to be copied into NotesFlash. The worker uses Cloudflare bindings to access those resources.

The only connection information stored by a native client is expected to be:

```text
worker endpoint
instance ID
device ID
opaque device session token
```

The endpoint is configuration, not a secret. The current MVP persists the connection profile (including its device bearer token) in the webview/browser's `localStorage`, but it does not persist note title, body, search results, or image bytes. Before a hardened public desktop release, move the native token to macOS Keychain and leave only non-secret endpoint/device metadata in web storage.

## 2. Repository layout relevant to deployment

```text
notesflash/
├── src/                         shared Svelte application
├── public/                      PWA static assets
├── dist/                        generated frontend bundle
├── src-tauri/
│   ├── Cargo.toml
│   ├── capabilities/default.json
│   ├── src/lib.rs               native lifecycle and shortcut integration
│   └── tauri.conf.json
└── cloud/
    ├── public/                  committed PWA build used by Deploy Button
    ├── migrations/              D1 schema
    ├── src/                     worker routes and queue consumers
    ├── wrangler.jsonc           Cloudflare resource bindings
    └── package.json
```

Cloudflare's current Deploy Button supports a repository subdirectory when that
subdirectory is fully isolated. `cloud/` meets that requirement: it has its own
lockfile, package metadata, Wrangler configuration, Worker source, migrations,
and committed PWA assets. Cloudflare treats it as the root of the cloned template.

## 3. Local frontend development

### Prerequisites

- Node.js 20 or newer;
- npm compatible with the checked-in lockfile;
- a modern browser;
- for the native wrapper, the additional macOS prerequisites in the next section.

Install and run the shared UI:

```bash
npm ci
npm run dev
```

Vite is configured to use `http://localhost:4173`. The Tauri development URL is deliberately set to the same address.

Build and inspect the production web bundle:

```bash
npm run check
npm run test:run
npm run build
npm run build:cloud-pwa
npm run preview
```

The generated PWA files are in `dist/`. `build:cloud-pwa` performs the same build
and replaces `cloud/public/` with that exact output; run it before publishing any
frontend change to the Deploy Button template.

## 4. macOS desktop application

### 4.1 Prerequisites

Build the macOS application on macOS. Install:

- Xcode Command Line Tools: `xcode-select --install`;
- the stable Rust toolchain from `rustup`;
- Node.js 20 or newer;
- npm dependencies with `npm ci`.

Confirm the toolchain before diagnosing an application error:

```bash
xcode-select -p
rustc --version
cargo --version
node --version
npm --version
```

The Tauri configuration requires macOS 11 or newer.

### 4.2 Development run

Run the native shell and Vite together:

```bash
npm run tauri -- dev
```

The development lifecycle is:

```text
Tauri CLI
  ├── runs `npm run dev`
  ├── waits for http://localhost:4173
  ├── compiles src-tauri
  └── opens the shared frontend in the native webview
```

### 4.3 Native window behavior

The MVP native shell implements the following behavior:

- the main window is approximately `720 × 760` points;
- the minimum resizable size is `480 × 560` points;
- only one NotesFlash process is allowed;
- launching NotesFlash a second time reveals and focuses the existing window;
- the default global shortcut on macOS is `Command + Shift + Space`;
- pressing the shortcut restores, shows, and focuses the main window;
- the native layer then emits `notesflash://focus-search` to the frontend;
- closing the window hides it so that the shortcut remains available;
- quitting with the normal macOS application lifecycle terminates the process.

The frontend event contract is:

```ts
import { listen } from '@tauri-apps/api/event';

const unlisten = await listen('notesflash://focus-search', () => {
  searchInput?.focus();
});
```

The listener should be registered when the application shell mounts and disposed when it unmounts. The frontend should also focus the search field on its initial load, because the native event can occur before JavaScript has mounted during a cold launch.

If `Command + Shift + Space` is already owned by another application, NotesFlash
continues to start, writes the native error to the log, and emits a frontend event
that displays a visible shortcut-conflict toast. Remove the conflict or change
`default_global_shortcut()` in `src-tauri/src/lib.rs`. The MVP does not yet expose
shortcut customization in Settings.

macOS global shortcut registration does not normally require Accessibility permission. NotesFlash should not request broad Accessibility or Input Monitoring access for this feature.

### 4.4 Local unsigned build

Build the `.app` and `.dmg` configured in `src-tauri/tauri.conf.json`:

```bash
npm run tauri -- build
```

The Tauri command invokes `npm run build` through `beforeBuildCommand`, so a separate frontend build is not required for this step.

Expected output locations are under:

```text
src-tauri/target/release/bundle/macos/NotesFlash.app
src-tauri/target/release/bundle/dmg/
```

For a universal Apple Silicon + Intel build:

```bash
rustup target add aarch64-apple-darwin x86_64-apple-darwin
npm run tauri -- build --target universal-apple-darwin
```

Do not distribute an unsigned local build as the public release. Gatekeeper will warn users, and quarantine behavior differs from a Developer ID signed application.

### 4.5 Signing and notarization

For distribution outside the Mac App Store, use an Apple Developer ID Application certificate and notarize the result. Before building, confirm that the signing identity is available:

```bash
security find-identity -v -p codesigning
```

Tauri can use a signing identity from the keychain and Apple notarization credentials from the build environment. A typical local or CI environment provides:

```text
APPLE_SIGNING_IDENTITY
APPLE_ID
APPLE_PASSWORD        an app-specific password, not the Apple ID password
APPLE_TEAM_ID
```

An App Store Connect API key can be used instead of Apple ID password authentication when preferred by the release pipeline. Keep certificates, passwords, and API keys in the CI secret store; never commit them to this repository.

After the signed build, verify the application and disk image:

```bash
codesign --verify --deep --strict --verbose=2 \
  src-tauri/target/release/bundle/macos/NotesFlash.app

spctl --assess --type execute --verbose=4 \
  src-tauri/target/release/bundle/macos/NotesFlash.app
```

Test the release after downloading it through a browser so that the package has the same quarantine metadata a user will encounter.

### 4.6 macOS release icon

The repository includes generated multi-resolution PNG and `src-tauri/icons/icon.icns` assets, and `tauri.conf.json` lists them in `bundle.icon`. Replace these generated MVP assets with the final product artwork before public release, then rerun `npm run tauri -- icon <source-1024.png>` so Finder, Dock, DMG, Windows, and any future platform packages stay consistent.

## 5. PWA deployment and installation on iPhone

The mobile product is the same Svelte UI running as a PWA. It has no global desktop shortcut, but note creation, full-feed browsing, character search, semantic search, editing, image upload, and image viewing use the same worker APIs.

### 5.1 Same-origin hosting model

The deployed NotesFlash Worker serves the PWA, setup page, and API from one origin:

```text
https://<user-instance>.workers.dev/          PWA
https://<user-instance>.workers.dev/api/*    API
```

Same-origin hosting has important benefits:

- no cross-origin API bootstrap is required;
- a future HttpOnly, Secure, SameSite session cookie can replace the MVP bearer-token storage;
- the PWA can eventually avoid persisting a bearer token in JavaScript-readable storage;
- CORS configuration is much smaller;
- the worker endpoint is automatically known.

`cloud/wrangler.jsonc` binds `cloud/public/` as Worker Static Assets, uses SPA
fallback for application routes, and runs the Worker first for `/api/*` and
`/setup`. The same source UI is built for Tauri and copied into this isolated
template with `npm run build:cloud-pwa`.

When opened from `workers.dev`, the connection screen pre-fills
`window.location.origin`, so the phone user only needs a pairing code. The
macOS Tauri origin is not HTTP(S), so its endpoint field remains empty until the
user pastes the Worker URL.

No Cloudflare Pages project or second deployment is required. If a future
maintainer intentionally hosts an additional web client on another origin, add
that exact origin to `ALLOWED_ORIGINS`; the bundled same-origin PWA itself does
not need CORS.

### 5.2 Service worker data boundary

The service worker may precache only the application shell:

```text
HTML
JavaScript
CSS
manifest
icons
other non-sensitive static assets
```

It must not cache:

```text
/api/notes/*
/api/search/*
/api/images/*
/api/devices/*
note bodies
search snippets
image responses
```

Worker responses containing user data should set at least:

```http
Cache-Control: no-store, private
Pragma: no-cache
```

`vite-plugin-pwa` is currently configured with no runtime API caching. Preserve that invariant when adding future offline features. Offline note storage is intentionally outside this cloud-only MVP.
The SPA navigation fallback explicitly denies `/api/*` and `/setup`, so an
installed service worker cannot replace the Worker-hosted setup page with the
application shell.

### 5.3 iPhone installation

The user installs the PWA without the App Store:

1. Open the HTTPS NotesFlash URL in Safari.
2. Tap the Share button.
3. Choose **Add to Home Screen**.
4. Confirm the name and icon.
5. Launch NotesFlash from the home-screen icon.

HTTPS is mandatory outside localhost. Test the installed standalone PWA, not only the Safari tab, because safe-area, keyboard, scrolling, and storage/session behavior differ.

The repository already includes PNG PWA icons at `192 × 192`, `512 × 512`, a maskable `512 × 512`, and an Apple touch icon at `180 × 180`. They are wired into the generated manifest and HTML head. Replace the MVP artwork with the final product icon before public release while preserving those dimensions and purposes.

## 6. Cloudflare backend resources

The deployment template declares the following bindings:

| Binding | Resource | MVP responsibility |
| --- | --- | --- |
| `DB` | D1 | note text, metadata, devices, sessions, pairing codes, character/FTS search state |
| `IMAGES` | R2 | original note images and authorized image delivery |
| `AI` | Workers AI | document and query embeddings |
| `VECTOR_INDEX` | Vectorize | cosine-similarity search |
| `INDEX_QUEUE` | Queue | asynchronous embedding/index updates |
| `ASSETS` | Worker Static Assets | same-origin PWA shell, manifest, service worker, and icons |

The default semantic model is `@cf/baai/bge-m3`, and the configured Vectorize dimensionality must match the model output used by the worker. The current MVP contract uses 1024 dimensions and cosine distance. Cloudflare currently documents a 60,000-token context; the Worker caps input at 60,000 characters and also enables model-side truncation. `SEMANTIC_MIN_SCORE` defaults to `0.45`; verify and tune it against a representative Chinese note corpus after the first real deployment.

The Queue consumer must be idempotent because queue delivery is at least once. A stale embedding job verifies the note version/content hash before it writes a vector. Before D1 switches away from an old vector, the consumer emits a separate delete job; that job refuses to remove a vector still referenced by a live note. Queue enqueue failure is caught after the D1 transaction, leaves the note in a retryable state, and never turns a committed note mutation into a misleading HTTP 500. Cron retries pending, failed, stale-processing, model-drifted, and content-hash-drifted notes. Deleted notes are restorable for `TRASH_RETENTION_DAYS` (30 by default); after vector cleanup and expiry, Cron permanently deletes their D1 rows and attached R2 objects.

Images are private user data. Store image metadata in D1 and bytes in the `IMAGES` R2 bucket. Upload and delete operations require device authentication; display uses either an authenticated read or a 24-hour HMAC capability URL issued inside the authenticated note response. Never expose account-level R2 keys to either client. Validate MIME type and byte size server-side, return `X-Content-Type-Options: nosniff`, and reject SVG in the initial release.

### 6.1 Local worker development

From the repository root, build and synchronize the latest same-origin PWA, then
create the local development secret file with a long random value:

```bash
npm run build:cloud-pwa
cp cloud/.dev.vars.example cloud/.dev.vars
```

Then initialize the local D1 database and run Wrangler:

```bash
cd cloud
npm ci
npm run db:migrate:local
npm run dev
```

The default Wrangler development endpoint is normally `http://localhost:8787`. Verify the public health and setup-status routes before testing a client:

```bash
curl http://localhost:8787/api/health
curl http://localhost:8787/api/setup/status
```

The Tauri development CSP permits localhost/127.0.0.1 API and image requests. The production CSP deliberately requires an HTTPS user-worker endpoint.

Local D1 and basic routes can be tested without production data. Workers AI and Vectorize behavior may require authenticated remote resources depending on the Wrangler development mode. Never point automated local tests at a user's production instance.

## 7. Deploy to Cloudflare button

### 7.1 What the button replaces

A Deploy to Cloudflare template can guide the user through repository import, Worker deployment, and provisioning/binding of supported resources declared by Wrangler. It replaces the normal developer workflow of installing Wrangler, logging in from a terminal, copying resource IDs, and manually editing bindings.

Current platform reference: [Cloudflare Deploy to Cloudflare buttons](https://developers.cloudflare.com/workers/platform/deploy-buttons/).

It does not mean that deployment occurs without confirmation. The expected user-facing flow is:

```text
click Deploy to Cloudflare
  → sign in to Cloudflare
  → authorize/import the public GitHub or GitLab template
  → review names and requested resources
  → set the owner setup/recovery secret
  → deploy
  → open the resulting worker URL
```

Cloudflare owns this deployment authorization flow. NotesFlash does not need an OAuth callback service and does not receive the user's Cloudflare or source-control token.

### 7.2 Publishing the template

Before exposing the button publicly:

1. Run `npm run build:cloud-pwa` and confirm `cloud/public/` contains the current PWA.
2. Push `cloud/` and the rest of this worktree to a public GitHub/GitLab branch; a local-only directory produces a 404 Deploy Button source URL.
3. Keep `cloud/` fully isolated with its own lockfile, `wrangler.jsonc`, migrations, Worker source, package metadata, and static assets.
4. Ensure Wrangler declares Static Assets, D1, R2, Vectorize, Workers AI, Queue producer/consumer, and the scheduled trigger.
5. Keep the deploy script's D1 migration command bound to `DB`, not a hard-coded database name or UUID.
6. Keep `OWNER_SETUP_SECRET` in `.dev.vars.example`; `cloud/package.json` supplies the Deploy Button description and random-generation guidance.
7. Run a clean deployment into a new Cloudflare account and verify Vectorize is created with 1024 dimensions and cosine distance.

Example button Markdown:

```md
[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](
  https://deploy.workers.cloudflare.com/?url=https://github.com/realllllty/notesflash/tree/main/cloud
)
```

The MVP connection screen uses that repository/subdirectory URL. Cloudflare
currently supports isolated subdirectory templates and automatic provisioning
for D1, R2, Vectorize, Workers AI, and Queues. The link remains unusable until
the local implementation is committed and pushed to the public `main` branch;
test it from a logged-out browser and a clean Cloudflare account before tagging
a release.

### 7.3 Database migration requirement

Creating a D1 binding is not sufficient. The tables, FTS virtual table, indexes, and triggers in `cloud/migrations/` must also be applied. The release deployment command should include the equivalent of:

```bash
wrangler d1 migrations apply DB --remote
wrangler deploy
```

Use the binding name `DB`, not a hard-coded database UUID. A deployment that returns a Worker URL but has not run migrations is incomplete and must not display a pairing code.

### 7.4 Owner setup secret

`OWNER_SETUP_SECRET` protects the uninitialized instance from being claimed by the first person who discovers its URL. Generate a unique, high-entropy secret for each deployment. In this MVP it also acts as the break-glass credential that can create a new recovery pairing code when every normal device session has been lost. It must not be embedded in the frontend bundle or pairing code.

After owner initialization:

- the worker records the initialized state in D1;
- the public initialization action becomes unavailable;
- normal device pairing uses short-lived pairing codes;
- the setup secret can create a recovery pairing code but cannot erase or reinitialize the instance.

Store this secret in a password manager. Anyone who knows it can authorize a new device through the recovery setup page. If it is exposed, rotate the Cloudflare Worker secret immediately and revoke any unfamiliar device sessions.

The bootstrap endpoints are intentionally small and explicit:

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/setup` | worker-hosted HTML setup/recovery page |
| `GET` | `/api/setup/status` | returns initialization state and instance metadata |
| `POST` | `/api/setup` | first initialization; returns the setup browser's owner device token |
| `POST` | `/api/setup/pairing-code` | initialized-instance recovery; verifies the setup secret and returns a new pairing code |
| `POST` | `/api/pairing-codes` | authenticated normal-device flow for creating another pairing code |
| `POST` | `/api/devices/pair` | consumes a pairing code and creates the new device session |

On first initialization, the `/setup` page calls `/api/setup`, uses the returned setup-browser token only to call `/api/pairing-codes`, and displays the resulting code. On an initialized instance, it calls `/api/setup/pairing-code` instead. The macOS/PWA client does not receive or store `OWNER_SETUP_SECRET` in either case.

### 7.5 Manual deployment fallback for maintainers

The button is the product path, but a manual path is useful for development and recovery. From `cloud/`, the resource creation commands are conceptually:

```bash
npm ci
npx wrangler login
npx wrangler d1 create notesflash-db
npx wrangler r2 bucket create notesflash-images
npx wrangler vectorize create notesflash-vectors \
  --dimensions=1024 \
  --metric=cosine
npx wrangler queues create notesflash-index
npx wrangler secret put OWNER_SETUP_SECRET
```

After creating resources, place the generated D1 ID and resource names into the local Wrangler configuration, then run:

```bash
npm run deploy
```

Do not ask normal NotesFlash users to follow this terminal flow.

## 8. Initial instance setup and pairing

### 8.1 First desktop connection

The intended first-run flow is:

```text
1. User installs NotesFlash.app.
2. User clicks the Deploy to Cloudflare link from the connection screen.
3. Cloudflare deploys the user's Worker, PWA assets, and resources.
4. User opens https://<instance>/setup.
5. User proves possession of OWNER_SETUP_SECRET.
6. If needed, the page initializes the owner setup-browser device; otherwise it uses the recovery pairing endpoint.
7. The page creates a short-lived pairing code.
8. The setup page displays the pairing code; the worker endpoint is the current browser origin.
9. The user enters endpoint + pairing code in the macOS app.
10. The app creates a device identity and exchanges the code for a session.
11. The app stores only credentials/connection metadata, never note content. The MVP uses web storage; the hardened native release should use Keychain.
12. The first authenticated notes request succeeds.
```

Pairing codes must be:

- generated from cryptographically secure randomness;
- stored in D1 only as a hash;
- short-lived, for example five to ten minutes;
- single-use;
- rate-limited;
- invalidated immediately after a successful exchange.

### 8.2 Adding the phone PWA

Open `https://<instance>.workers.dev/` in iPhone Safari and add it to the Home
Screen. The installed PWA pre-fills its own origin as the Worker endpoint. Open
`/setup`, prove possession of `OWNER_SETUP_SECRET`, generate a short-lived code,
return to the PWA, and enter the code. The authenticated API also supports
`POST /api/pairing-codes`; a future device-management UI can expose that normal
flow without asking for the recovery secret. A later hardening release can
replace JavaScript-readable bearer storage with a same-origin HttpOnly cookie
and add QR scanning as a convenience.

Per-device pairing provides a consistent device-management model:

```text
worker /setup creates pairing code
  → phone PWA enters endpoint + code
  → worker creates a distinct phone device/session
  → user can later revoke the phone without revoking the Mac
```

The current UI only disconnects its own session. The Worker already exposes
`GET /api/devices` and `DELETE /api/devices/:id`, so release acceptance can
inspect/revoke another device with an authenticated API client. A future visual
device-management screen should show name, platform, creation time, throttled
last-seen time, and a revoke action.

### 8.3 Session exchange

The pairing exchange is entirely between the client and the user's worker:

```text
client                         user's Worker/D1
  │                                  │
  ├── endpoint + pairing code ──────►│ verify hash, expiry, unused state
  │                                  │ create device and session
  │◄── device/session credentials ───┤ mark pairing code used
  │                                  │
```

The worker stores only a hash of each long-lived opaque session token. The current client persists the original device token in `localStorage`; this is an explicit MVP tradeoff and makes strong CSP/XSS prevention important. A hardened native client should put it in Keychain, and a future PWA session hardening pass should use the existing same-origin topology to prefer a Secure, HttpOnly, SameSite cookie.

### 8.4 Reconnection and recovery

- A second launch of the macOS application reuses the saved connection session and never redeploys the backend.
- Installing the PWA on another phone creates a new device session, not a new Cloudflare backend.
- “Disconnect this device” flushes the active editor, calls `POST /api/auth/logout`, and then removes the local profile; if the Worker is unreachable, local disconnect still completes after the four-second request timeout.
- A remotely revoked device receives `401 AUTH_REQUIRED` on its next API request and must disconnect/re-pair locally.
- Losing every authenticated device requires an owner recovery method established during setup. The NotesFlash publisher cannot recover a self-hosted user's data or session.
- A pairing code is not a backup or recovery code.

## 9. Post-deployment acceptance test

Run this checklist against a brand-new Cloudflare account or an isolated test account:

1. Deploy from the public button without using Wrangler locally.
2. Confirm Static Assets, D1, R2, Vectorize, Workers AI, Queue, and Worker bindings exist; verify the root URL serves the PWA.
3. Confirm all D1 migrations were applied.
4. Confirm `/setup` rejects an incorrect owner secret.
5. Initialize once and confirm a second initialization attempt is rejected.
6. Pair the macOS app using only endpoint + one-time code.
7. Relaunch the app and confirm the saved connection session reconnects without persisting note content.
8. Press `Command + Shift + Space`; confirm the existing window appears and the search input receives focus.
9. Close the window, press the shortcut, and confirm the process was hidden rather than destroyed.
10. Create a plain-text note; confirm the save response does not wait for embedding and still succeeds if Queue is temporarily unavailable.
11. Search by an exact character substring and confirm the lexical result appears.
12. Wait for indexing and search with a semantically similar phrase; confirm Vectorize augments the result and tune `SEMANTIC_MIN_SCORE` if `0.45` is too broad or too strict.
13. Upload a supported image and confirm the authenticated image route displays it in both Mac and PWA.
14. Confirm no note API response appears in browser Cache Storage, IndexedDB, or service-worker runtime cache.
15. Install the PWA from Safari and repeat read/search/image tests in standalone mode.
16. Reuse a consumed pairing code and confirm it fails.
17. Call `GET /api/devices`, revoke the phone with `DELETE /api/devices/:id`, and confirm its next request is rejected without affecting the Mac.
18. Disconnect a test device, confirm `POST /api/auth/logout` returns success, and confirm reuse of the same token returns `401 AUTH_REQUIRED`.
19. Send invalid pairing attempts until the configured window returns `429 RATE_LIMITED`.
20. Cause a stale note update with a different image list; confirm it returns `409 VERSION_CONFLICT` and the winning note's images remain unchanged.
21. Temporarily disable or exhaust semantic indexing and confirm character search and note saving still work.

## 10. Release boundaries for this MVP

The MVP intentionally does not include:

- a centrally hosted NotesFlash account or OAuth service;
- an iOS native application;
- offline note persistence;
- Markdown rendering;
- folders, notebooks, or nested organization;
- real-time collaborative editing;
- a configurable global shortcut;
- automatic desktop updates;
- zero-knowledge end-to-end encrypted cloud search.

It does include plain-text notes, image storage/display, a flat continuous feed, lexical search, optional semantic augmentation, quick creation from the current query, macOS shortcut activation, PWA installation, and user-owned Cloudflare infrastructure.
