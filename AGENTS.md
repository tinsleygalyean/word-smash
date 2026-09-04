# Agent instructions

Word Smash is an offline literacy game for children ages 4–8, built for Curious
Learning's Curious Reader container: an Android/iOS WebView that loads the game
from `file://` with no network. That constraint drives almost every rule below.

Start with [README.md](README.md) — it is the map to every other document and is
kept deliberately non-duplicative. Do not restate its content here.

## Non-negotiables

- **pnpm only.** A `preinstall` guard rejects npm and yarn.
- **`minimumReleaseAge: 1440` in `pnpm-workspace.yaml` stays on.** It is a
  supply-chain safeguard. Never lower or remove it to make an install succeed;
  use `minimumReleaseAgeExclude` only when a human asks for a specific package.
- **The game must run offline.** No `fetch()`, no `<audio>` elements, no CDN
  `<script>`/`<link>`/`@import`. Load every binary through XHR (`loadBinary()`)
  because `fetch` and `<audio>` fail on `file://`.
  `artifacts/word-smash/scripts/check-bundle.mjs` fails the release build on
  these patterns — treat it as the contract, not a lint suggestion.
- **Live uploads and publishing are human decisions.** `pnpm game:upload`
  dry-runs unless `--live`, needs credentials plus a typed confirmation, and
  targets only the CMS development channel. Never run it live yourself.
- **Never commit `.env`.** Only `.env.example` is tracked.

## Do not hand-edit

- `artifacts/word-smash/public/lang/<code>/wordsmash.json` — **generated** from
  the Word Smash levels Google Sheet (one tab per language) by
  `pnpm content:build`. To change a word or a level, edit the sheet and rebuild.
  `artifacts/word-smash/content.config.json` holds the sheet ID and tab map.
- Anything under `dist/` — build output.
- `.replit-artifact/artifact.toml` — change it through the owning platform's
  artifact tools, not by editing the file.

## Commands worth knowing

Full list in [README.md](README.md#command-map); these are the ones an agent
actually runs:

```bash
pnpm run typecheck                        # all packages — run before claiming done
pnpm --filter @workspace/word-smash test  # vitest
pnpm content:build                        # sheet → language JSON, validated
pnpm game:build                           # content + engine ZIP + language ZIPs
```

Add `-- --lang <code>` to any pipeline command to scope it to one language.
English is currently the only configured language.

This repo also defines two Claude Code slash commands in `.claude/commands/`:
`/getstarted` (set up a fresh clone) and `/console` (run the pipeline and
preview the game in a phone-landscape frame).

## Architecture notes that are easy to get wrong

- Game state is one `useReducer` in `GameScene.tsx`. Side effects — audio,
  localStorage — are called imperatively in handlers, **never** in the reducer.
- Audio says phoneme sounds, never letter names (`/b/` is "buh", not "bee").
  Recorded MP3s under `public/lang/english/audios/` are the real source; Web
  Speech TTS is a dev-only fallback.
- Fonts must be self-hosted WOFF2 loaded via `FontFace` from an ArrayBuffer.
  A Google Fonts tag works in dev and breaks the offline bundle.
- Geometry is authored in a fixed 1200×540 reference canvas, cover-scaled to the
  device. Keep new geometry in reference coordinates.
- `window.ReactNativeWebView?.postMessage()` is the `cr_event` bridge; it is a
  silent no-op outside the container, so its absence is not a bug.

See [artifacts/word-smash/DECISIONS.md](artifacts/word-smash/DECISIONS.md) for
the rationale behind these, and `docs/specs/` (PRD → DEVSPEC → UISPEC →
TESTSPEC) for authoritative behavior. DEVSPEC wins over any summary, including
this file.

## Working agreements

- Inspect the code before trusting a doc; the specs are living documents and can
  lag.
- When intent changes, reconcile the spec chain in order. When only an
  implementation detail changes, start at the earliest affected document.
- Pause for a human before credentials, external writes, publishing, destructive
  work, or any change in product intent.
- [docs/REPLIT_AGENT_PLAYBOOK.md](docs/REPLIT_AGENT_PLAYBOOK.md) has the full
  AI/human ownership split.
