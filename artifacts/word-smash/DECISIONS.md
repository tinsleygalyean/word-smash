# Word Smash — Architecture Decisions

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
