# Word Smash content pipeline

**Status:** Active · **Last updated:** 2026-08-31

How level content gets from the Google Sheet into a release, onto a device, and
into the CMS. Four commands cover the whole path.

The sheet is the **source of truth** for levels and words. `wordsmash.json` is a
generated file: edit the sheet, run the build, commit the result. Hand-editing
the JSON works until the next build overwrites it.

---

## The source sheet

**[Word Smash levels](https://docs.google.com/spreadsheets/d/1X_A1EnF4ySLp508donSBBKuL-mDYG4Ojlv7ItcWCXfo/edit)**
— one tab per language, plus a `Notes` tab. The sheet ID and the tab for each
language live in [`artifacts/word-smash/content.config.json`](../artifacts/word-smash/content.config.json).

Each content row is three columns; everything to the right is the team's own
audio-tracking notes and is ignored by the build.

| Column | Meaning |
|---|---|
| `level` | Level number. Levels play in order, starting at 1. |
| `word` | The word, with a dash at each breakpoint: `s-ea`, `cac-tus`, `m-o-n-k-ey`. |
| `ghost` | `y` or `n` — whether slots show outline hints. One value per level. |

Rows sharing a level number form one group and play in random order, so the row
order inside a level does not matter.

The dashes are the whole design: they are the breakpoints the hammer smashes
along, so `cac-tus` (syllables) and `c-a-c-t-u-s` (letters) are two different
levels built from the same word.

---

## The four commands

Run from the repository root. Requires Node 24 and pnpm — first time on a
new machine, follow [SETUP.md](SETUP.md).

```bash
pnpm content:build          # sheet → language JSON, with validation
pnpm game:build             # content + engine ZIP + language ZIPs
pnpm game:preview           # play and test a built language locally
pnpm game:upload            # send to the CMS (dry run unless --live)
```

`game:build` runs `content:build` for you, so the everyday loop after a sheet
edit is **`pnpm game:build` → `pnpm game:preview` → `pnpm game:upload -- --live`**.

### Or drive them from the console

```bash
pnpm game:console        # http://localhost:23522 — or type /console in Claude Code
```

A local control panel with a language dropdown, a button per command, live
output, and the built game playing in a phone-landscape frame (19.5:9, 20:9,
16:9, 3:2). It has to run locally rather than as a published Artifact: an
Artifact is a sandboxed page on claude.ai and cannot run a build on your machine.

The console runs the CMS upload as a **dry run only** — a live upload keeps its
typed confirmation and stays a terminal step.

### 1. `pnpm content:build` — pull the sheet

Fetches each language tab as CSV, validates it, and writes
`artifacts/word-smash/public/lang/<code>/wordsmash.json`.

```bash
pnpm content:build                       # every configured language
pnpm content:build -- --lang english     # one language
pnpm content:build -- --check            # validate only; fails on drift
```

No credentials are needed — the sheet is link-shared for viewing and the build
reads its public CSV export. This is a build-time network call and has nothing
to do with the game's offline rule; nothing here ships in the bundle.

Other flags: `--from-csv <file>` builds from a saved CSV export instead of
fetching (use when offline, or to test a change before editing the live sheet);
`--snapshot` also saves the fetched CSV next to the JSON.

Use `--check` in CI or before a release to catch a sheet edit that nobody rebuilt.

### 2. `pnpm game:build` — engine and language files

Refreshes content, builds the offline bundle once, then emits the upload ZIPs
into `artifacts/word-smash/dist/container/` and runs the offline integrity check
on each:

| File | Tier | Contents |
|---|---|---|
| `wordsmash-eng.zip` | engine | `index.html`, JS/CSS, fonts, favicon — no language data |
| `wordsmash-lang-<code>.zip` | language | only `lang/<code>/` — the JSON and every MP3 |

```bash
pnpm game:build                          # every language
pnpm game:build -- --lang english        # one language
pnpm game:build -- --skip-content        # use the committed JSON as-is
```

### 3. `pnpm game:preview` — play and test any language

Runs the offline integrity check for the language, then serves
`dist/standalone` — **the same files that go into the ZIPs**, not the Vite dev
server — so what you play is what ships.

```bash
pnpm game:preview                        # english at http://localhost:23520
pnpm game:preview -- --lang english --port 3000
```

Add `&reset=1` to the URL to wipe saved progress and start at level 1. For a
shareable link instead of a local server, `pnpm game:artifact` packs the whole
game — audio and all — into one self-contained HTML file (see below).

For the full test suite rather than a visual pass:

```bash
pnpm --filter @workspace/word-smash run test      # 124 unit/component tests
pnpm run typecheck
```

### 4. `pnpm game:upload` — send to the CMS

Uploads the engine and each language pack to the Curious Reader CMS
**development channel** for human review. It does not promote or publish.

```bash
pnpm game:upload                         # dry run — builds, prints the plan, sends nothing
pnpm game:upload -- --lang english       # one language
pnpm game:upload -- --live               # real upload, after typed confirmation
```

**This command dry-runs by default.** `--live` requires both credentials in the
environment and a typed `upload` confirmation.

#### The CMS token

Two environment variables, from the Curious Learning team:

| Variable | What it is |
|---|---|
| `CR_CMS_SERVER_URL` | Base URL of the CMS MCP server |
| `CR_MCP_API_KEY` | MCP API key, sent as `Authorization: Bearer <key>` |

Set them yourself where the command runs. Locally the simplest path is the
git-ignored `.env` at the repository root:

```
CR_CMS_SERVER_URL=https://curious-learning-parent.replit.app/mcp
CR_MCP_API_KEY=<paste the key here>
```

`game:upload` reads that file automatically via Node's built-in env-file parser
(no dependency). Real environment variables always win over the file, so CI and
Replit Secrets take precedence. An empty value counts as unset, so a half-filled
`.env` reports `NOT set` rather than failing deep inside the upload. `.env` and
`.env.*` are git-ignored — keep it that way.

On Replit, use the Secrets panel instead of a file. Then:

```bash
pnpm game:upload -- --live
```

Note that `.env` is read by `game:upload` only. Running the underlying
`upload:wordsmash` script directly does not load it — export the variables in
your shell, or use `node --env-file=.env`, if you call that script by hand.

Rules that are not negotiable:

- **Never paste the token into a chat, a commit, an issue, or a screenshot** —
  including to an AI assistant. Anything in a prompt is out of your control.
- Do not pass it as a command-line argument; it lands in your shell history.
- The upload command prints only whether each variable is **set**, never its value.
- If a token is ever exposed, treat it as compromised and ask for a rotation.

Promotion and publishing stay outside this pipeline entirely — a Curious
Learning reviewer tests the tile in the CMS and makes that call.
See [UPLOAD.md](../artifacts/word-smash/UPLOAD.md) for the operator sequence.

---

## What the build derives, and what it will not invent

`id`, `display`, `units`, and every audio path are derived from the sheet's
dashed word. Audio filenames follow one rule, and the build is its only author:

```
audios/<word>_slow.mp3        the whole word, slowly
audios/<word>_natural.mp3     the whole word, natural pace
audios/<word>_<unit>.mp3      one per unit, in order
```

A unit that repeats inside a word gets a 1-based suffix so each occurrence has
its own recording: `cactus` → `c-a-c-t-u-s` → `cactus_c1`, `cactus_a`,
`cactus_c2`, `cactus_t`, `cactus_u`, `cactus_s`.

**The build never generates audio.** Recordings are made separately
(ElevenLabs, from phonetic spellings so a unit is always spoken as its *sound* —
`/b/` = "buh", never the letter name "bee"). If the sheet references a recording
that is not on disk, the build fails and lists the exact filenames needed.

### Adding a word

1. Add the row to the language tab, dashes at the breakpoints.
2. Run `pnpm content:build`. It fails and names the missing MP3s.
3. Produce those recordings into `public/lang/<code>/audios/`, following the
   phoneme-sound rule above.
4. Re-run `pnpm game:build`, then preview and listen to the new word.

### Adding a language

1. Add a tab to the sheet, same three columns.
2. Add an entry to `content.config.json`: `"spanish": { "tab": "Spanish" }`.
3. Add the recordings under `public/lang/spanish/audios/`.
4. Add the language's display names to `LANG_DISPLAY` in
   [`scripts/src/upload-wordsmash.ts`](../scripts/src/upload-wordsmash.ts) —
   the CMS needs them for a language new to the catalog.
5. `pnpm game:build` → `pnpm game:preview -- --lang spanish` → `pnpm game:upload`.

---

## Validation

`content:build` collects every problem and reports them together, rather than
stopping at the first. It refuses to write a pack that fails any of these:

| Check | Why |
|---|---|
| Level is a whole number ≥ 1 | Levels are ordered and 1-based |
| Levels contiguous from 1 | A gap strands the player mid-progression |
| `ghost` is `y` or `n`, consistent within a level | Ghost is a per-level mode |
| Word is lowercase, no whitespace | Word text is rendered as-is |
| Word has at least one dash, no empty units | No dash means nothing to smash |
| No duplicate word within a level | Would appear twice in one group |
| Every referenced MP3 exists | A missing file plays as silence on device |
| No absolute audio URLs | Breaks `file://` loading on device |

Warnings (build still succeeds): a level with fewer than two words, and
recordings on disk that nothing references any more.

---

## Sharing a build as a single file

`pnpm game:artifact` packs `dist/standalone` into one self-contained HTML file
at `dist/artifact/word-smash-<lang>.html` — the language pack, all MP3s, and the
font embedded as base64, with a small `XMLHttpRequest` shim that serves them
from memory.

```bash
pnpm game:artifact -- --lang english
```

This works precisely *because* of the offline rule: the game already loads every
runtime asset through XHR, so the single-file build needs no game source changes
and is produced from the same `dist/standalone/` output that ships to devices.
Useful for a review link or a Claude Artifact. It is **not** the device delivery
format — devices get the ZIPs from `game:build`.

---

## Related documents

- [Specs index](specs/README.md) — the `PRD → DEVSPEC → UISPEC → TESTSPEC` chain
- [DEVSPEC](specs/DEVSPEC.md) — authoritative behavior, schemas, offline rules
- [DECISIONS](../artifacts/word-smash/DECISIONS.md) — why the offline constraints exist
- [UPLOAD](../artifacts/word-smash/UPLOAD.md) — CMS operator sequence and approval boundary
- [AI playbook](REPLIT_AGENT_PLAYBOOK.md) — approval gates and verification expectations

Other source documents named in the original build prompt:
[Game Design Document v3.0](https://docs.google.com/document/d/1TH3G68bQXPSZQMiz5dDX9QtxI3nFIoqXRRPgB2GAZ3Q/edit)
and the [Curious Reader Third-Party Game Spec v1.1](https://drive.google.com/file/d/1311hplshajQa9kqUhCqMxZqIhx7sobx2/view)
(checked in at `attached_assets/third-party-game-spec_(3)_1787166445025.md`).

---

## Changelog

2026-08-31 — Claude & Tinsley Galyean — Initial pipeline documented; sheet-driven
content build, release build, preview, and CMS upload commands added
