# DEVSPEC — Word Smash

| | |
|---|---|
| **Title** | Word Smash — Development Specification |
| **Status** | Active |
| **Version** | 1.0.0 |
| **Last updated** | 2026-07-13 |
| **Owner/Author** | Tinsley Galyean (with Replit Agent) |

> This DEVSPEC is the **source of truth for behavior**. It realizes the product
> intent defined in the PRD. The UISPEC references this document for behavior;
> the TESTSPEC verifies this document. Where a numeric constant appears here, it
> is authoritative and must match the code and the other specs.

**Reference chain:** PRD → **DEVSPEC** → UISPEC → TESTSPEC.

---

# Part I — Functional Requirements

## I.0 Overview

Word Smash is a single-page, client-only React application that plays entirely
offline from `file://` inside the Curious Reader WebView. There is no backend.
All content is a bundled **language pack** (JSON + MP3 audio); all state is stored
in `localStorage`. Gameplay is organized as a state machine with six phases:

```
loading → present → windup → rebuild → complete → levelComplete
                        │                              │
                        └── (release early) ───────────┘  (→ next word or level)
```

- **loading** — load language pack, font, and restore progress.
- **present** — the whole word is seated on the bench; child may listen or smash.
- **windup** — child holds the hammer through a takeover swing (cancellable).
- **rebuild** — the word is scattered into tiles; drag them back to the slots.
- **complete** — the finished word fuses, hops, and flies to the wall.
- **levelComplete** — three-beat celebration with hammer upgrade, then next level.

There are **10 levels** in the English pack. Levels alternate **ghost** (odd:
1,3,5,7,9) and **no-ghost** (even: 2,4,6,8,10) presentations of the same word
groups (see §I.1). Each level contains **6 words**.

## I.1 Data schema

### I.1.1 Language pack (`public/lang/<code>/wordsmash.json`)

The authoritative content file. Shape (see `src/game/types.ts`):

```jsonc
{
  "langCode": "english",
  "levels": [
    {
      "level": 1,             // 1..10
      "ghost": true,          // ghost vs no-ghost presentation (see UISPEC §4)
      "words": [
        {
          "id": "sea",         // stable per-word id (recurs across levels)
          "display": "sea",    // the glyphs rendered on the plaque
          "units": ["s", "ea"],// smash breakpoints; each unit is one tile
          "audio": {
            "slow":    "audios/sea_slow.mp3",     // whole word, slowed
            "natural": "audios/sea_natural.mp3",  // whole word, natural pace
            "units":   ["audios/sea_s.mp3", "audios/sea_ea.mp3"] // per-unit, in order
          }
        }
      ]
    }
  ]
}
```

Rules:
- `units.length === audio.units.length`; the order of `units` is the left-to-right
  order of tiles on the plaque and the slot order after smashing.
- A **unit** may be a single letter (`"s"`), a digraph (`"ea"`, `"oo"`, `"gg"`),
  or a syllable (`"cac"`, `"mon"`). Multi-glyph units fly and seat as one rigid
  tile — the breakpoints are the reveal, and they must never be hinted before the
  smash.
- **A word may recur across levels** with the same `id` but different `units`
  (e.g. `cactus` is `["cac","tus"]` at L7/L8 but `["c","a","c","t","u","s"]` at
  L9/L10). One wall plaque represents the word at its highest level reached.
- Audio paths are stored **relative to the pack dir** (`audios/…`) and are
  rewritten to `./lang/<code>/audios/…` at load time so the XHR loader resolves
  them in both dev and the offline bundle.
- **Sounds, never letter names.** Every unit clip speaks the sound the unit makes
  *in that word* (context-dependent: `a`→"ay" in *baby*, `a`→"ah" in *cat*). This
  is a hard content rule enforced at audio-generation time.

The current English pack: **10 levels × 6 words**, **24 distinct words**, backed
by **144 MP3 files**.

### I.1.2 `localStorage` schema

Namespaced per language: keys are `ws_<lang>_<suffix>` (see `src/game/storage.ts`).

- `ws_<lang>_progress` → `Progress`:
  ```ts
  interface Progress {
    currentLevel: number;                      // 1..10
    completions: Record<string, WordCompletion>; // keyed `${wordId}_L${level}`
    hammerStage: number;                       // 0..9
    plaques: PlaqueState[];                    // wall plaques (ONE per wordId)
    tutorial: { hammerDone: boolean };         // true after first COMPLETED smash
  }
  ```
- `ws_<lang>_queue_<level>` → `string[]` — the shuffled word-id order for the
  level in progress, so a mid-level reload resumes the same sequence.

`WordCompletion` and `PlaqueState` (see `types.ts`):
- `WordCompletion`: `{ wordId, ghostDone, noGhostDone, highestLevel, display, units, playCount }`.
- `PlaqueState`: `{ plaqueId, wordId, display, units, x, y, zOrder, playCount, highestLevel, levelsPlayed }`.
  - `plaqueId` is a **stable per-instance id**, distinct from `wordId` — there is
    exactly ONE plaque per `wordId`; all wall operations target `plaqueId`.
  - `playCount` is cumulative (ghost + no-ghost + replays); drives nothing visual
    directly.
  - `levelsPlayed` = distinct levels completed for the word; **drives the plaque
    finish** (replays do NOT advance it).
  - `highestLevel` = highest level ever reached for the word; drives the level a
    wall replay runs at.

**Migration:** older saves may hold multiple plaques per word, or predate the
`highestLevel`/`playCount`/`levelsPlayed` fields. On load, plaques are
de-duplicated to one-per-word and reconciled against the authoritative
`completions` record (never defaulted blindly). See §I.5.

### I.1.3 `cr_event` message contract (container reporting)

All analytics are posted over the WebView bridge (see `src/game/events.ts`) as a
single JSON string:

```jsonc
{ "type": "cr_event", "payload": { /* envelope */ } }
```

Envelope top-level fields (container spec §6.2), exactly:
`payload_id` (fresh UUID v4 per payload), `cr_user_id` (from launch URL, `""` if
absent), `sub_app_id` (`"wordsmash"`), `payload_version` (`1`), `collection`
(`"user_sessions_data"` | `"summary_data"`), `timestamp` (`new Date().toISOString()`),
`data`, and — **for `summary_data` only** — `options` (per-field `"add"`/`"replace"`
merge directives; omitted entirely for `user_sessions_data`).

`user_sessions_data` events (each stamps `type` snake_case + `lang`):
- `session_start` → `{ current_level }`
- `word_completed` → `{ level, word_id, ghost, replay, score, max_score, duration_seconds, errors, hints_used, smash_count }`
- `level_completed` → `{ level, ghost, duration_seconds }`

`summary_data` event (rolled-up, with merge `options`):
- `{ levels_played (add), words_completed (add), total_time_played (add), last_level_number (replace) }`

Reporting is **fire-and-forget, exception-safe, performs no network I/O, and is a
silent no-op** when `window.ReactNativeWebView?.postMessage` is absent (plain
browser / dev). It is intentionally shipped in the offline build (it is the only
offline-capable reporting path and makes no network calls).

## I.2 Module — Game engine / state reducer

- **Goal:** Drive the whole gameplay lifecycle from one deterministic, pure
  reducer, with all side effects (audio, storage, event bridge, animation
  sequencing) invoked imperatively in handlers — never inside the reducer.
- **Tasks:**
  - Single `useReducer` in `GameScene.tsx` holding `phase`, `currentLevel`,
    `currentWord`, `wordQueue`, `pieces`, `slots`, `plaques`, `hammerStage`,
    `hint`, `tutorial`, and per-word counters (`wordErrors`, `wordHints`,
    `wordSmashes`).
  - Implement the phase transitions of §I.0 via typed actions (e.g. `LOAD`,
    `START_WORD`, `WINDUP`, `WINDUP_CANCEL`, `SCATTER`, `PLACE`, `MOVE`, `SETTLE`,
    `COMPLETE`, `SET_PLAQUES`, `SET_COMPLETION`, `LEVEL_TRANSITION`,
    `END_TRANSITION`, `SET_HINT`, and the counter increments).
  - Shuffle each level's 6 words into a persisted queue; on level start restore
    the queue if present.
  - Keep the reducer pure and idempotent: multi-step animations (smash scatter,
    word-complete fuse/hop/flight, 3-beat level transition) are sequenced with
    `setTimeout` in handlers, then committed via actions.
- **Exit criterion:** From a cold load, a child can complete all 6 words of a
  level and advance to the next level; state after each word matches the schema in
  §I.1.2; the reducer contains no audio/DOM/storage calls.

## I.3 Module — Audio system

- **Goal:** Play recorded speech and synthesized foley entirely offline, always
  speaking phoneme **sounds** (never letter names), with a graceful fallback.
- **Tasks:**
  - Load every MP3 via **XHR → `decodeAudioData`** into a cached `AudioBuffer`
    (`src/game/audio.ts`); play through a single Web Audio graph.
  - Provide `playWordSlow`, `playWordNatural`, `playUnit` (unit audio does not
    interrupt the current playback), plus `preloadLevel` to warm the level's clips.
  - **Fallback:** if a clip is missing/undecodable, fall back to
    `speechSynthesis.speak()` — and for units, map through a phoneme-approximation
    table so the fallback still says the sound, never the letter name. A silent
    1-frame buffer prevents thrown exceptions when audio is unavailable.
  - **Foley** (`playFoley`): synthesize `thunk`, `snap`, `kick`, `chime`,
    `whoosh`, `confetti`, `fanfare`, `cymbal`, `woodTap`, `celebrate`,
    `hammerEvolve` via Web Audio oscillators/noise — no files needed.
  - **Crash pool** (`playCrash`): a short synthesized smash drawn from ≥5 variants,
    never the same one twice in a row. (Recorded crash MP3s may replace the synth
    later; the no-immediate-repeat rule stays.)
- **Exit criterion:** In the shipped container, tapping a word plays the recorded
  slow clip; every unit plays its recorded in-word sound; no path ever utters a
  letter name; removing all MP3s degrades to the TTS fallback with no exceptions.

## I.4 Module — Physics / scatter

- **Goal:** Turn a smashed word into tiles that launch, tumble, bounce once, and
  settle inside the safe area — deterministically per attempt.
- **Tasks:**
  - `computeScatterPositions()` (`src/game/physics.ts`) uses a seeded LCG so a
    given attempt is reproducible; the seed varies per smash so scatters differ.
  - Launch tiles on arcs with tumble, gravity, and a single floor bounce
    (restitution ≈ −0.3); clamp final rotation to ±20°.
  - Never drop a tile outside the 16:9 safe area or under the hammer dock
    (positions are clamped to a scatter box inset from the container edges).
  - A drop is accepted when the tile lands within **`SNAP = 80`** reference px of
    the nearest empty slot's center (`onDrop` in `GameScene.tsx`); the tile then
    seats if its unit matches that slot, else it bounces back. (A helper
    `isNearSlot(px, py, sx, sy, threshold = 70)` exists in `physics.ts` but the
    live placement path uses the `SNAP = 80` check.)
- **Exit criterion:** After any smash, all tiles rest visibly on the bench within
  the safe area; re-smashing re-scatters every tile (including seated ones); a
  repeated seed yields identical positions.

## I.5 Module — Storage / persistence

- **Goal:** Persist and faithfully restore all progress on-device, tolerating and
  migrating legacy save shapes.
- **Tasks:**
  - `getProgress`/`saveProgress`/`resetProgress` and the per-level word-queue
    helpers, all namespaced `ws_<lang>_…` and wrapped in try/catch (never throw).
  - On load, **de-dupe plaques to one-per-`wordId`**, keeping the most-recently
    touched position/z-order, and reconcile `playCount`/`highestLevel`/
    `levelsPlayed` against the authoritative `completions` record (each completion
    key encodes its level as `_L<n>`), never defaulting blindly to 1.
  - Write points: after each word completion (completion + plaque updates), on
    plaque wall moves/reorders, on hammer-stage change (level transition beat 2),
    and on level index change.
- **Exit criterion:** Killing and reopening the app restores the exact level,
  wall layout/z-order, hammer stage, plaque finishes, and tutorial flag; a legacy
  multi-plaque save collapses to correct one-per-word plaques at the right levels.

## I.6 Module — Event bridge (`cr_event`)

- **Goal:** Emit the container analytics of §I.1.3 without ever affecting
  gameplay.
- **Tasks:**
  - `initEvents(userId, lang)` once at startup; then `emitSessionStart`,
    `emitWordCompleted`, `emitLevelCompleted`, `emitSummary` at the moments below.
  - Build a spec-exact envelope with a fresh UUID v4 per payload; include `options`
    only for `summary_data`.
  - Guard on `window.ReactNativeWebView?.postMessage`; wrap in try/catch.
- **Emit moments:** `session_start` at successful pack load; `word_completed` when
  a word's plaque lands on the wall; `level_completed` at the start of the level
  transition; `summary_data` rolled up at level transition.
- **Exit criterion:** In the container, each envelope validates against §I.1.3;
  outside the container nothing is posted and nothing throws.

## I.7 Module — Packaging pipeline

- **Goal:** Produce the exact upload artifacts the Curious Reader CMS expects for
  a **Layout A (2-tier)** title (engine + one language, **no core level**).
- **Tasks:**
  - `build:standalone` (`vite.standalone.config.ts`, `base: './'`) emits a
    fully-relative offline bundle to `dist/standalone/`.
  - `package:container` (`scripts/package-container.mjs`) rebuilds the standalone
    bundle and emits two ZIPs into `dist/container/`:
    - `wordsmash-eng.zip` — engine tier: `index.html` at ZIP root, JS/CSS,
      `assets/`, `fonts/`, `favicon`; **no `lang/`**, no `*.map`, and non-game web
      files (`opengraph.jpg`, `robots.txt`) excluded. Built from a clean staging
      tree for deterministic exclusions.
    - `wordsmash-lang-<code>.zip` — language tier: **only** `lang/<code>/`
      (`wordsmash.json` + every `audios/*.mp3`). `--lang` is a parameter.
  - Run built-in integrity checks (see §I.7 exit criterion) and fail loudly on any
    violation.
  - Upload flow (`scripts/src/upload-wordsmash.ts`) drives the CMS MCP tools in
    order: `list_inventory` → `upload_core_game` (engine, `hasCoreLevel:false`) →
    `upload_language_pack` (language + tile icon as `iconBase64`) → `list_inventory`.
    Dry-runs unless `CR_CMS_SERVER_URL` + `CR_MCP_API_KEY` are set.
- **Engine token override:** the spec's frozen engine token is `-core`; this
  project ships the engine ZIP as `wordsmash-eng.zip`, and the CL CMS pipeline
  must be configured to classify the `-eng` token as the engine tier.
- **Exit criterion:** `package:container` asserts and passes: engine ZIP has
  `index.html` at root and no `lang/`/`.map`/excluded files; language ZIP contains
  only `lang/<code>/…`; the language ZIP's MP3 count equals the source count; and
  `wordsmash.json` is present. The two ZIPs merge into one directory with no
  overwrites.

---

# Part II — Non-Functional Requirements

## II.1 Offline `file://` constraints (hard)

- **No `fetch()`, no `<audio>`, no CDN `<script>`/`<link>`/`@import`.** The offline
  WebView blocks them. **All** external assets (audio, JSON, fonts) load via
  **XHR `loadBinary`** (`responseType: 'arraybuffer'`, or `'text'` for JSON).
- `file://` XHR returns **status 0 on success** (not 200); loaders treat both
  `200` and `0` as success.
- **Relative paths only** in the shipped bundle — no `src="/"`, no `url(/…)`, no
  absolute or CDN URLs anywhere (including the language JSON). The standalone
  build uses `base: './'`.
- **Self-hosted font.** The game face (see UISPEC §2) is bundled as a local WOFF2
  and applied via `FontFace` from an ArrayBuffer loaded with the same XHR pattern;
  system fonts are the CSS fallback if it fails.
- **No feature-flag/analytics/error-monitoring SDKs** in the bundle. The only
  reporting is the `cr_event` bridge, which makes no network calls.

## II.2 Performance / target device

- **30fps floor on 1GB-RAM Android WebViews.**
- Prefer `transform`/`opacity` animations; no filters on animated nodes; the
  wind-up scale is a single transform on one node.
- **Particle budgets:** smash chips ≤ 12, confetti ≤ 14, sparkles ≤ 6, trail ≤ 4.
- Warm a level's audio via `preloadLevel` so the first tap is not gated on decode.

## II.3 Error handling

- Every storage and reporting call is wrapped so it can never break gameplay.
- Missing/undecodable audio degrades to the phoneme-accurate TTS fallback, then to
  a silent buffer — never an exception.
- Font-load failure falls back to the CSS system-font stack.
- The reducer never throws on malformed persisted state; loaders default safely.

## II.4 Constraints

- **No text, emoji, or mascot in gameplay** (product rule; also removes all
  runtime localization of UI copy).
- **Sounds, never letter names** — enforced in both recorded audio and the TTS
  fallback map.
- **No fail state** — wrong drops bounce back; no buzzer, penalty, or game-over.
- Client-only; no backend, accounts, or network features.

## II.5 Risks & mitigations

| Risk | Mitigation |
|---|---|
| Audio silently falls back to TTS in the container (wrong/robotic voice) | Ship recorded MP3s; `resolveAudioPaths()` fixes relative resolution; TESTSPEC checks the recorded path is hit, not the fallback. |
| A letter *name* is spoken | Generate unit clips from phonetic spellings; fallback maps units through a phoneme table; content review + tests forbid names. |
| Relative-path breakage between dev and `file://` | Single `resolveAudioPaths()` + `base:'./'` standalone build; packaging integrity checks. |
| Engine-token `-eng` vs frozen `-core` mismatch at the CMS | Documented override; CL CMS must be configured to map `-eng`→engine; recorded in DECISIONS + UPLOAD guide. |
| Low-end device jank | Particle budgets, transform/opacity-only animation, single-node wind-up transform, 30fps floor. |
| Legacy save corruption after schema changes | De-dupe + reconcile-against-completions migration; all loads default safely. |

---

# Part III — Implementation Guide

## III.1 Directory structure & artifact-lifecycle classification

Lifecycle legend: **versioned** = source of truth in git; **ephemeral** = build
output, regenerable, gitignored; **durable** = on-device runtime state.

```
docs/specs/                                  versioned  — these four specs + README
artifacts/word-smash/                        versioned  — the game
  src/game/        types|audio|storage|events|physics|design|coords|fonts  versioned
  src/components/  React game components (GameScene, Hammer, Wall, …)       versioned
  public/lang/<code>/wordsmash.json          versioned  — authoritative content
  public/lang/<code>/audios/*.mp3            versioned  — recorded speech (144 en)
  public/fonts/fredoka-600.woff2             versioned  — bundled game font
  upload/wordsmash-icon-512.png              versioned  — tile icon (uploaded, never zipped)
  vite.config.ts / vite.standalone.config.ts versioned  — dev / offline builds
  scripts/package-container.mjs              versioned  — ZIP packager
  DECISIONS.md / UPLOAD.md                    versioned  — architecture + upload guide
  dist/standalone/                           ephemeral  — offline bundle
  dist/container/*.zip                        ephemeral  — upload ZIPs
  *.tsbuildinfo                              ephemeral  — TS incremental cache
scripts/src/upload-wordsmash.ts              versioned  — CMS MCP uploader
localStorage ws_<lang>_*                     durable    — on-device progress
```

## III.2 Tech stack & rationale

- **pnpm workspaces, Node 24, TypeScript 5.9 (strict).** Monorepo; the game is a
  leaf artifact typechecked with `tsc --noEmit`.
- **React 19 + Vite** — fast client SPA; two Vite configs (dev reads `PORT`/
  `BASE_PATH` from the workflow; standalone uses `base:'./'` for `file://`).
- **No game backend** — the offline constraint and the no-accounts product rule
  make a server unnecessary; state is `localStorage`.
- **Web Audio API + Web Speech API** — Web Audio for recorded clips and
  synthesized foley (works from `file://`); Web Speech only as the offline-safe
  phoneme fallback.
- **`FontFace` from ArrayBuffer** — the only way to load a self-hosted font under
  the `file://` no-CDN constraint.

## III.3 Environment / config

- **Dev:** the workflow injects `PORT` and `BASE_PATH`; the game runs at preview
  path `/` (port 23518). Do not run `pnpm dev` at the workspace root.
- **Language:** selected via the `cr_lang` query param (defaults to `english`).
- **User id:** read from the launch URL for `cr_user_id`; `""` if absent.
- **Upload secrets (optional):** `CR_CMS_SERVER_URL`, `CR_MCP_API_KEY`, and
  optional `CR_URL_TEMPLATE`; absent ⇒ the uploader dry-runs.

## III.4 Clean-machine runbook

```bash
# 0. Install deps (workspace root)
pnpm install

# 1. Typecheck everything (run from root; leaf checks need fresh lib decls)
pnpm run typecheck

# 2. Run the game in dev (preview at /)
pnpm --filter @workspace/word-smash run dev

# 3. Build the offline bundle + upload ZIPs (Layout A: engine + language)
pnpm --filter @workspace/word-smash run package:container -- --lang english
#   → dist/container/wordsmash-eng.zip  +  wordsmash-lang-english.zip

# 4. Dry-run the CMS upload (no creds needed; prints the exact plan)
pnpm --filter @workspace/scripts run upload:wordsmash -- --lang english --dry-run

# 5. Live upload (requires CR_CMS_SERVER_URL + CR_MCP_API_KEY secrets)
pnpm --filter @workspace/scripts run upload:wordsmash -- --lang english
```

## III.5 Deliverables per milestone

- **M1:** Playable levels 1–4; smash→scatter→rebuild loop; plaque wall; hammer
  evolution; `localStorage` persistence; tutorial hand; `cr_event` bridge (no-op
  outside container). Speech via TTS fallback (no recorded audio yet).
- **M2:** Phoneme-accurate speech + phoneme fallback map; level-indicator fix;
  self-hosted WOFF2 via `FontFace`; `vite.standalone.config.ts` +
  `build:standalone`; levels 5–10 playable.
- **Honey & Paint:** Reference-canvas architecture; full phase lifecycle; 10-stage
  hammer; plaque wall drag-to-replay + play-count finishes; no text/emoji/mascot.
- **M3:** 144 recorded MP3s (word slow/natural + per-unit), generated so a letter
  name can never be spoken; recorded audio is the default; `resolveAudioPaths()`
  fixes relative resolution in dev and the bundle.

---

# Part IV — Appendices

## IV.1 Open questions

| # | Question | Blocks |
|---|---|---|
| OQ-1 | Final CMS base URL + MCP API key from Curious Learning | Live upload / go-live |
| OQ-2 | CL sign-off that the CMS classifies `-eng` as the engine tier | Correct tier ingestion at upload |
| OQ-3 | Which additional languages to author next (content + icons + display names) | Multi-language rollout |
| OQ-4 | Whether to replace synthesized crash SFX with a recorded crash pool | Audio polish (no functional block) |
| OQ-5 | Confirm KPI/analytics field expectations against CL's pipeline | Analytics validation |

## IV.2 Resolved decisions (with rationale)

- **2026-07 — All binaries load via XHR `loadBinary`; `file://` status 0 == success.**
  The offline WebView blocks `fetch`/`<audio>`/CDN; XHR is the only reliable path.
- **2026-07 — Single `useReducer`; side effects in handlers, not the reducer.**
  Keeps state transitions pure/testable; animation sequencing via `setTimeout`.
- **2026-07 — Coordinates in a fixed 1200×540 reference canvas, cover-scaled.**
  Lets the art director's pixel geometry map 1:1 on any device; pointer events are
  converted back via `screenToStage()`.
- **2026-07 — Plaques keyed by `plaqueId`, one plaque per `wordId`.** A word recurs
  across levels, so `wordId` alone is ambiguous for wall operations.
- **2026-07 — Plaque finish advances by DISTINCT levels completed, not raw plays.**
  Replays should not inflate the finish; only new-level completions do.
- **2026-07 — Sounds, never letter names**, enforced in recorded audio *and* the
  TTS fallback map. Saying names would teach the wrong skill.
- **2026-07 — Recorded MP3s are the default; TTS is a safety net only** (M3). The
  audio engine already preferred files and fell back only on miss/decode-fail.
- **2026-07 — `resolveAudioPaths()` prefixes pack-relative paths at load.** Without
  it the XHR hit the SPA fallback (index.html, 200) → decode fail → silent TTS.
- **2026-07 — Ship the `cr_event` bridge in the standalone build.** It makes no
  network calls and is the only offline-capable reporting path (do not stub it).
- **2026-07 — Layout A (2-tier), `hasCoreLevel:false`; engine ZIP token `-eng`.**
  Deliberate override of the frozen `-core`; CL CMS must map `-eng`→engine.

## IV.3 Out of scope

See PRD §7. In brief: no game backend/accounts, no online features, no in-game
authoring UI, publishing/promotion is externally gated, non-English packs not yet
authored, no comprehension/sentence/spelling instruction.

## IV.4 Lessons log

- **Latent path bug surfaced only when real audio landed.** M1/M2 had no MP3s, so
  the relative-path resolution bug was invisible until M3; the XHR silently hit the
  SPA fallback and decode-failed into TTS. *Lesson:* exercise the real asset path
  early, even with placeholder binaries.
- **Legacy saves need reconciliation, not blind defaults.** Defaulting a legacy
  plaque's `highestLevel` to 1 ran replays at the wrong level; always cross-
  reference the authoritative `completions` record.
- **Offline `file://` XHR returns status 0.** Any new loader must treat `0` as
  success or every load fails on device while passing on the HTTP dev server.

## IV.5 Changelog

- 2026-07-13 — Replit Agent & Tinsley Galyean — Initial spec authored
