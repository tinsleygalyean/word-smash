# Setup reference: the manual path and troubleshooting

**Status:** Active · **Last updated:** 2026-09-02

> **Read before this page:** [ONBOARDING.md](ONBOARDING.md). That is the setup
> path — pick an environment, install prerequisites, clone, run `/getstarted`,
> play. Most people never need this page.
>
> **This page assumes you already have a clone on disk** and are sitting in its
> root directory.

Come here when:

- `/getstarted` stopped on an error → [Troubleshooting](#troubleshooting)
- You are on Replit or another environment without Claude Code slash commands
- You want to run each step by hand, or understand why a step exists
- You are setting up CMS upload credentials

Everything below was verified on a clean clone on macOS (Apple Silicon) and
re-checked on Ubuntu under WSL 2.

---

## The manual path

The same sequence `/getstarted` runs, one command at a time. Run all of them
**from the repository root**.

```bash
cd word-smash && pwd
```

If `pwd` does not end in your clone directory, fix that first — every `pnpm`
command below will otherwise fail with `ERR_PNPM_NO_PKG_MANIFEST`.

### 1. Audit the machine

```bash
pnpm preflight
```

Read-only. It reports Node version, pnpm, git, zip/unzip, dependencies, native
binaries, language packs, release ZIPs, and whether CMS credentials exist —
printing the exact fix beside anything missing. Run it any time something
breaks, not just during setup.

### 2. Install dependencies

```bash
pnpm install
```

npm and yarn are blocked on purpose by a `preinstall` guard.

### 3. Install your platform's native binaries

**Required on macOS, Windows, and ARM Linux. A no-op on linux-x64** (Replit).

```bash
pnpm setup:native
```

Re-run it after any `pnpm install` that recreates `node_modules`. It is safe to
run repeatedly and does nothing when the binaries are already present.
[Why this step exists](#why-there-is-a-setupnative-step).

### 4. Verify

```bash
pnpm run typecheck
```

```bash
pnpm --filter @workspace/word-smash run test
```

Expect **9 test files, 124 tests passing**. If tests fail here, the cause is
almost always the Node version or the missing native binaries — re-run
`pnpm preflight` and read it before trying anything else.

### 5. Build

```bash
pnpm game:build
```

Pulls level content from the Google Sheet, builds the offline bundle, and writes
the engine and language ZIPs.

### 6. Play

```bash
pnpm game:console
```

A local control panel at <http://localhost:23522> — language picker, a button
per pipeline command, live output, and the game in a phone-landscape frame. In
Claude Code, `/console` does this for you.

It binds `127.0.0.1` only, so it is reachable **only from the machine running
it**. That is why it does not work on Replit.

Prefer a plain preview window?

```bash
pnpm game:preview
```

---

## Prerequisites in detail

Per-OS install commands live in
[ONBOARDING.md step 2](ONBOARDING.md#step-2--install-prerequisites-by-os). This
section explains *why* each one is required.

| Need | Why |
|---|---|
| **Node.js 24** | See below — the version genuinely matters |
| **pnpm** | Enforced by a `preinstall` guard; comes with Node via `corepack enable` |
| **git** | Cloning, and `pnpm preflight` checks for it |
| **`zip` / `unzip`** | The release packaging shells out to them. Absent on native Windows — use WSL 2 |

### Why Node 24, exactly

- **Node 25** ships a built-in global `localStorage` that shadows jsdom's. All
  124 tests fail with `localStorage.clear is not a function`.
- **Node 20** is too old for jsdom 30 and fails with
  `webidl.util.markAsUncloneable is not a function`.

Node 24 is the version the project targets, the version `.replit` pins
(`modules = ["nodejs-24"]`), and the one these steps were verified on.

```bash
nvm install 24 && nvm use 24
```

### Why there is a `setup:native` step

`pnpm-workspace.yaml` deliberately `overrides` away every non-linux-x64 native
package, because Replit — where this repo runs in production — is linux-x64, and
excluding the rest keeps that install small.

The side effect is that everywhere else, Rollup, esbuild, Lightning CSS, and
Tailwind's oxide have no binary for your platform, and every Vite build and
vitest run dies with:

```
Cannot find module '@rollup/rollup-darwin-arm64'
```

`pnpm setup:native` fetches exactly those four packages at the versions already
in your lockfile and drops them in the top-level `node_modules`. It changes
**nothing tracked by git** — not `package.json`, not `pnpm-lock.yaml`, and above
all not the `minimumReleaseAge` supply-chain safeguard, which must stay on.

---

## What you do *not* need

- **No credentials to read the level content.** The Google Sheet is link-shared
  for viewing and the build reads its public CSV export.
- **No Replit account** to build, test, preview, or package.
- **No `.env`** unless you are uploading to the CMS.

## Optional: CMS upload credentials

Only needed if you will push releases to the Curious Reader CMS. Building,
testing, and previewing need no credentials at all.

```bash
pnpm env:init
```

That copies `.env.example` to `.env` (server URL filled in, key blank) and opens
it in your editor. Paste the key from the Curious Learning team after
`CR_MCP_API_KEY=` and save.

> **Never paste the key into a chat** (including to an AI assistant), a commit,
> an issue, or a screenshot. Type it into the editor. `.env` is git-ignored and
> must stay that way. If a key is ever exposed, rotate it.

Confirm without revealing anything:

```bash
pnpm env:init -- --status
```

It prints `set` / `not set`, never the values. If it still says `not set`, the
usual causes are quotes around the value, a trailing space, or an unsaved editor
buffer.

---

## Troubleshooting

| Symptom | Cause and fix |
|---|---|
| `[ERR_PNPM_NO_PKG_MANIFEST] No package.json found in /home/<you>` | You are not in the repository. `cd` into your clone and re-run. Check with `pwd` |
| `[ERR_PNPM_IGNORED_BUILDS] Ignored build scripts: esbuild@…` | pnpm refuses to run a dependency's build script until it is approved. Unblock yourself with `pnpm approve-builds` → select `esbuild` → `pnpm install`. See the note below on why the committed approval list may not be taking effect |
| `Cannot find module '@rollup/rollup-…'` | Run `pnpm setup:native` (step 3) |
| `localStorage.clear is not a function` | You are on Node 25. Use Node 24 |
| `webidl.util.markAsUncloneable is not a function` | You are on Node 20 or older. Use Node 24 |
| `Use pnpm instead` on install | You ran npm or yarn. This repo requires pnpm |
| `zip: command not found` when packaging | Install the `zip`/`unzip` CLIs. On native Windows, switch to WSL 2 |
| `/getstarted` or `/console` is not offered | Claude Code is not open *on the repository root*. The commands are defined in `.claude/commands/` inside this repo |
| `/console` opens nothing on Replit | Expected. The console binds `127.0.0.1` and Replit's proxy cannot reach it. Use the artifact's managed workflow |
| `PORT environment variable is required` from `pnpm run build` | The Canvas artifact expects the env Replit injects. Locally: `PORT=8081 BASE_PATH=/__mockup pnpm run build` |
| Port 23522 already in use | `pnpm game:console -- --no-open --port <n>` |
| `pnpm setup` or `pnpm doctor` does something unexpected | Those are pnpm's own builtins. This repo's scripts are `setup:native` and `preflight` |
| Sheet fetch returns HTML, not CSV | The sheet's link-sharing changed. Fix sharing, or build from a saved export with `pnpm content:build -- --from-csv <file>` |

Still stuck? Run `pnpm preflight` and paste its output to Claude in the panel —
it can read the failure and this repo's docs directly.

### Why the ignored-builds error happens

`pnpm-workspace.yaml` is still written for **pnpm 10**:

```yaml
onlyBuiltDependencies:
  - '@swc/core'
  - esbuild
  - msw
  - unrs-resolver
```

**pnpm 11 removed that setting.** `onlyBuiltDependencies`,
`onlyBuiltDependenciesFile`, `neverBuiltDependencies`, `ignoredBuiltDependencies`
and `ignoreDepScripts` were all replaced by a single `allowBuilds` map, and the
old keys are **silently ignored** — no warning, no error, they simply do
nothing. So on pnpm 11 nothing is approved, esbuild's build script is skipped,
and the install fails with `ERR_PNPM_IGNORED_BUILDS`. The pnpm 11 equivalent is:

```yaml
allowBuilds:
  esbuild: true
```

`pnpm approve-builds` writes exactly that, and since pnpm 11.23 it also deletes
the stale pnpm 10 keys — so running it edits `pnpm-workspace.yaml` for you.
Expect a diff, and commit it rather than leaving it in your working tree for the
next person to rediscover. Dropping `@swc/core`, `msw` and `unrs-resolver` costs
nothing: none of the three appear anywhere in `pnpm-lock.yaml`: they were
template boilerplate, and `esbuild` is the only dependency here with a build
script.

Nothing about this weakens the `minimumReleaseAge` supply-chain safeguard in the
same file. That setting is unrelated and must stay on.

### The pnpm version is pinned

The underlying cause of the above was that nothing pinned pnpm, so corepack
resolved whichever version it liked and developers silently ended up on
different majors. `package.json` now pins it:

```json
"packageManager": "pnpm@11.25.0"
```

Two different mechanisms honor that field, which is why it works everywhere:

- **corepack** reads it and runs exactly that version.
- **pnpm itself** compares its own version against it and, because `pmOnFail`
  defaults to `download`, downloads and runs the declared version on a
  mismatch rather than failing. So this holds on Replit too, whatever pnpm the
  workspace provisions.

Use the `packageManager` field, **not** `devEngines.packageManager`. pnpm 11
prefers `devEngines`, but corepack does not read it, and declaring both makes
pnpm warn `Cannot use both 'packageManager' and 'devEngines.packageManager'`
and ignore `packageManager` — which would break the corepack path this project
tells you to use. The version must be exact; a range like `pnpm@^11.0.0` fails
with `Invalid package manager specification`.

To move to a newer pnpm, edit that one line and commit it.

---

## Running the artifacts directly

Outside Replit you must supply the environment the managed workflow normally
injects:

```bash
# Word Smash game — http://localhost:23518/
PORT=23518 BASE_PATH=/ pnpm --filter @workspace/word-smash run dev
```

```bash
# API Server — http://localhost:8080/api (health at /api/healthz)
PORT=8080 pnpm --filter @workspace/api-server run dev
```

```bash
# Canvas — http://localhost:8081/__mockup
PORT=8081 BASE_PATH=/__mockup pnpm --filter @workspace/mockup-sandbox run dev
```

In Replit, start the artifact's existing managed workflow instead.

## Release checks

```bash
# Relative-path offline bundle only
pnpm --filter @workspace/word-smash run build:standalone
```

```bash
# Rebuild the bundle and ZIPs, then run offline integrity checks
pnpm --filter @workspace/word-smash run test:bundle
```

```bash
# Check already-built outputs without rebuilding (outputs must exist)
pnpm --filter @workspace/word-smash run test:bundle --no-build
```

```bash
# Show the CMS upload plan without contacting the CMS
pnpm --filter @workspace/scripts run upload:wordsmash -- --lang english --dry-run
```

Do not run a live upload or publish based only on an AI's judgment. Those
actions require credentials, external side effects, and human approval.

## Where to read next

| Document | Read it for | Read this first |
|---|---|---|
| [CONTENT_PIPELINE.md](CONTENT_PIPELINE.md) | Sheet → JSON → ZIPs → CMS; adding a word or language | [ONBOARDING.md](ONBOARDING.md) |
| [README](../README.md) | Workspace layout, the artifact map, the document map | — |
| [REPLIT_AGENT_PLAYBOOK.md](REPLIT_AGENT_PLAYBOOK.md) | Approval gates and verification norms | [README](../README.md) |

---

## Changelog

2026-09-04 — Claude & David Sturman — Explained the pnpm 11 `allowBuilds`
migration behind `ERR_PNPM_IGNORED_BUILDS`, and documented the new
`packageManager` pin and why it uses `packageManager` rather than `devEngines`

2026-09-02 — Claude & David Sturman — Recast as a reference and troubleshooting
page rather than a second onboarding path; removed the `/getstarted` ordering
confusion by making [ONBOARDING.md](ONBOARDING.md) the prerequisite; per-OS
install commands moved there; added the wrong-directory, ignored-builds,
missing-slash-command, Replit-console, and port-in-use entries; absorbed the
artifact-run and release-check commands from the README

2026-08-31 — Claude & Tinsley Galyean — Initial setup guide, verified on a clean
clone; added `pnpm setup:native` for non-linux-x64 machines
