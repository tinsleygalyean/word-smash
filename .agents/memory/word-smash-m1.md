---
name: Word Smash M1 constraints
description: Critical offline/container constraints and architecture decisions for the Word Smash game
---

## Key constraints

- Game runs from `file://` in Curious Reader's offline Android/iOS WebView
- ALL asset loading must use XHR (`loadBinary()` / `loadJSON()`) — `fetch()`, `<audio>`, CDN `<script>` are blocked
- `file://` XHR returns status 0 on success (not 200) — loaders treat 0 and 200 both as success
- Google Fonts CDN (`@import` in CSS) works for dev but must be replaced with self-hosted WOFF2 via FontFace ArrayBuffer for the offline APK build

## Audio

- M1: no real MP3 files; audio module tries XHR → AudioBuffer, falls back to `speechSynthesis.speak()`
- Foley (smash, snap, kick, celebrate, hammerEvolve) synthesised via Web Audio oscillators — no files needed
- M2: place ElevenLabs MP3s at `public/lang/english/audios/` using naming convention `{word}_{slow|natural}.mp3` and `{word}_{unit}.mp3`

## Build targets

- Dev (Replit): standard `vite.config.ts` with `PORT` + `BASE_PATH` env vars
- Offline APK (M2 planned): `vite.standalone.config.ts` with `base: './'`

## cr_event bridge

- `window.ReactNativeWebView?.postMessage()` — silent no-op outside container
- All events: `session_start`, `word_completed`, `level_completed`, `summary_data`

## State management

- Single `useReducer` in `GameScene.tsx`; reducer is pure
- Side effects (audio, localStorage, cr_event) called imperatively in handlers
- Progress keyed by `ws_{lang}_progress` in localStorage

**Why:** The offline constraint is the dominant force — any pattern that works in a normal browser may silently break in the `file://` WebView.
