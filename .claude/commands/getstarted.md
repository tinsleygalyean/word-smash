---
description: Set up a fresh clone of Word Smash — dependencies, native binaries, verification, first build, and an optional CMS key
allowed-tools: Bash, Read, Edit
---

Walk the user from a fresh clone to a working local copy. Be brisk and concrete:
run the steps, report what happened, stop when something needs a human.

**Never ask the user to paste an API key, token, or password into the chat.**
The `.env` step is handled by a script that opens their editor so the key goes
straight from them into the file. Never read, print, `cat`, or echo `.env`, and
never repeat a key value even if one appears somewhere in context. If a key does
get exposed, say so plainly and tell them to rotate it.

## 1. Check the machine

```bash
pnpm preflight
```

This reports Node version, pnpm, git, zip/unzip, dependencies, native binaries,
language packs, release ZIPs, and whether CMS credentials exist. Each problem
prints the exact command that fixes it.

**If Node is the wrong major version, stop.** Everything downstream fails in
confusing ways. Tell the user to run `nvm install 24 && nvm use 24` (Node 25
shadows jsdom's `localStorage` and breaks all 124 tests; Node 20 is too old for
jsdom 30) and to re-run `/getstarted` after. Do not try to change their Node
version or edit their shell profile yourself.

## 2. Install

Skip whichever of these preflight already reported as fine.

```bash
pnpm install
```

```bash
pnpm setup:native
```

`setup:native` is required on macOS, Windows, and ARM Linux, and is a no-op on
linux-x64. Without it every Vite build and test run dies with
`Cannot find module '@rollup/rollup-<platform>'`, because the workspace excludes
non-linux-x64 native packages for Replit's benefit. It changes nothing tracked
by git.

## 3. Verify

```bash
pnpm run typecheck
```

```bash
pnpm --filter @workspace/word-smash run test
```

Expect 9 test files and 124 tests passing. If tests fail here, the cause is
almost always the Node version or missing native binaries — re-run
`pnpm preflight` and read it before trying anything else.

## 4. First build

```bash
pnpm game:build
```

Pulls level content from the Google Sheet (no credentials needed — it is
link-shared), builds the offline bundle, and writes the engine and language
ZIPs. Report the ZIP names and sizes it prints.

## 5. Optional — CMS credentials

Ask whether they will be uploading releases to the Curious Reader CMS. If not,
skip this entirely and say so: building, testing, and previewing need no
credentials.

If yes:

```bash
pnpm env:init
```

That copies `.env.example` to `.env` (server URL already filled in, key blank)
and opens it in their editor. Tell them to paste the key from the Curious
Learning team after `CR_MCP_API_KEY=` and save — in the editor, not here.

When they say they have saved it, confirm without reading the file:

```bash
pnpm env:init -- --status
```

It prints only `set` / `not set`. If the key still reads `not set`, the usual
causes are quotes around the value, a trailing space, or an unsaved editor
buffer.

## 6. Hand off

Finish with a short summary: what was already fine, what you installed, the test
result, the ZIPs built, and whether CMS credentials are set. Then tell them:

- `/console` — the control panel: pick a language, run any pipeline command,
  play the game in a phone-landscape frame
- `docs/ONBOARDING.md` — the setup path this command automates, plus the mental
  model and a good reversible first task
- `docs/SETUP.md` — reference: the manual command sequence, why each step exists,
  and a troubleshooting table
- `docs/CONTENT_PIPELINE.md` — how sheet content becomes a release

Do not run a live CMS upload as part of getting started. `pnpm game:upload`
dry-runs and contacts no server; a real upload is a separate, deliberate
decision that requires a typed confirmation.

$ARGUMENTS may contain notes such as `skip env` — honor them if sensible.
