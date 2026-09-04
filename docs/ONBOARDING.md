# Onboarding: get Word Smash running

**Status:** Active · **Last updated:** 2026-09-02

> **Read before this page:** [README.md](../README.md) — what Word Smash is and
> how the repository is laid out. Five minutes.
>
> **Read after this page:** [CONTENT_PIPELINE.md](CONTENT_PIPELINE.md) — how to
> actually change a word or add a language.
>
> **If a step on this page fails:** [SETUP.md](SETUP.md) — the manual path and a
> troubleshooting table that maps every common error to its fix. Do not read
> SETUP.md first; it assumes you have already been here.

This page is the **only** setup path you need. It takes you from an empty machine
to a playable game. Everything is labelled by **where you are working**
(Replit, Claude Code desktop, VS Code, CLI) and by **operating system**
(macOS, Windows, Ubuntu).

---

## The shape of it

Five steps, in this order. Do not skip ahead — step 4 cannot run before step 3,
because the setup command lives *inside* the repository.

| # | Step | Section |
|---|---|---|
| 1 | Pick your environment | [Step 1](#step-1--pick-your-environment) |
| 2 | Install prerequisites for your OS | [Step 2](#step-2--install-prerequisites-by-os) |
| 3 | Get the code onto the machine | [Step 3](#step-3--get-the-code) |
| 4 | Run setup | [Step 4](#step-4--run-setup) |
| 5 | Build and play | [Step 5](#step-5--build-and-play) |

**Replit users:** steps 2 and 3 are already done for you. Jump to
[the Replit path](#environment-replit).

---

## Step 1 — Pick your environment

Four supported places to work. Pick one now; steps 3, 4 and 5 differ between
them.

| Environment | Best for | Setup command | Can run `/console`? |
|---|---|---|---|
| **Claude Code desktop app** | Most people. Recommended | `/getstarted` | ✅ Yes — renders in the app's Browser pane |
| **Claude Code VS Code extension** | You already live in VS Code | `/getstarted` | ✅ Yes — you open the URL in your own browser |
| **Claude Code CLI** | Terminal-only, remote machines | `/getstarted` | ✅ Yes — you open the URL in your own browser |
| **Replit** | Where this repo runs in production | Shell commands, not slash commands | ❌ **No** — see below |

> **Why Replit cannot run the console.** The console server binds to
> `127.0.0.1` only, so nothing outside the machine can reach it — including
> Replit's public preview proxy. On Replit, use the artifact's managed workflow
> to see the game instead.

Claude Code needs a **paid Claude plan** (Pro, Max, Team, Enterprise, or a
Console account). The free plan does not include it. Replit does not need a
Claude plan.

---

## Step 2 — Install prerequisites, by OS

**Skip this entire step on Replit** — the workspace already provides Node 24,
pnpm, git, and zip/unzip.

You need four things everywhere: **Node.js 24**, **pnpm**, **git**, and the
**`zip`/`unzip`** command-line tools.

> **Node 24 exactly.** Not 25, not 20. Node 25 ships a built-in global
> `localStorage` that shadows jsdom's and all 124 tests fail; Node 20 is too old
> for jsdom 30. This is the single most common cause of a broken setup —
> [SETUP.md](SETUP.md#why-node-24-exactly) has the detail.

### macOS

`zip` and `unzip` are already present. Install git via the Xcode command line
tools if you do not have it:

```bash
xcode-select --install
```

Then Node 24 with [nvm](https://github.com/nvm-sh/nvm), and pnpm via corepack:

```bash
nvm install 24 && nvm use 24 && corepack enable
```

### Windows

**Use WSL 2. Not native Windows.** Release packaging shells out to the `zip` and
`unzip` commands, which Windows does not provide, so `pnpm game:build` fails
natively. Install a Linux distribution:

```powershell
wsl --install -d Ubuntu
```

Then — and this matters — do everything else **inside** WSL:

- Install Claude Code *in the WSL distribution*, not on the Windows side.
- Keep the clone on the Linux filesystem (`~/word-smash`), not under `/mnt/c/`.
  Cross-filesystem work is slow and causes permission and line-ending surprises.
- Follow the **Ubuntu** instructions below from your WSL shell.

In the Claude Code desktop app, choose **WSL** rather than **Local** when
opening the folder.

### Ubuntu (and Debian, and WSL 2)

```bash
sudo apt update && sudo apt install -y git zip unzip curl
```

Install [nvm](https://github.com/nvm-sh/nvm) following its README, then:

```bash
nvm install 24 && nvm use 24 && corepack enable
```

### Confirm

```bash
node --version && pnpm --version && git --version && zip -v | head -2
```

`node --version` must print `v24.x`.

You do **not** need to pick a pnpm version. `package.json` pins one
(`"packageManager": "pnpm@11.25.0"`), and corepack fetches exactly that on first
use — so `pnpm --version` may report a version you never installed. That is
working as intended; see [SETUP.md](SETUP.md#the-pnpm-version-is-pinned).

---

## Step 3 — Get the code

**On Replit, skip to [the Replit path](#environment-replit).**

The repository must exist on disk *before* step 4, because `/getstarted` is a
slash command defined inside this repository. Claude Code cannot see it until
the repo is your open project.

The clone command is the same in all three Claude Code environments:

```bash
git clone -b feat/content-pipeline-and-console https://github.com/tinsleygalyean/word-smash.git word-smash
```

> The `-b` flag is temporary: the setup and console work lives on
> `feat/content-pipeline-and-console` until it merges. Once it is on `main`,
> drop `-b …` and clone the default branch. `main` and the branch differ in
> their pnpm build-approval config, which can confuse a shared `node_modules` —
> see [SETUP.md](SETUP.md#troubleshooting).

Then open it, per environment:

### Environment: Claude Code desktop app

1. Install and sign in:
   [macOS](https://claude.ai/api/desktop/darwin/universal/dmg/latest/redirect) ·
   [Windows](https://claude.ai/api/desktop/win32/x64/setup/latest/redirect) ·
   [Linux (beta)](https://code.claude.com/docs/en/desktop-linux).
2. Open the built-in terminal with ``Ctrl+` `` and run the clone command above.
3. Click the **Code** tab → **Local** → **Select folder** → pick the
   `word-smash` directory. **On Windows choose WSL, not Local.**

### Environment: Claude Code VS Code extension

1. [Install the extension](vscode:extension/anthropic.claude-code), or press
   `Cmd+Shift+X` / `Ctrl+Shift+X`, search "Claude Code", **Install**. Needs
   VS Code 1.94+. Works in Cursor and other forks.
2. Clone and open in one go:

   ```bash
   git clone -b feat/content-pipeline-and-console https://github.com/tinsleygalyean/word-smash.git word-smash && code word-smash
   ```

   Opening the repo as your **workspace folder** is what makes this project's
   slash commands available. Opening a parent directory will not work.
3. Open the Claude panel: the Spark icon in the Activity Bar, or Command Palette
   (`Cmd+Shift+P` / `Ctrl+Shift+P`) → "Claude Code: Open in New Tab". Sign in.

### Environment: Claude Code CLI

```bash
curl -fsSL https://claude.ai/install.sh | bash
```

On Windows, run that inside WSL. (Native PowerShell install is
`irm https://claude.ai/install.ps1 | iex`, but see the Windows note in step 2.)

Then clone, enter the directory, and start Claude **from inside it**:

```bash
cd word-smash && claude
```

> Starting `claude` from your home directory instead of the repo is a common
> mistake. The slash commands will be missing and `pnpm` commands will fail with
> `ERR_PNPM_NO_PKG_MANIFEST`. Run `pwd` if unsure.

---

## Step 4 — Run setup

### Environments: desktop app, VS Code, CLI

Type this in the Claude prompt and send it:

```
/getstarted
```

That is it. Claude runs the whole sequence, reports what happened, and stops if
something needs you. **You will be asked to approve shell commands** — approving
`pnpm` commands during setup is expected.

What it does, in order:

| # | Command | Purpose |
|---|---|---|
| 1 | `pnpm preflight` | Audits Node, pnpm, git, zip/unzip, dependencies, native binaries, content, ZIPs, credentials |
| 2 | `pnpm install` | Workspace dependencies |
| 3 | `pnpm setup:native` | Your platform's build binaries. Required off linux-x64 |
| 4 | `pnpm run typecheck` + tests | Expect **9 test files, 124 tests passing** |
| 5 | `pnpm game:build` | Pulls content from the Google Sheet, builds the ZIPs |
| 6 | *optional* `pnpm env:init` | A CMS key. **Say no unless you upload releases** |

Every one of those is a plain command you can run yourself —
[SETUP.md](SETUP.md#the-manual-path) is the same sequence in prose.

If `/getstarted` stops on a failure, go to
[SETUP.md's troubleshooting table](SETUP.md#troubleshooting).

### Environment: Replit

Slash commands are a Claude Code feature and are not available in the Replit
workspace; Replit has its own agent. Run the sequence from the **Shell** instead:

```bash
pnpm preflight
```

Replit already installs dependencies, and `pnpm setup:native` is a **no-op**
there — Replit is linux-x64, which is the one platform the lockfile ships
binaries for. So you normally need only:

```bash
pnpm run typecheck && pnpm --filter @workspace/word-smash run test
```

```bash
pnpm game:build
```

---

## Step 5 — Build and play

### Environments: desktop app, VS Code, CLI

```
/console
```

That starts a local control panel on <http://localhost:23522>: a language
dropdown, a button for each of the four pipeline commands, live streamed output,
and the built game playing in a **phone-landscape frame** (19.5:9, 20:9, 16:9,
3:2).

How you see it depends on your environment:

| Environment | What happens |
|---|---|
| **Desktop app** | Opens in the app's Browser pane, next to your chat. Nothing to do |
| **VS Code** | No Browser pane exists. Claude hands you the URL — open it in your own browser |
| **CLI** | Same: open <http://localhost:23522> yourself |

It is a local server rather than a hosted page because it has to run real builds
on your machine.

Prefer a plain preview window with no control panel? `pnpm game:preview`
(port 23520).

### Environment: Replit

The console will not work here (loopback bind — see step 1). Instead, start the
Word Smash artifact's existing **managed workflow**, or use the Run button,
which `.replit` wires to the `Project` workflow. The game previews at `/`.

---

## The mental model

Three things are worth knowing before you change anything.

**Level content is not in the repository.** Words and levels live in the
[Word Smash levels sheet](https://docs.google.com/spreadsheets/d/1X_A1EnF4ySLp508donSBBKuL-mDYG4Ojlv7ItcWCXfo/edit),
one tab per language. `public/lang/<code>/wordsmash.json` is *generated* from it.
Edit the sheet, then rebuild. Hand-editing the JSON works right up until the
next build overwrites it. Reading the sheet needs no credentials.

**The game must work with no network.** It runs from a local `file://` WebView
inside Curious Reader. No `fetch()`, no `<audio>`, no CDN tags — every asset
loads through `XMLHttpRequest`, where `file://` returns status `0` on success.
The build *fails the release* if it finds a forbidden pattern.
[DECISIONS.md](../artifacts/word-smash/DECISIONS.md) has the reasoning.

**Uploads are gated on purpose.** `pnpm game:upload` dry-runs by default and
contacts nothing. A real upload needs credentials *and* a typed confirmation,
and only ever lands in the CMS development channel. Promotion and publishing are
a human decision made in the CMS.

## Try something

A good first task — end to end, and reversible:

1. Open the levels sheet and change a word's dashes — say `s-ea` to `se-a`.
2. Run `/console`, pick English, click **`pnpm game:build`**.
3. Watch it fail. The recordings for the new breakpoints do not exist, and the
   build names the exact MP3s it would need. That guard is the point: a word can
   never ship silent.
4. Undo your sheet edit and rebuild.

## When something breaks

1. Run `pnpm preflight` — it names the exact fix beside each problem.
2. Check the [troubleshooting table in SETUP.md](SETUP.md#troubleshooting).
3. Ask Claude in the panel. It can read the failure and this repo's docs
   directly.

## Where to read next

| Document | Read it for | Read this first |
|---|---|---|
| [CONTENT_PIPELINE.md](CONTENT_PIPELINE.md) | Sheet → JSON → ZIPs → CMS; adding a word or a language | This page |
| [SETUP.md](SETUP.md) | The manual setup path, the rationale, troubleshooting | This page |
| [specs/README.md](specs/README.md) | `PRD → DEVSPEC → UISPEC → TESTSPEC` | [README.md](../README.md) |
| [REPLIT_AGENT_PLAYBOOK.md](REPLIT_AGENT_PLAYBOOK.md) | How AI and humans split work here, and the approval gates | [README.md](../README.md) |

---

## Changelog

2026-09-04 — Claude & David Sturman — Noted that the pnpm version is pinned by
`package.json` and fetched by corepack, so no version choice is needed

2026-09-02 — Claude & David Sturman — Restructured into a single ordered setup
path; clone now precedes `/getstarted`; environment (Replit / desktop / VS Code
/ CLI) and OS (macOS / Windows / Ubuntu) instructions separated and labelled;
removed duplication with SETUP.md and README.md; documented that the console
cannot run on Replit

2026-08-31 — Claude & Tinsley Galyean — Initial onboarding guide for the desktop
app, the VS Code extension, and the CLI
