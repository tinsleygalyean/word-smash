# Word Smash — Architecture Decisions

## M2 scope (July 2026)

- **Phoneme SOUNDS, never letter NAMES** — audio for a unit must say the sound the
  letter makes in the word (/b/ = "buh"), NEVER the letter name ("bee"). The TTS
  fallback now maps units through a phoneme-approximation table (`PHONEME_TTS` in
  `src/game/audio.ts`). Any future recorded MP3s (ElevenLabs or voice talent) MUST
  follow the same rule — record isolated phoneme sounds, not letter names.
- Fixed level indicator: `currentLevel` is now updated on every `START_WORD`
  dispatch from the word's level data (previously only set at initial LOAD).
- Self-hosted `Fredoka One` WOFF2 at `public/fonts/`, loaded via XHR + FontFace
  ArrayBuffer (`src/game/fonts.ts`) — no Google Fonts CDN dependency remains.
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
`${BASE_URL}fonts/fredoka-one.woff2`. The full-glyph `fredoka-one.woff2` is the
only bundled face (an earlier weight-600 subset had incomplete glyph coverage).
