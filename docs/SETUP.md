# Setting up Word Smash on your machine

**Status:** Active · **Last updated:** 2026-08-31

From a fresh clone to a running game. Should take about five minutes.

**In Claude Code, just run `/getstarted`** — it walks the whole thing, then
`/console` puts you in front of the running game. This page is the manual path
and the reference for when something goes wrong.

Every step below was verified on a clean clone on macOS (Apple Silicon).

---

## 1. Prerequisites

| Need | Notes |
|---|---|
| **Node.js 24** | The version matters — see the warning below |
| **pnpm** | Comes with Node via `corepack enable`; npm and yarn are blocked on purpose |
| **git** | |
| **`zip` / `unzip`** | Used to build the container ZIPs. Present by default on macOS; on Debian/Ubuntu `sudo apt install zip unzip` |

> **Use Node 24 specifically.** Node **25** ships a built-in global `localStorage`
> that shadows jsdom's, and all 124 tests fail with
> `localStorage.clear is not a function`. Node **20** is too old for jsdom 30 and
> fails with `webidl.util.markAsUncloneable is not a function`. Node 24 is the
> version the project targets and the one these steps were verified on.

With [nvm](https://github.com/nvm-sh/nvm):

```bash
nvm install 24 && nvm use 24
```

Then enable pnpm:

```bash
corepack enable
```

## 2. Clone and install

```bash
git clone <repository-url> word-smash && cd word-smash
```

```bash
pnpm install
```

## 3. Install your platform's native binaries

**Skip this only if you are on linux-x64** (Replit). On macOS, Windows, or ARM
Linux it is required:

```bash
pnpm setup:native
```

<details>
<summary>Why this step exists</summary>

`pnpm-workspace.yaml` deliberately `overrides` away every non-linux-x64 native
package, because Replit — where this repo runs in production — is linux-x64, and
excluding the rest keeps that install small. The side effect is that everywhere
else, Rollup, esbuild, Lightning CSS, and Tailwind's oxide have no binary for
your platform, and every Vite build and vitest run dies with:

```
Cannot find module '@rollup/rollup-darwin-arm64'
```

`pnpm setup:native` fetches exactly those four packages at the versions already
in your lockfile install and drops them in the top-level `node_modules`. It
changes nothing tracked by git — not `package.json`, not `pnpm-lock.yaml`, and
above all not the `minimumReleaseAge` supply-chain safeguard, which must stay on.

Re-run it after any `pnpm install` that recreates `node_modules`. It is safe to
run repeatedly and does nothing when the binaries are already there.

</details>

Check the machine at any time:

```bash
pnpm preflight
```

It reports Node version, tooling, dependencies, native binaries, content, ZIPs,
and credentials, printing the exact fix beside anything missing.

## 4. Verify

```bash
pnpm run typecheck
```

```bash
pnpm --filter @workspace/word-smash run test
```

Expect **9 test files, 124 tests passing**. If tests fail here, re-read steps 1
and 3 — the Node version and the native binaries cause nearly every setup failure.

## 5. Build and play

```bash
pnpm game:build
```

This pulls the level content from the Google Sheet, builds the offline bundle,
and writes the engine and language ZIPs. Then:

```bash
pnpm game:console
```

That opens a local control panel at <http://localhost:23522> with a language
picker, a button for each pipeline command, live output, and the game playing in
a phone-landscape frame. In Claude Code you can also just type `/console`.

Prefer a plain preview window instead?

```bash
pnpm game:preview
```

---

## What you do *not* need

- **No credentials to read the level content.** The Google Sheet is link-shared
  for viewing and the build reads its public CSV export.
- **No Replit account** to build, test, preview, or package.
- **No `.env`** unless you are uploading to the CMS (next section).

## Optional: CMS upload credentials

Only needed if you will push releases to the Curious Reader CMS. Building,
testing, and previewing need no credentials at all.

```bash
pnpm env:init
```

That copies `.env.example` to `.env` (server URL filled in, key blank) and opens
it in your editor. Paste the key from the Curious Learning team after
`CR_MCP_API_KEY=` and save. `.env` is git-ignored and must stay that way.

Never paste the key into a chat (including to an AI assistant), a commit, an
issue, or a screenshot — type it into the editor. Then confirm:

```bash
pnpm env:init -- --status
```

It prints `set` / `not set`, never the values. If it still says `not set`, the
usual causes are quotes around the value, a trailing space, or an unsaved
editor buffer.

## Troubleshooting

| Symptom | Cause and fix |
|---|---|
| `Cannot find module '@rollup/rollup-…'` | Step 3 — run `pnpm setup:native` |
| `localStorage.clear is not a function` | You are on Node 25. Use Node 24 |
| `webidl.util.markAsUncloneable is not a function` | You are on Node 20 or older. Use Node 24 |
| `Use pnpm instead` on install | You ran npm or yarn; this repo requires pnpm |
| `PORT environment variable is required` from `pnpm run build` | The Canvas artifact expects the env Replit injects. Locally: `PORT=8081 BASE_PATH=/__mockup pnpm run build` |
| `zip: command not found` when packaging | Install the `zip`/`unzip` CLIs |
| `pnpm setup` or `pnpm doctor` does something unexpected | Those are pnpm's own builtins. This repo's scripts are `setup:native` and `preflight` |
| Sheet fetch returns HTML, not CSV | The sheet's link-sharing changed. Fix sharing, or build from a saved export with `pnpm content:build -- --from-csv <file>` |

## Where to go next

- [Content pipeline](CONTENT_PIPELINE.md) — how sheet content becomes a release,
  and how to add a word or a language
- [README](../README.md) — workspace overview and the artifact map
- [AI playbook](REPLIT_AGENT_PLAYBOOK.md) — approval gates and verification norms

---

## Changelog

2026-08-31 — Claude & Tinsley Galyean — Initial setup guide, verified on a clean
clone; added `pnpm setup:native` for non-linux-x64 machines
