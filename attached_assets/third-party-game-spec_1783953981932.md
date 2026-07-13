# Curious Reader — Third-Party Game Developer Specification

**Audience:** external teams building new web games/readers for the Curious Reader container
**Status:** v1.1 · **Last updated:** 2026-07-08

This is a self-contained handoff document. It tells you everything you need to
build, package, test, and upload a game for the Curious Reader container —
without access to the container's source code. It consolidates the container
team's internal specifications (compatibility spec v1.4, data-collection spec
v1.0) into one document.

**Read it in order.** The sections follow the delivery pipeline:

1. [How your game runs](#1-runtime-environment) — the offline `file://` WebView environment
2. [Offline compliance rules](#2-offline-compliance-must--must-not) — what your code must and must not do
3. [Allowed & forbidden modules](#3-allowed--forbidden-modules)
4. [Media format requirements](#4-media-formats)
5. [ZIP packaging](#5-zip-packaging) — the tier model and naming conventions
6. [Data/event reporting contract](#6-data-reporting-the-cr_event-contract)
7. [Self-verification checklist](#7-testing--self-verification-checklist)
8. [Upload workflow](#8-upload-workflow) — MCP step-by-step, plus REST/admin alternatives

---

## 1. Runtime environment

Curious Reader is an offline-first literacy app (Android APK / iOS IPA) used by
children in low-connectivity environments. It downloads your game as ZIP files,
extracts them onto the device, and loads your `index.html` in an embedded
WebView from a **`file://` URI** — there is no web server, and frequently no
internet at all.

Key facts about the execution context:

- **Origin is `file://`.** `window.location.origin` returns the string `"null"`.
- **No Service Workers.** SW registration always fails from `file://`; the
  container stubs out `navigator.serviceWorker` defensively.
- **No CORS / same-origin policy** for local files — relative `fetch`/XHR to
  files inside your extracted directory works (with the caveats in §2.3).
- **Network is blocked by default.** The container injects a strict CSP and a
  JS "NetGuard" shim that wraps `fetch`, `XMLHttpRequest`, `WebSocket`,
  `EventSource`, `sendBeacon`, `Worker`, and the `src`/`href`/`data` setters of
  asset elements, rejecting every URL that is not `file:`, `data:`, `blob:`, or
  `about:`. A native WebView navigation gate fails closed for non-local URLs.
  **Any outbound network call from your game is a bug**, and shows up in the
  container's diagnostic log as a `NETGUARD_BLOCK` entry.
- **Launch URL carries query parameters.** The container launches your game as:

  ```
  file://…/<your-game-dir>/index.html?cr_lang=<langCode>[&cr_book=<bookSlug>]&cr_user_id=<id>
  ```

  Exactly which parameters appear is determined by the **URL template** you
  register with your game at upload time (§8.3). Your game must read them from
  `window.location.search`:

  | Parameter | Meaning |
  |---|---|
  | `cr_lang` | The content language to load (e.g. `english`, `isixhosa`). Always present. |
  | `cr_book` | The core-content slug (e.g. a book) — only for 3-tier games (§5.1, Layout B). |
  | `cr_user_id` | The container-assigned user identity, needed for data reporting (§6). Treat as opaque. |

- The container patches your HTML before first run (strips CDN `<script>` tags,
  Facebook Pixel blocks; stubs `navigator.serviceWorker`; rewrites webpack
  `publicPath: "/"` to `"./"`; rewrites root-relative fetch/XHR/Audio URLs).
  These patches are **defensive backstops** — do not rely on them; build your
  game so they are no-ops.

---

## 2. Offline compliance (MUST / MUST NOT)

### 2.1 Everything relative

All static assets — JS, CSS, images, fonts, audio, WASM, animation files — must
be reachable via **relative paths** from `index.html`.

- Set your bundler's public path to `./` (webpack: `output.publicPath: './'`).
- No hardcoded absolute paths (`/assets/foo.png` resolves to the filesystem
  root under `file://`). CSS `url(...)` values and static `<img src>` attributes
  are **not** rewritten by the container — they must be relative in your build.
- Never use `window.location.origin` to construct asset URLs (it is `"null"`).
  If you need a base, guard it:

  ```js
  const base = window.location.protocol === 'file:' ? '.' : window.location.origin;
  ```

- Data files (e.g. language JSON) must not contain absolute CDN URLs for audio
  or images. Rewrite them to relative paths in a post-build step. The container
  does not rewrite URLs inside JSON payloads.
- No `.map` source-map files in the shipped ZIPs.
- After building, audit: `grep -r "src=['\"]/" build/` and `grep -r "url(/" build/`
  must return no game-critical local paths.

### 2.2 No hard network dependencies

The game must reach its playable state with the device fully offline.

- **Any** external call made during startup (analytics init, feature flags,
  remote config, error reporting) must be either absent from the standalone
  build (preferred — see §3) or wrapped in a timeout + try/catch:

  ```js
  try {
    await Promise.race([
      externalService.initialize(),
      new Promise(resolve => setTimeout(resolve, 5000)), // 5 s max
    ]);
  } catch (e) { /* offline — continue */ }
  ```

  Rationale: without internet, TCP connections can take up to 75 seconds to
  time out at OS level; an un-guarded `await` freezes your loading screen.
- All analytics/error-reporting calls after startup must be **fire-and-forget**
  — never `await`ed on any path that affects UI state, never allowed to throw
  into gameplay code.
- Loading-screen dismissal must never depend on network availability.
- Do not gate gameplay on `navigator.onLine` (it can report `true` with no
  actual connectivity).
- Persist game state (progress, scores, settings) in `localStorage` — it works
  reliably from `file://` in all WebViews. Do not use IndexedDB-backed
  network-sync libraries.

### 2.3 `file://` loader quirks (critical)

Two Chromium/Android-WebView quirks break the common "fetch + Cache API"
loader pattern, even though both APIs appear to exist:

1. **`window.fetch()` rejects `file://` URLs on Android WebView** with
   `TypeError: Failed to fetch` — even for files that load fine via
   `<img>`/`<audio>`/`XMLHttpRequest`.
2. **The Cache Storage API is defined only for HTTP(S).** `cache.put()` on a
   `file://` request always rejects with
   `Request scheme 'file' is unsupported`.

**Required pattern** — detect the origin once at boot and pick the right loader:

```js
const IS_FILE_ORIGIN =
  typeof window !== 'undefined' && window.location.protocol === 'file:';

async function loadBinary(url) {
  if (IS_FILE_ORIGIN) {
    return await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('GET', url, true);
      xhr.responseType = 'arraybuffer';
      xhr.onload = () => {
        // file:// success reports status 0 (no HTTP layer)
        if (xhr.status === 0 || xhr.status === 200) resolve(xhr.response);
        else reject(new Error(`XHR ${xhr.status} for ${url}`));
      };
      xhr.onerror = () => reject(new Error(`XHR network error for ${url}`));
      xhr.send();
    });
  }
  // HTTP(S) builds may use fetch + Cache Storage as usual
  const cache = await caches.open('game-assets');
  let response = await cache.match(url);
  if (!response) {
    response = await fetch(url);
    if (response.ok) await cache.put(url, response.clone());
  }
  return await response.arrayBuffer();
}
```

Use `loadBinary()` for **every** locally loaded binary: fonts (build a
`FontFace` from the buffer), audio buffers, JSON data files, animation/WASM
files. Never call `caches.open(...)` at all when `IS_FILE_ORIGIN` is true.

**Asset preloading must use `Promise.allSettled`, not `Promise.all`** — a
single missing or corrupt asset must not strand the loading screen. For audio,
substitute a 1-frame silent buffer on decode failure so playback code never
crashes on a missing entry.

### 2.4 Miscellaneous guards

- `BroadcastChannel` construction may throw in some `file://` WebViews — wrap
  in try/catch and null-guard all uses.
- Your `index.html` must contain no external `<script src="https://…">` tags
  (Workbox CDN, Google Tag Manager, Facebook Pixel). A `<link rel="manifest">`
  is tolerated but must never be required for gameplay.
- Have your `<canvas>` (or root element) present in the HTML before your JS
  executes, so synchronous DOM queries succeed.
- Do not call `navigator.serviceWorker.register()` anywhere; if you share code
  with a PWA build, guard it: `if (window.location.protocol === 'file:') return;`

---

## 3. Allowed & forbidden modules

### Forbidden in the standalone (container) build

| Module / pattern | Why |
|---|---|
| Service Workers / Workbox runtime registration | Always fails on `file://`; stubbed by the container |
| Cache Storage API on any `file://` code path | Always rejects (§2.3) |
| `window.fetch()` for local assets | Rejects on Android WebView (§2.3) |
| Feature-flag SDKs at runtime (Statsig, `@statsig/js-client`, etc.) | Network-dependent init hangs offline; must be a build-time stub returning defaults |
| Google Tag Manager (`gtag.js` script tag or runtime injection) | Blocked; loading it produces errors |
| Sentry / crash reporters that phone home | Blocked; replace `Sentry.init()` with a stub in standalone builds |
| Direct analytics SDKs as the reporting path (GA4/Firebase Analytics, Mixpanel, etc.) | The container's data bridge (§6) is the only supported reporting path for new games. (Game-side GA4 is tolerated as legacy for CDN-only builds; it must never block anything.) |
| Firebase dynamic web-config fetch | Network at startup; pass a static config object if you use Firebase in a CDN build |
| WebSockets / EventSource for game data | Require a running server |
| `uuid`-style packages that require `crypto.getRandomValues` polyfills or Node built-ins | Use `crypto.randomUUID()` with the pure-JS fallback shown in §6.4 |
| Facebook Pixel or similar injected trackers | Stripped by the container; cause console noise |
| Anything that requires network at runtime for core gameplay | The device is offline by design |

**Build-time exclusion is required, not just runtime guarding.** Produce a
dedicated standalone build (e.g. `STANDALONE=true` + `webpack.DefinePlugin`)
where the SDKs above are replaced with stubs and tree-shaken out. The goal:
with the device offline, the container's log shows **zero** `NETGUARD_BLOCK`
entries during loading and gameplay. If any appear, the build is non-compliant.

### Allowed, with conditions: Rive animations

`@rive-app/canvas` is allowed, but it ships two WASM artifacts and many Android
WebViews (Xiaomi MIUI, Huawei, older Samsung) cannot instantiate the full
`rive.wasm`. Rive's built-in recovery fetches `rive_fallback.wasm` from
`cdn.jsdelivr.net` — which is blocked offline, freezing your game on the
loading screen. Two mandatory changes:

1. **Bundle both WASM files** into your build output, e.g. with CopyWebpackPlugin:

   ```js
   new CopyWebpackPlugin({ patterns: [
     { from: 'node_modules/@rive-app/canvas/rive.wasm',          to: 'assets/rive/rive.wasm' },
     { from: 'node_modules/@rive-app/canvas/rive_fallback.wasm', to: 'assets/rive/rive_fallback.wasm' },
   ]}),
   ```

2. **Force the fallback WASM on `file://`, before any `Rive` instance exists:**

   ```js
   import { RuntimeLoader } from '@rive-app/canvas';
   if (window.location.protocol === 'file:') {
     RuntimeLoader.setWasmUrl('./assets/rive/rive_fallback.wasm');
   }
   ```

Never rely on Rive's automatic CDN fallback in a container build.

### Generally safe

- Canvas/WebGL rendering, Web Audio API (`decodeAudioData` on buffers from
  `loadBinary()`), `localStorage`, `XMLHttpRequest` for local assets, relative
  dynamic `import()` (with `publicPath: './'`), Web Fonts via `FontFace` from
  ArrayBuffers.

---

## 4. Media formats

### Audio

- **Location convention:** all per-language audio lives under
  `./lang/{langCode}/audios/` inside your build (this exact layout is required
  — the container's tooling assumes it). Shared, language-independent audio
  lives under `./assets/audios/`.
- **Formats:** MP3 and WAV are what existing games ship and are safe on every
  target WebView. Prefer MP3 for size; WAV is fine for very short SFX. Avoid
  exotic containers (OGG/Opus support varies on older iOS WebViews).
- All audio references in language data files must be **relative paths**
  (`lang/isixhosa/audios/LetterA.mp3`), never absolute CDN URLs.
- Decode via Web Audio from buffers loaded with `loadBinary()` (§2.3), or play
  via `<audio src>` / `new Audio(relativeUrl)` — both work on `file://`.

### Images

- PNG, JPEG, WebP, and SVG all render fine inside the WebView.
- **True-format pitfall:** files must actually be the format their extension
  claims. In particular, a `.png` that is really WebP or JPEG under the hood
  will render in the WebView but **breaks downstream Android packaging tools**
  used by the container team. Verify with `file yourimage.png` — it must report
  `PNG image data`. If not, re-encode (e.g. `magick input.png output.png`).

### Language-pack icons

Each language pack you upload is accompanied by a **tile icon** shown on the
container's home grid (icons are uploaded alongside the language ZIP — they are
NOT packed inside the ZIP):

- Format: **true PNG** (see pitfall above).
- Square, recommended 512×512 (any square size ≥192×192 is accepted).
- One icon per tile — i.e. per (engine, language), or per (engine, core,
  language) for 3-tier games.

---

## 5. ZIP packaging

### 5.1 The tier model

Content is split into up to three tiers so a shared engine is shipped once and
languages are added as small incremental packs:

| Tier | What it is |
|---|---|
| **engine** | The main game engine / runtime (top tier, always present) |
| **core** | A set of content that is **language-agnostic** (optional mid tier — used e.g. for books, where each book's art/structure is shared across its languages) |
| **lang** | The per-language content pack (bottom tier, always present) |

> **Tier names vs. filename tokens.** For historical reasons the tokens baked
> into ZIP filenames do NOT match the tier names: the **engine** ZIP uses the
> `-core` filename token, and the **core** ZIP uses the `-book-` token. The
> filename tokens are frozen (the pipeline classifies ZIPs by them); the tier
> names are what people and the CMS UI use. The tables below show both.

Two layouts are supported:

**Layout A — 2-tier (game-style).** One playable tile per (engine, language).
No core tier.

| Tier | Filename | Contents | One per |
|---|---|---|---|
| engine | `<engine>-core.zip` | `index.html`, engine JS/CSS, shared assets, fonts, WASM | engine version |
| lang | `<engine>-lang-<langCode>.zip` | `lang/<langCode>/` data + audio only | language |

**Layout B — 3-tier (book-style).** One tile per (engine, core, language). Use
this when your engine plays multiple language-agnostic content units (e.g.
books) that each ship per-language variants. The core slug travels on the wire
as `cr_book` / `bookSlug` (frozen physical names).

| Tier | Filename | Contents | One per |
|---|---|---|---|
| engine | `<engine>-core.zip` | Engine runtime (JS/CSS/shared assets) | engine version |
| core | `<engine>-book-<coreSlug>.zip` | Language-agnostic content (art, audio, structure) shared across that unit's languages | core unit (e.g. book) |
| lang | `<engine>-book-<coreSlug>-lang-<langCode>.zip` | Per-(core, language) text + audio only | (core, language) |

Naming rules:

- `<engine>` is your engine slug: stable, lowercase, no spaces (e.g. `ftm`,
  `crwp`). Agree it with the Curious Learning team; it never changes.
- The tokens `-core` (engine tier), `-book-<coreSlug>` (core tier), and
  `-lang-<langCode>` (lang tier) are **structural** — the container's tooling
  classifies ZIPs by these patterns. Do not deviate.
- `<coreSlug>` identifies the core-tier content unit (e.g. the book slug):
  stable, lowercase, no spaces.
- `<langCode>` is the language identifier used in `cr_lang` (e.g. `english`,
  `isixhosa`) — lowercase, no spaces. Use codes already in the Curious Learning
  catalog where possible; new codes need a display name at upload time.
- **One ZIP per language** (or per (core, language)). Never combine multiple
  languages in one ZIP.

### 5.2 How the container consumes them

All ZIPs of one engine are extracted, in order (engine → core → lang),
into a single shared directory on the device. Therefore:

- The ZIPs must **merge cleanly**: no file in a later ZIP may overwrite a file
  from an earlier one (they occupy disjoint subtrees: the engine at the root,
  languages under `lang/<langCode>/`, core units under their own subtree).
- The engine ZIP is extracted **once per engine**, shared by every language
  tile — keep everything language-specific out of it.
- The core ZIP (Layout B) is extracted once per (engine, core unit).
- After extraction the container launches
  `file://…/index.html?<your URL template query>` (§1).

### 5.3 Required internal structure

Engine ZIP (`<engine>-core.zip`) — paths are relative to the ZIP root, no
wrapping top-level folder:

```
index.html            ← entry point, at the ZIP root
<engine bundle>.js
*.css
assets/
  audios/             ← shared (non-language) audio
  fonts/              ← all font files your engine loads
  images/             ← images, sprite sheets
  rive/               ← rive.wasm + rive_fallback.wasm + .riv files (if using Rive)
sw.js                 ← optional; if present it is used only for asset discovery, never executed
```

The engine ZIP must NOT contain any `lang/` directory.

Language ZIP (`<engine>-lang-<langCode>.zip`):

```
lang/
  <langCode>/
    <your language data file(s)>.json
    audios/
      <every per-language audio file referenced by the data>
```

For Layout B, the core ZIP carries the content unit's language-agnostic
subtree, and the lang ZIP carries only that unit's `lang/<langCode>/` (or
equivalent per-language) files — same merge-cleanly rule.

Compression: any deflate level is accepted; store-only (level 0) extracts
fastest on low-end devices and is recommended for very large asset sets.

### 5.4 The URL template

When your engine is first registered (§8.3) you supply a **URL template** that
defines the query string the container appends when launching your game:

- Layout A example: `https://yourgame.example.org/?cr_lang={lang}`
- Layout B example: `https://yourplayer.example.org/?cr_book={book}&cr_lang={lang}`

Only the **query part** matters for the offline container — `{lang}` and
`{book}` (the core-unit slug) are substituted per tile, and the resulting query is appended to the
local `file://…/index.html`. (The host part is used only when the game is
served remotely.) The container additionally appends `cr_user_id`. Your game
must parse all of these from `window.location.search`.

---

## 6. Data reporting: the `cr_event` contract

Your game reports usage data by posting envelopes over the WebView JS bridge.
The container validates, deduplicates, stores them offline, and syncs them to
the analytics warehouse when the device gets connectivity. **The game performs
no network I/O for reporting** — that is what makes it work offline.

### 6.1 Transport

```js
window.ReactNativeWebView.postMessage(jsonString)
```

Post a single JSON **string**:

```json
{ "type": "cr_event", "payload": { …envelope, see 6.2… } }
```

- The game runs inside the container exactly when
  `typeof window.ReactNativeWebView?.postMessage === 'function'`. When absent
  (plain browser / CDN), reporting must silently no-op.
- One envelope per message. **Max 64 KB** per message (oversize is rejected whole).
- Fire-and-forget: never `await`ed, always wrapped in try/catch.
- Do **not** batch, queue, or retry in the game — the container handles
  offline buffering and retries. Emit at the moment the event happens.

### 6.2 Envelope

Every payload MUST contain exactly these top-level fields:

```json
{
  "payload_id": "f4f9c2aa-1f3f-4f0e-9d1a-7b6f0c2f3a11",
  "cr_user_id": "9aa3o9mo4v02p4l6idndujs5g32026311194023",
  "sub_app_id": "yourgame",
  "payload_version": 1,
  "collection": "user_sessions_data",
  "timestamp": "2026-07-08T14:14:03.023Z",
  "data": { "type": "level_completed", "lang": "english", "score": 5, "max_score": 8 },
  "options": {}
}
```

| Field | Rules |
|---|---|
| `payload_id` | UUID v4, **freshly generated per payload**. The dedup key — a reused id silently loses data. |
| `cr_user_id` | Read from the launch URL query param `cr_user_id`. Send `""` if absent; the container backfills. Never invent your own user IDs. |
| `sub_app_id` | Stable lowercase game identifier, agreed with the Curious Learning data team; never changes between releases. |
| `payload_version` | Currently `1`. |
| `collection` | `"user_sessions_data"` or `"summary_data"` only. Anything else is rejected. |
| `timestamp` | ISO-8601 UTC: `new Date().toISOString()`. |
| `data` | Your fields — JSON-serializable values only (no `undefined`, `NaN`, `Infinity`, functions, cycles). New fields may be added anytime without coordination. |
| `options` | `summary_data` only (§6.3). Omit or `{}` otherwise. |

### 6.3 Collections

- **`user_sessions_data`** — granular, append-only; one record per event
  occurrence (level completions, session starts, scores). `options` is
  ignored. Conventions for `data`: always include `type` (snake_case event
  name) and `lang`; always send `max_score` with any `score`; pick one time
  unit for durations and never change it.
- **`summary_data`** — one lifetime-aggregate document per user per game.
  Fields merge per `options`: `"add"` (numeric increment, default 0 base) or
  `"replace"` (overwrite; the default when a field isn't listed). Example
  after each level:

  ```json
  {
    "data":    { "levels_played": 1, "total_time_played": 95, "last_level_number": 7 },
    "options": { "levels_played": "add", "total_time_played": "add", "last_level_number": "replace" }
  }
  ```

  Invalid per-field ops are skipped and logged; the rest still apply.

### 6.4 Reference implementation

Dependency-free; the envelope is the contract, the code is not:

```ts
const SUB_APP_ID = 'yourgame'; // ← agree with the Curious Learning data team

const crUserId =
  new URLSearchParams(window.location.search).get('cr_user_id') ?? '';

function uuidv4(): string {
  if ('randomUUID' in crypto) return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, x => x.toString(16).padStart(2, '0'));
  return `${h.slice(0,4).join('')}-${h[4]}${h[5]}-${h[6]}${h[7]}-${h[8]}${h[9]}-${h.slice(10).join('')}`;
}

function emit(
  collection: 'user_sessions_data' | 'summary_data',
  data: Record<string, unknown>,
  options?: Record<string, 'add' | 'replace'>
): void {
  try {
    if (typeof (window as any).ReactNativeWebView?.postMessage !== 'function') return;
    (window as any).ReactNativeWebView.postMessage(JSON.stringify({
      type: 'cr_event',
      payload: {
        payload_id: uuidv4(),
        cr_user_id: crUserId,
        sub_app_id: SUB_APP_ID,
        payload_version: 1,
        collection,
        timestamp: new Date().toISOString(),
        data,
        ...(options ? { options } : {}),
      },
    }));
  } catch { /* never let reporting break gameplay */ }
}
```

### 6.5 Reporting rules

MUST: fresh UUID per payload · read `cr_user_id` from the URL · whitelisted
collections only · fire-and-forget + exception-safe · silent no-op outside the
container · include the bridge in the standalone build (do NOT stub it — it
makes no network calls and is the only path that works offline) · keep
`sub_app_id` and `data.type` values stable across releases.

MUST NOT: perform any network I/O for reporting · send `options` with
`user_sessions_data` · exceed 64 KB · batch/queue/retry · emit unbounded
high-frequency events (per-frame/per-tap; per-puzzle granularity is the floor)
· derive or persist your own user/device identifiers.

---

## 7. Testing & self-verification checklist

Complete every item before submitting content.

### 7a. Build-time

- [ ] Bundler public path is `./`; no `"/"` publicPath in the emitted bundle
- [ ] No `.map` files in the output
- [ ] `grep -r "src=['\"]/" build/` and `grep -r "url(/" build/` show no game-critical absolute local paths
- [ ] Language JSON contains no absolute CDN URLs (all relative)
- [ ] Standalone build contains no feature-flag/GTM/Sentry network code (stubbed at build time)
- [ ] If using Rive: `assets/rive/` contains BOTH `rive.wasm` and `rive_fallback.wasm`, and `RuntimeLoader.setWasmUrl` is forced on `file:` protocol
- [ ] Every icon and image is the true format its extension claims (`file *.png` → `PNG image data`)

### 7b. Offline load test

Open `build/index.html` directly in Chrome via `file:///…/index.html?cr_lang=<code>`
with DevTools Network set to **Offline**:

- [ ] Loading screen clears within 10 seconds
- [ ] Game renders and plays; language content loads; audio plays
- [ ] Progress persists to `localStorage` across a reload
- [ ] Zero attempted external network requests in the Network tab
- [ ] No JS console errors (analytics-failure warnings acceptable)
- [ ] In a plain browser (no container), zero bridge errors and zero `postMessage` attempts

### 7c. ZIP integrity

- [ ] Engine ZIP has `index.html` at its root, no `lang/` directory
- [ ] Each lang ZIP contains only `lang/<langCode>/…` (or the per-(core, language) subtree for Layout B)
- [ ] All ZIPs of the engine extract into one directory with no overwrites
- [ ] After extracting engine + one language ZIP together: `index.html?cr_lang=<code>` plays fully offline
- [ ] Every language you ship has a complete audio set (no missing files referenced by the data)

### 7d. Event emission

- [ ] Each instrumented milestone emits exactly one well-formed `cr_event` (verify by temporarily logging the JSON string in a browser run)
- [ ] `max_score` accompanies every `score`
- [ ] Envelope sizes stay far below 64 KB

In-container verification (done with the Curious Learning team once your
content is uploaded): each event appears in the container's diagnostic log,
replayed `payload_id`s are stored once, and airplane-mode events sync when the
device goes online.

---

## 8. Upload workflow

The Curious Reader CMS exposes an **MCP (Model Context Protocol) endpoint** as
the primary programmatic upload interface, plus REST endpoints and a web admin
UI as alternatives. Content always lands in the **development** channel first;
a separate **promotion** step makes it live in the production container.

You will need from the Curious Learning team:

- The server base URL (referred to below as `https://<server>`)
- An **MCP API key** (for the MCP route), or an allowlisted Google account
  (for the REST/admin routes)
- Confirmation of your engine slug, `sub_app_id`, and any new language codes

### 8.1 Connecting an MCP client

- Endpoint: `POST https://<server>/mcp` (Streamable HTTP transport, stateless —
  each POST is self-contained; no SSE session)
- Auth: send the API key as `Authorization: Bearer <key>` **or** `x-api-key: <key>`

Example configuration for a generic MCP client:

```json
{
  "mcpServers": {
    "curious-reader-cms": {
      "type": "http",
      "url": "https://<server>/mcp",
      "headers": { "Authorization": "Bearer <YOUR_MCP_API_KEY>" }
    }
  }
}
```

The server is named `curious-reader-cms` and exposes four tools:
`list_inventory`, `upload_core_game`, `upload_language_pack`, `promote_content`.

> ZIP contents are passed **base64-encoded** in the tool arguments. Practical
> size guidance: base64 inflates payloads ~33%; for ZIPs larger than a few
> tens of MB, prefer the REST endpoints (§8.6), which accept binary multipart
> uploads up to 200 MB.

### 8.2 Step 1 — survey the inventory

Call `list_inventory` (no arguments) to see every content item with its kind
(`engine` / `core` / `lang`), engine, language, version, channel status
(`development` / `production`), and size. Use it before and after uploads.

### 8.3 Step 2 — upload the engine ZIP (`upload_core_game`)

For a brand-new engine you must include `title` and `urlTemplate` (they
register the engine); for a new version of an existing engine, only
`engineSlug` and `zipBase64` are required.

```json
{
  "tool": "upload_core_game",
  "arguments": {
    "engineSlug": "wordgarden",
    "title": "Word Garden",
    "urlTemplate": "https://wordgarden.example.org/?cr_lang={lang}",
    "hasCoreLevel": false,
    "filename": "wordgarden-core.zip",
    "zipBase64": "<base64 of wordgarden-core.zip>"
  }
}
```

- `hasCoreLevel`: set `true` only for Layout B (3-tier) engines that use the
  optional core tier; then your `urlTemplate` should include `{book}` (the
  core-unit placeholder, e.g. `…?cr_book={book}&cr_lang={lang}`).
- The response echoes the created content item, including its `id` — note it;
  you'll need it for promotion.

### 8.4 Step 3 — upload each language pack (`upload_language_pack`)

One call per language (per (core, language) for Layout B — pass the core-unit
slug as `bookSlug`, the frozen wire name).
For a language code new to the catalog, include at least `displayName`.

```json
{
  "tool": "upload_language_pack",
  "arguments": {
    "engineSlug": "wordgarden",
    "langCode": "swahili",
    "displayName": "Swahili",
    "displayNameNative": "Kiswahili",
    "languageInEnglishName": "Swahili",
    "filename": "wordgarden-lang-swahili.zip",
    "zipBase64": "<base64 of wordgarden-lang-swahili.zip>",
    "iconBase64": "<base64 of the tile icon PNG>"
  }
}
```

- `iconBase64` is optional per upload but every tile needs an icon before it
  ships — supply a true-PNG (§4).
- For Layout B add `"bookSlug": "my-first-book"` — this registers the core
  unit and the (engine, core, language) tile.

> **Layout B note:** the standalone **core ZIP** (`<engine>-book-<slug>.zip`,
> the language-agnostic mid tier) currently has **no MCP tool** — upload it
> via the REST endpoint `/api/content/book` or the admin UI (§8.6). Layout A
> teams are unaffected.

### 8.5 Step 4 — verify, then promote

1. Call `list_inventory` again — your new items should appear with status
   `development`.
2. Ask the Curious Learning team to preview the content in their admin CMS
   (it has an in-browser player that runs your game exactly as the device
   will, including the URL-template query), **or** verify yourself against the
   development channel manifest:
   `GET https://<server>/api/manifest?channel=development` — your tile should
   be listed with its `zips[]` (`core` [+ `book-<slug>`] + `lang-<code>`).
3. Make it live with `promote_content`, once per item (engine, then each pack):

```json
{ "tool": "promote_content", "arguments": { "itemId": "<id from the upload response>" } }
```

Promotion moves that item to **production** and automatically demotes the
prior production version of the same logical item. Devices pick it up on their
next manifest refresh. A tile only appears on devices when **all** of its
tiers (engine [+ core] + lang) have a production version.

### 8.6 Alternatives: REST endpoints and the admin UI

All of the below require an allowlisted, authenticated session (Google
sign-in via the admin site) rather than the MCP API key.

| Action | Endpoint | Notes |
|---|---|---|
| Upload engine ZIP | `POST /api/content/core` | multipart: `file` + fields `engineSlug` (+ `title`, `urlTemplate`, `hasCoreLevel` for new engines) |
| Upload core ZIP (Layout B mid tier) | `POST /api/content/book` | multipart: `file` + `engineSlug`, `bookSlug` (the core-unit slug; + `bookTitle`) |
| Upload language pack | `POST /api/content/lang` | multipart: `file` (+ `icon` PNG) + `engineSlug`, `langCode` (+ `bookSlug`; + `displayName` etc. for new languages) |
| List inventory | `GET /api/inventory` | |
| Promote | `POST /api/content/:id/promote` | staff-only |
| Manifest check | `GET /api/manifest?channel=development\|production` | no auth required |

Uploads are capped at **200 MB per file**. The web admin UI at
`https://<server>/admin` offers the same operations interactively (upload
forms, hierarchical engine → (core →) lang inventory tree, in-browser
game preview, and promote buttons) — promotion in all interfaces is restricted
to Curious Learning staff.

---

## Appendix A — Quick-reference: hand this to your build engineer

1. Build a **standalone target**: bundler publicPath `./`, analytics/flags/Sentry stubbed out at build time, no SW registration, no `.map` files.
2. Use the `loadBinary()` XHR loader for all local binaries on `file://`; never fetch or Cache-API local assets; `Promise.allSettled` for preloads.
3. If using Rive: bundle both WASMs; force `rive_fallback.wasm` on `file:`.
4. Read `cr_lang` (and `cr_book`, `cr_user_id`) from `window.location.search`.
5. Per-language audio under `lang/<code>/audios/`; MP3/WAV; relative paths only, including inside JSON data.
6. Package by tier — engine / (optional, language-agnostic) core / lang: `<engine>-core.zip` (the engine tier, `index.html` at root, no `lang/`) + one `<engine>-lang-<code>.zip` per language (only `lang/<code>/…`). Layout B adds the core tier: `<engine>-book-<slug>.zip` and `-book-<slug>-lang-<code>.zip`.
7. Icons: true PNG, square, one per tile, uploaded alongside the language pack (not inside the ZIP).
8. Instrument the `cr_event` bridge (§6): fresh UUID v4 per payload, 64 KB cap, fire-and-forget, no-op outside the container, no network I/O for reporting.
9. Verify offline in Chrome from `file://` with the network set to Offline before submitting.
10. Upload via MCP (`/mcp`, Bearer key): `upload_core_game` → `upload_language_pack` (×N) → `list_inventory` → `promote_content`. REST/admin UI available as alternatives; core-tier ZIPs (Layout B) go via REST/admin.

---

*Changelog:*
- *1.1 — 2026-07-08 — Replit Agent — Adopted the logical tier nomenclature throughout: **engine** (main game engine, top tier), **core** (optional language-agnostic content tier, e.g. books), **lang** (per-language packs); documented that the frozen physical identifiers (`-core`/`-book-` filename tokens, `cr_book`/`bookSlug` wire names) intentionally differ from the tier names.*
- *1.0 — 2026-07-08 — Replit Agent — Initial external handoff spec, consolidated from the internal compatibility spec (v1.4), data-collection spec (v1.0), offline/manifest architecture notes, and verified against the CMS server implementation (MCP tools, upload routes, ZIP naming, manifest pipeline).*
