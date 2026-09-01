# Onboarding: your first hour with Word Smash

**Status:** Active · **Last updated:** 2026-08-31

Word Smash is an offline literacy game for children ages 4–8. It runs inside
Curious Learning's Curious Reader app, from a local `file://` WebView with **no
network** — a constraint that shapes most of the codebase.

This page gets you from nothing to a running game using Claude Code. Pick your
surface below; after setup the two are identical.

**The short version:** install Claude Code → clone the repo → open it → run
`/getstarted` → run `/console`.

---

## Before you start

| You need | Notes |
|---|---|
| A paid Claude plan | Pro, Max, Team, Enterprise, or a Console account. The free plan does not include Claude Code |
| **Node.js 24** | The version matters — 25 and 20 both break the tests. See [SETUP.md](SETUP.md) |
| git | On Windows, [Git for Windows](https://git-scm.com/downloads/win) |

> **Windows: use WSL 2.** The release packaging shells out to the `zip` and
> `unzip` commands, which native Windows does not provide. Everything else works
> natively, but `pnpm game:build` will fail until you are in WSL (or you install
> those tools yourself). Install Claude Code *inside* your WSL distribution, and
> keep the clone on the Linux side.

---

## Option A — Claude Code desktop app

A graphical app with a sidebar, a terminal, a diff viewer, and a browser pane.
Nothing to install beyond the app itself; it includes Claude Code.

1. **Download and install**
   [macOS](https://claude.ai/api/desktop/darwin/universal/dmg/latest/redirect) ·
   [Windows](https://claude.ai/api/desktop/win32/x64/setup/latest/redirect) ·
   [Linux (beta)](https://code.claude.com/docs/en/desktop-linux).
   Launch it and sign in with your Anthropic account.

2. **Clone the repo.** Open the built-in terminal with ``Ctrl+` `` and run:

   ```bash
   git clone -b feat/content-pipeline-and-console https://github.com/tinsleygalyean/word-smash.git word-smash
   ```

   (Once that branch is merged, drop the `-b …` and clone `main`.)

3. **Open the project.** Click the **Code** tab at the top, choose **Local**,
   then **Select folder** and pick the `word-smash` directory you just cloned.
   On Windows choose **WSL** instead of Local, per the note above.

4. **Run the setup command.** Type `/getstarted` in the prompt box and send it.

5. **Run the console.** Type `/console`. The control panel opens in the app's
   Browser pane with the game playing inside it.

The desktop app is the better fit here: `/console` renders the control panel and
the live game directly in the Browser pane, next to your chat.

## Option B — VS Code extension

1. **Install the extension.** [Install for VS Code](vscode:extension/anthropic.claude-code),
   or press `Cmd+Shift+X` / `Ctrl+Shift+X`, search for "Claude Code", and click
   **Install**. Requires VS Code 1.94 or newer. It also works in Cursor and other
   VS Code forks.

2. **Clone and open the repo.** In a terminal:

   ```bash
   git clone -b feat/content-pipeline-and-console https://github.com/tinsleygalyean/word-smash.git word-smash && code word-smash
   ```

   Opening the repo as your VS Code workspace folder is what makes this project's
   slash commands available.

3. **Open the Claude panel.** Click the Spark icon in the Activity Bar (left
   sidebar) or the editor toolbar, or use the Command Palette
   (`Cmd+Shift+P` / `Ctrl+Shift+P`) → "Claude Code: Open in New Tab". Sign in
   when prompted.

4. **Run the setup command.** Type `/getstarted` in the Claude panel.

5. **Run the console.** Type `/console`. There is no Browser pane in VS Code, so
   Claude will hand you a URL — open <http://localhost:23522> in your browser.

## Option C — terminal only

```bash
curl -fsSL https://claude.ai/install.sh | bash
```

Then `cd` into the clone and run `claude`, and use `/getstarted` and `/console`
exactly as above. Windows PowerShell uses `irm https://claude.ai/install.ps1 | iex`.

---

## What `/getstarted` actually does

It is not magic, and you can run any of it by hand — see [SETUP.md](SETUP.md).

1. `pnpm preflight` — checks Node, pnpm, git, zip/unzip, dependencies, native
   binaries, content, ZIPs, and credentials
2. `pnpm install`
3. `pnpm setup:native` — installs your platform's build binaries (see below)
4. `pnpm run typecheck` and the test suite — expect **124 tests passing**
5. `pnpm game:build` — pulls content from the Google Sheet and builds the ZIPs
6. Offers to set up a CMS key — **say no unless you are uploading releases**

**You will be asked to approve commands.** Claude Code asks before running shell
commands, depending on your permission mode. Approving `pnpm` commands during
setup is expected.

### Why there is a `setup:native` step

This repo runs in production on Replit, which is linux-x64, and the workspace
strips out every native binary for other platforms to keep that install lean.
The side effect: on macOS, Windows, or ARM Linux a plain `pnpm install` leaves
you with no Rollup/esbuild binary and every build fails with
`Cannot find module '@rollup/rollup-darwin-arm64'`. `pnpm setup:native` fixes
that without touching anything tracked by git. Re-run it after any `pnpm install`
that recreates `node_modules`.

## What `/console` gives you

A local control panel at <http://localhost:23522>: a language dropdown, a button
for each of the four pipeline commands, live streamed output, and the built game
playing in a **phone-landscape frame** (19.5:9, 20:9, 16:9, 3:2).

It is a local server rather than a hosted page because it has to actually run
builds on your machine.

---

## The mental model

Three things are worth knowing before you change anything.

**Level content is not in the repo.** Words and levels live in the
[Word Smash levels sheet](https://docs.google.com/spreadsheets/d/1X_A1EnF4ySLp508donSBBKuL-mDYG4Ojlv7ItcWCXfo/edit),
one tab per language. `wordsmash.json` is *generated* from it — edit the sheet,
then run `pnpm game:build`. Hand-editing the JSON works until the next build
overwrites it. Reading the sheet needs no credentials.

**The game must work with no network.** No `fetch()`, no `<audio>`, no CDN
tags — every asset loads through `XMLHttpRequest`, and `file://` XHR returns
status `0` on success. The build fails the release if it finds a forbidden
pattern. [DECISIONS.md](../artifacts/word-smash/DECISIONS.md) has the reasoning.

**Uploads are gated on purpose.** `pnpm game:upload` dry-runs by default and
contacts nothing. A real upload needs credentials *and* a typed confirmation,
and only ever lands in the CMS development channel — promotion and publishing
are a human decision made in the CMS.

## Try something

Good first task, end to end and reversible:

1. Open the levels sheet and change a word's dashes — say `s-ea` to `se-a`.
2. Run `/console`, pick English, click **`pnpm game:build`**.
3. Watch it fail: the recordings for the new breakpoints do not exist, and the
   build names the exact MP3s it would need. That guard is the point — a word
   can never ship silent.
4. Undo your sheet edit and rebuild.

## When something breaks

Run `pnpm preflight` first — it names the fix for each problem. The
[troubleshooting table in SETUP.md](SETUP.md#troubleshooting) maps every common
error message to its cause.

You can also just ask Claude in the panel: it has this repo's docs and can read
the failure directly.

## Where to read next

| Document | For |
|---|---|
| [SETUP.md](SETUP.md) | The manual setup path and troubleshooting |
| [CONTENT_PIPELINE.md](CONTENT_PIPELINE.md) | Sheet → JSON → ZIPs → CMS; adding a word or language |
| [README](../README.md) | Workspace layout and the artifact map |
| [Specs](specs/README.md) | `PRD → DEVSPEC → UISPEC → TESTSPEC` |
| [AI playbook](REPLIT_AGENT_PLAYBOOK.md) | How AI and humans split work here, and the approval gates |

---

## Changelog

2026-08-31 — Claude & Tinsley Galyean — Initial onboarding guide for the desktop
app, the VS Code extension, and the CLI
