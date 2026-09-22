# Word Smash — Architecture Decisions

## English audio refresh (September 2026) — shared unit clips

- New English recordings from the content team replace the ElevenLabs set. They
  arrived in a Drive folder with flat names — `<word>.mp3` for whole words and
  `<unit>.mp3` for phonemes/syllables — 63 source clips in all.
- **Unit clips are shared per unit, not per word.** `unitAudioNames()` is gone;
  `wordAudio()` in `scripts/build-content.mjs` derives `audios/<unit>.mp3` for
  every unit. The content team's call: each unit in the pack makes the same sound
  in every word that uses it, so one recording per unit is correct and the
  per-word duplicates (`cat_c`, `clap_c`, `cactus_c1`, `cactus_c2`, `pencil_c`)
  were redundant. A unit that repeats inside a word references the same clip
  twice. This supersedes the M3 note below about spelling vowels per word
  context.
- **Slow clips are copies of the natural clips for now.** Slowed takes will be
  recorded later; the two files stay separate so that swap is a drop-in with no
  schema or code change.
- The pack is now **87 files** (24 words × slow + natural = 48, plus 39 unit
  clips: 27 phonemes and 12 syllables), down from 144.
- All clips were normalised at import to mono, 44.1 kHz, 64 kbps MP3 with
  metadata stripped — the delivered word clips carried tens of KB of ID3 padding
  each, and four unit clips were 48 kHz. `oo` arrived as `oo.wav` but held MP3
  data; it was re-encoded to `oo.mp3` like everything else.
- The import was a one-off (`curl` from Drive, `ffmpeg`, copy). No script was
  kept: `pnpm content:build` already reports exactly which files a drop must
  contain, which is the checklist for the next delivery.

## Container packaging + cr_event compliance (July 2026)

Prepared Word Smash for upload to the Curious Reader container per the
third-party game developer spec (v1.1). This is a **Layout A (2-tier)** title:
engine + language only, **no core level** (`hasCoreLevel: false`).

- **`cr_event` contract (spec §6.2).** `src/game/events.ts` posts every message
  as the string `{ "type": "cr_event", "payload": { … } }`. The payload carries
  exactly the required top-level fields: `payload_id` (fresh UUID v4 per
  payload), `cr_user_id` (from the launch URL, `""` if absent), `sub_app_id`
  (`wordsmash`), `payload_version: 1`, `collection`
  (`user_sessions_data` | `summary_data`), `timestamp`
  (`new Date().toISOString()`), `data`, and `options` (summary_data only —
  omitted for user_sessions_data). Fire-and-forget, exception-safe, silent
  no-op when `window.ReactNativeWebView?.postMessage` is absent. The bridge is
  intentionally shipped in the standalone build (spec §6.5 — do NOT stub it; it
  makes no network calls and is the only offline-capable reporting path).
- **ZIP packaging (spec §5).** `scripts/package-container.mjs` (run via
  `pnpm --filter @workspace/word-smash run package:container`) rebuilds the
  standalone bundle and emits two ZIPs into `dist/container/`:
  - `wordsmash-eng.zip` — engine tier. `index.html` at the ZIP root, JS/CSS,
    `assets/`, `fonts/`, `favicon.svg`; **no `lang/`**, no `*.map`, and non-game
    web files (`opengraph.jpg`, `robots.txt`) excluded. Built from a clean
    staging tree for deterministic exclusions.
  - `wordsmash-lang-<code>.zip` — language tier. **Only** `lang/<code>/`
    (`wordsmash.json` + every `audios/*.mp3`). The `--lang` code is a
    parameter so future packs reuse the same script; the script never emits a
    core-tier ZIP.
- **Engine token override.** The spec's frozen engine filename token is
  `-core`, but this project deliberately ships the engine ZIP as
  `wordsmash-eng.zip`. **The Curious Learning CMS pipeline must be configured to
  classify the `-eng` token as the engine tier for this game.**
- **Built-in integrity checks.** After zipping, the script asserts: engine ZIP
  has `index.html` at root and no `lang/`/excluded files; language ZIP contains
  only `lang/<code>/…`; the language ZIP's audio count matches the source; and
  `wordsmash.json` is present. The two ZIPs merge into one directory with no
  overwrites (disjoint subtrees: engine at root, language under `lang/<code>/`).
- **Already-compliant items (spec §7a) verified:** relative paths only (no
  `src="/"`, no `url(/…)`), no `.map` files shipped, no absolute/CDN URLs in the
  language JSON, no feature-flag/GTM/Sentry/analytics SDKs in the bundle, all
  assets loaded via `loadBinary()` XHR, self-hosted WOFF2 font, localStorage
  persistence. The tile icon is uploaded alongside the language pack (NOT packed
  in the ZIP) and is handled at upload time, not here.

## M3 scope (July 2026) — real recorded audio

- Real MP3s now ship at `public/lang/english/audios/` (144 files: 24 words ×
  slow+natural, plus per-word phoneme/syllable unit clips). Generated with
  ElevenLabs TTS (voice "Jessica", `eleven_multilingual_v2`); slow word takes
  use `voice_settings.speed 0.72`, natural/units use `1.0`.
- **Phoneme SOUNDS, never letter NAMES** is enforced at the source: unit clips
  are synthesised from phonetic spellings (e.g. `b`→"buh", `s`→"sssss",
  `ee`→"eee"), never a bare letter, so the engine can never utter a letter name.
  Vowels/ambiguous letters are spelled per word context (baby `a`→"ay" long-a,
  cat `a`→"ah" short-a, pencil `c`→"sssss" /s/, zebra `e`→"eee" long-e, etc.).
- The audio engine already preferred MP3s and fell back to Web Speech TTS only
  when a file was missing/undecodable — so shipping the files switches playback
  to real audio automatically. TTS is now a safety net, not the default.
- **Path-resolution fix:** language-pack audio paths are stored relative to the
  pack dir (`audios/…`). `resolveAudioPaths()` in `App.tsx` prefixes them with
  `./lang/{lang}/` at load so the loadBinary XHR resolves them in dev (base path)
  and in the offline bundle (base `./`). Without this the XHR hit the SPA
  fallback (index.html, HTTP 200) → decode fail → silent TTS fallback. This bug
  was latent in M1/M2 because no real MP3s existed to exercise the path.
- Standalone offline bundle copies all 144 MP3s via Vite's default `public/`
  copy; verified present in `dist/standalone/lang/english/audios/`.

## M2 scope (July 2026)

- **Phoneme SOUNDS, never letter NAMES** — audio for a unit must say the sound the
  letter makes in the word (/b/ = "buh"), NEVER the letter name ("bee"). The TTS
  fallback now maps units through a phoneme-approximation table (`PHONEME_TTS` in
  `src/game/audio.ts`). Any future recorded MP3s (ElevenLabs or voice talent) MUST
  follow the same rule — record isolated phoneme sounds, not letter names.
- Fixed level indicator: `currentLevel` is now updated on every `START_WORD`
  dispatch from the word's level data (previously only set at initial LOAD).
- Self-hosted `Fredoka` SemiBold 600 WOFF2 at `public/fonts/fredoka-600.woff2`,
  loaded via XHR + FontFace ArrayBuffer (`src/game/fonts.ts`) — no Google Fonts
  CDN dependency remains. (§2 mandates SemiBold 600, not Fredoka One.)
- `vite.standalone.config.ts` with `base: './'` builds the offline APK bundle to
  `dist/standalone/` (`pnpm --filter @workspace/word-smash run build:standalone`).
  All asset URLs are relative; fonts + language pack are copied into the bundle.
- Levels 5–10 were already defined in the language pack and are playable.

## M1 scope (July 2026)

English levels 1–4 playable with all core mechanics:
- Ghost-letter and no-ghost levels (1–4 from GDD)
- Hammer-smash → scatter → drag-to-rebuild loop
- localStorage persistence (progress, plaques, hammer stage)
- Web Speech API audio fallback (ElevenLabs deferred to M2)
- Hand-icon tutorial (first hammer use, first drag use)
- cr_event postMessage bridge (silent no-op outside WebView)

---

## Audio system: loadBinary XHR + TTS fallback

Per the container spec §2.3, ALL local binaries (including audio and JSON) must be
loaded via XHR, not `<audio>`, `fetch()`, or `<script src>` — the `file://` protocol
on Curious Reader's offline WebView blocks those APIs.

For M1 there are no real MP3 files shipped. The audio module tries to decode each
MP3 via XHR; if the XHR returns a non-200/0 status or decodeAudioData fails, it
falls back to `speechSynthesis.speak()`. In production (M2+), replace with real
ElevenLabs-generated MP3s placed at `public/lang/english/audios/`.

Silent 1-frame AudioBuffer fallback prevents any thrown exceptions when audio is
unavailable.

Foley sounds (smash, snap, kick, celebrate, hammerEvolve) are synthesised entirely
via Web Audio oscillators and noise buffers — no external files needed.

---

## JSON loading via XHR

`wordsmash.json` is loaded by `loadJSON()` using XHR with `responseType: 'text'` and
`JSON.parse()`. This mirrors the loadBinary pattern and works on `file://` as well as
HTTP dev servers (status 0 on file://, 200 on HTTP both treated as success).

The file lives in `public/lang/{lang}/wordsmash.json` so Vite copies it to the build
output unchanged.

---

## Coordinate system: CSS absolute pixels

Pieces and slots use absolute pixel positions relative to the game container. All
positions are recomputed from `containerRef.clientWidth/Height` at the moment they
are needed. This avoids stale layout values on resize/orientation change.

Piece physics scatter positions are computed by `computeScatterPositions()` in
`src/game/physics.ts` using a seeded LCG so scatter is deterministic per word attempt
(seed varies per smash using Math.random).

---

## Game state: single useReducer in GameScene

All game state (phase, pieces, slots, plaques, completions, hammer) lives in a single
`useReducer` in `GameScene.tsx`. Side effects (audio playback, localStorage writes,
cr_event bridge) are called imperatively inside event handlers, not inside the reducer
or useEffect, keeping the reducer pure.

---

## Offline / standalone build

For dev on Replit, the standard `vite.config.ts` reads `PORT` and `BASE_PATH` env
vars set by the workflow runner.

For the offline APK bundle (Curious Reader container), a separate
`vite.standalone.config.ts` with `base: './'` is planned for M2. The production
build must use relative paths so all assets resolve from `file://` without a server.

---

## cr_event bridge

`src/game/events.ts` wraps `window.ReactNativeWebView?.postMessage()`. When running
outside the Curious Reader WebView (browser, dev), the guard is a no-op — no errors
are thrown. Event envelopes match the CR container spec v1.1 schema.

---

## Language packs

Each language lives in `public/lang/{langCode}/wordsmash.json`. The active language
is set via the `cr_lang` query param (defaults to `english`). Levels 1–10 are all
defined in the English pack; M1 focuses on levels 1–4 (ghost + no-ghost pairs for
2-phoneme digraph words and CVC words).

---

## Hammer evolution

The hammer SVG is rendered inline and recoloured based on `hammerStage` (0–3). Stage
advances every 3 levels (0: Starter brown, 1: Iron green, 2: Cobalt blue, 3: Royal
purple). Stage is persisted in localStorage so it survives session reloads.

---

## Font loading

`Fredoka One` is loaded via Google Fonts `@import` at dev time. For M2 offline, it
must be bundled as a self-hosted WOFF2 loaded via `FontFace` from an ArrayBuffer
(same loadBinary XHR pattern) — Google Fonts CDN is unavailable offline.

---

## Redesign — "Honey & Paint" (2026-07)

Full visual + interaction redesign to the approved design contract in
`attached_assets/word_smash_design/handoff/DESIGN-SPEC.md`. No text, emoji, or
mascot appears in gameplay (the old "Level N" indicator was removed).

### Reference-canvas architecture

All geometry is authored in a fixed **1200×540 reference canvas** (`STAGE_W`/
`STAGE_H` in `src/game/design.ts`). The `.ws-stage` element is COVER-scaled
(`--ws-scale = max(vw/1200, vh/540)`), so 16:9 devices crop exactly to the 16:9
safe area (120px side margins). Pointer coordinates are converted back to
reference space via `screenToStage()` in `src/game/coords.ts`. Every component
takes `stageRef` for this conversion. This replaced the old percentage/flex
layout so the art director's pixel geometry maps 1:1.

### Phases

`loading → present → windup → rebuild → complete → levelComplete`. State lives in
a single `useReducer` in `GameScene.tsx`; multi-step animation sequencing (smash
scatter, word-complete fuse/hop/flight-to-wall, level transition) is driven
imperatively via `setTimeout` in handlers, never in the reducer.

### Plaque identity

Wall plaques carry a stable `plaqueId` (not `wordId`) because a word can recur
across levels (ghost vs no-ghost), so the same `wordId` can legitimately appear
on the wall more than once. All wall drag/replay/reorder/play-count operations
target `plaqueId`. Old localStorage plaques are migrated with a synthesised id.

### Hammer evolution (updated)

Now 10 stages (`HAMMER_STAGES` recipes), advancing per level via
`hammerStageForLevel()`. Wall plaque finish upgrades by replay count
(1×red / 2×teal / 3×gold / 4+×gold-face) via `finishForPlayCount()`.

### Font loading (updated)

`Fredoka` is loaded offline via `FontFace` from an ArrayBuffer using the
`loadBinary()` XHR pattern (`src/game/fonts.ts`), from
`${BASE_URL}fonts/fredoka-600.woff2`. Per the DESIGN-SPEC (§2), the game face is
Fredoka **SemiBold 600** (not the heavier Fredoka One). The bundled
`fredoka-600.woff2` covers the Latin range (U+0000–00FF), which is all the game's
letter tiles need; all tile/plaque letters render at `font-weight: 600`.
