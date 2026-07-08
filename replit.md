# Word Smash

An offline literacy web game for children ages 4–8 built for Curious Learning's Curious Reader container (offline-first Android/iOS WebView from `file://`). Children smash words with a hammer, scatter letter tiles, then drag them back to rebuild the word.

## Run & Operate

- `pnpm --filter @workspace/word-smash run dev` — run the game (port 23518, preview at `/`)
- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm run typecheck` — full typecheck across all packages

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Game: React 19 + Vite (react-vite artifact at `/`)
- No backend needed for the game — pure client-side with localStorage
- Audio: Web Audio API foley + Web Speech API TTS fallback (ElevenLabs MP3s deferred to M2)
- Persistence: localStorage (progress, plaques, hammer stage)

## Where things live

- `artifacts/word-smash/` — the game itself (react-vite artifact)
  - `src/game/` — core engine: types, audio, storage, events, physics
  - `src/components/` — React game components
  - `public/lang/english/wordsmash.json` — authoritative 10-level English language pack
  - `DECISIONS.md` — architecture decisions and offline constraints
- `artifacts/api-server/` — unused for M1, available for future leaderboard/analytics

## Architecture decisions

- All binaries (audio, JSON) loaded via `loadBinary()` XHR — required for `file://` offline WebView
- Game state in a single `useReducer` in `GameScene.tsx`; side effects (audio, localStorage) called imperatively in handlers, never in the reducer
- Audio: tries XHR → AudioBuffer; falls back to `speechSynthesis.speak()` for dev (no real MP3 files in M1); foley synthesised via Web Audio oscillators
- Fonts: Google Fonts CDN at dev time; must be bundled as WOFF2 via FontFace ArrayBuffer for M2 offline APK
- cr_event bridge: `window.ReactNativeWebView?.postMessage()` — silent no-op outside Curious Reader container

## Product

M1 (complete): English levels 1–4 playable — ghost-letter and no-ghost word groups (2-phoneme digraph words, CVC words). Hammer smash, scatter, drag-to-rebuild, plaque wall, hammer evolution, localStorage persistence, tutorial hand icon.

M2 (complete): Phoneme-sound TTS (says /b/ "buh", never letter names), level indicator fix, self-hosted WOFF2 font via FontFace ArrayBuffer, `vite.standalone.config.ts` (`build:standalone` → `dist/standalone/`, base `./`) for the offline APK bundle, levels 5–10 playable.

M3 (planned): Real recorded MP3 audio (ElevenLabs or voice talent) — MUST be phoneme sounds, never letter names.

## User preferences

_Populate as you build._

## Gotchas

- Do NOT use `fetch()`, `<audio>`, or CDN script tags — offline WebView blocks them. Use `loadBinary()` XHR for all external assets.
- `file://` XHR returns status 0 on success (not 200) — the JSON/binary loaders already handle this.
- Run `pnpm run typecheck` from workspace root before testing — leaf artifact typechecks need fresh lib declarations.
- Google Fonts `@import` in CSS works for dev but must be replaced with self-hosted WOFF2 for the offline APK build.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
- See `artifacts/word-smash/DECISIONS.md` for detailed architecture decisions
