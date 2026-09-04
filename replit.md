# Word Smash

An offline literacy web game for children ages 4–8 built for Curious Learning's
Curious Reader container (offline-first Android/iOS WebView from `file://`).
Children smash words with a hammer, scatter letter tiles, then drag them back to
rebuild the word.

## Read AGENTS.md first

**`AGENTS.md` in the repository root is the authoritative agent brief** — the
non-negotiables, the generated files you must not hand-edit, the commands worth
running, and the architecture details that are easy to get wrong. Read it before
making changes. This file is the Replit-side entry point and deliberately does
not repeat it.

Then: [`README.md`](README.md) maps every document,
[`docs/REPLIT_AGENT_PLAYBOOK.md`](docs/REPLIT_AGENT_PLAYBOOK.md) covers the
AI/human split, and `docs/specs/` (PRD → DEVSPEC → UISPEC → TESTSPEC) is
authoritative for behavior.

## Non-negotiables

Repeated here because a miss is expensive; `AGENTS.md` has the detail.

- **pnpm only.** A `preinstall` guard rejects npm and yarn.
- **`minimumReleaseAge: 1440` in `pnpm-workspace.yaml` stays on.** Never lower
  or remove it to make an install succeed.
- **The game must run offline.** No `fetch()`, no `<audio>`, no CDN
  `<script>`/`<link>`/`@import`. Load binaries via XHR. The release build fails
  on these patterns.
- **`public/lang/<code>/wordsmash.json` is generated** from the Word Smash
  levels Google Sheet by `pnpm content:build`. Edit the sheet, not the JSON.
- **Live uploads and publishing are human decisions.** `pnpm game:upload`
  dry-runs unless `--live`.
- **Never commit `.env`.**

## Replit specifics

Ports, services, and preview paths — the part that is only true on this platform.

| Artifact | Package | Preview | Dev command |
|---|---|---|---|
| Word Smash | `@workspace/word-smash` | `/` | `pnpm --filter @workspace/word-smash run dev` (port 23518) |
| API Server | `@workspace/api-server` | `/api` | `pnpm --filter @workspace/api-server run dev` (port 8080) |
| Canvas | `@workspace/mockup-sandbox` | `/__mockup` | — |

Other local ports: `pnpm game:preview` serves a built language on 23520,
`pnpm game:console` runs the control panel on 23522.

The API server is unused by the current offline game; it exists for possible
future leaderboard/analytics work.

Workspace members are discovered under `artifacts/*`, `lib/*`,
`lib/integrations/*`, and `scripts`. Stack: pnpm workspaces, Node.js 24,
TypeScript 5.9, React 19 + Vite. No backend for the game — client-side with
localStorage.

Change `.replit-artifact/artifact.toml` only through Replit's artifact tools,
never by editing the file.

## Command and product reference

- Commands: [`README.md`](README.md) has the full map;
  [`docs/CONTENT_PIPELINE.md`](docs/CONTENT_PIPELINE.md) explains the sheet →
  release path.
- Where things live: [`README.md`](README.md) directory guide.
- Architecture rationale:
  [`artifacts/word-smash/DECISIONS.md`](artifacts/word-smash/DECISIONS.md).
- Upload sequence: [`artifacts/word-smash/UPLOAD.md`](artifacts/word-smash/UPLOAD.md).
- Milestone status and history: [`docs/specs/PRD.md`](docs/specs/PRD.md) §6
  "Scope & milestone history" is the source of truth. M1, M2, the "Honey & Paint"
  redesign, and M3 (recorded MP3 audio) are all complete.

## User preferences

_Populate as you build._
