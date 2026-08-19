# Word Smash — Curious Reader upload guide

How to upload Word Smash to the Curious Reader CMS through its **MCP endpoint**
(third-party game spec §8). This is a **development-only** process: it uploads
an engine version and one language pack for human review, then stops. Word Smash
is a **Layout A (2-tier)** title: an engine tier plus one language tier, **no
core level**.

## What you need from the Curious Learning team (external prerequisites)

The live upload is **blocked** until CL provides:

1. **CMS server base URL** — e.g. `https://cms.curiouslearning.org`.
2. **An MCP API key** — sent as `Authorization: Bearer <key>`.
3. **Sign-off** on the engine slug / `sub_app_id` (`wordsmash`) and the language
   code (`english`).

Until these arrive you can still run the script — it performs a **dry run**
(builds and encodes everything, prints the exact plan, contacts no server).

## One-time setup: add the credentials as secrets

Add these as Replit secrets (never commit them):

| Secret | Value |
|---|---|
| `CR_CMS_SERVER_URL` | the CMS base URL (with or without a trailing `/mcp`) |
| `CR_MCP_API_KEY` | the MCP API key from CL |
| `CR_URL_TEMPLATE` | *(optional)* overrides the default engine URL template |

The script reads these from the environment only; nothing is hard-coded. If
either required secret is missing it no-ops with a dry-run message.

## Run it

```bash
# Dry run (no creds needed) — builds ZIPs, prints the plan, contacts nothing:
pnpm --filter @workspace/scripts run upload:wordsmash -- --lang english --dry-run

# Live upload (requires the two secrets above):
pnpm --filter @workspace/scripts run upload:wordsmash -- --lang english
```

Flags: `--lang <code>` (default `english`), `--skip-build` (reuse existing ZIPs),
`--dry-run` (force dry run even when creds are set).

The script, in one flow:

1. regenerates the container ZIPs via the Phase-1 packager
   (`wordsmash-eng.zip` + `wordsmash-lang-<code>.zip` in `dist/container/`),
2. base64-encodes the two ZIPs and the tile icon, and
3. uploads the engine and language ZIPs through chunked MCP sessions (with a
   SHA-256 integrity check), then verifies the development inventory.

It intentionally **does not call** `promote_content`, `update_manifest`, or any
production Publish action. A Curious Learning reviewer must test the assembled
development tile and decide whether to promote it later.

## The MCP sequence and exact Word Smash arguments

Server: `POST <CR_CMS_SERVER_URL>/mcp` (Streamable HTTP, stateless), name
`curious-reader-cms`. Tools called in order:

1. **`list_inventory`** — `{}` (survey before upload).
2. **`begin_upload` + `upload_chunk`** — create an engine upload session using
   `{ filename: "wordsmash-eng.zip", totalSize }`, then append sequential
   `{ uploadId, chunkIndex, dataBase64 }` chunks.
3. **`upload_core_game`** — consume the completed engine session:
   | arg | value |
   |---|---|
   | `engineSlug` | `wordsmash` |
   | `title` | `Word Smash` |
   | `urlTemplate` | `https://wordsmash.curiouslearning.org/?cr_lang={lang}` (query is what matters; override via `CR_URL_TEMPLATE`) |
   | `hasCoreLevel` | `false` (Layout A) |
   | `filename` | `wordsmash-eng.zip` |
   | `uploadId` | ID returned by `begin_upload` after all engine chunks arrive |
   | `sha256` | SHA-256 hex digest of the local engine ZIP |
4. **`begin_upload` + `upload_chunk`** — create a language upload session using
   `{ filename: "wordsmash-lang-english.zip", totalSize }`, then append its
   sequential chunks.
5. **`upload_language_pack`** — consume the completed language session and add
   the tile icon:
   | arg | value |
   |---|---|
   | `engineSlug` | `wordsmash` |
   | `langCode` | `english` |
   | `displayName` | `English` |
   | `displayNameNative` | `English` |
   | `languageInEnglishName` | `English` |
   | `filename` | `wordsmash-lang-english.zip` |
   | `uploadId` | ID returned by `begin_upload` after all language chunks arrive |
   | `sha256` | SHA-256 hex digest of the local language ZIP |
   | `iconBase64` | base64 of `upload/wordsmash-icon-512.png` |
6. **`list_inventory`** — `{}` again. The script fails unless the exact item IDs
   returned by both upload calls appear with the expected filenames, engine,
   language, icon, and `development` status.

The script prints the returned **item IDs** for the engine and language pack.

## The tile icon

- Source: `attached_assets/wordsmash-icon-1024_1783970692500.png` (1024×1024).
- Upload asset: `artifacts/word-smash/upload/wordsmash-icon-512.png` — a true
  PNG, 512×512 (spec §4 recommends 512×512 square true-PNG). `file` reports
  `PNG image data`.
- The icon is uploaded **alongside** the language pack (`iconBase64`); it is
  **never** packed inside a ZIP.

## Verify in development, then stop

After upload, confirm the items landed:

- `list_inventory` shows the `wordsmash` engine and the `english` pack as
  `development`, **or**
- check the development manifest:
  `GET <CR_CMS_SERVER_URL>/api/manifest?channel=development` — the Word Smash
  tile should list its `eng` + `lang-english` ZIPs.

The uploader stops here. **Do not promote or publish automatically.** A Curious
Learning reviewer must test the development tile in the CMS before any authorized
person makes a later, deliberate decision to promote it. Production devices
remain unchanged until a human promotes all tiers and completes the separate CMS
Publish action.

## Adding more languages later

Run the script with a different `--lang <code>` (the packager emits one
`wordsmash-lang-<code>.zip` per language). Add the new code's display names to
`LANG_DISPLAY` in `scripts/src/upload-wordsmash.ts` and provide a per-tile icon.
