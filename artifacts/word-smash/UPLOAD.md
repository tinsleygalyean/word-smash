# Word Smash — Curious Reader upload guide

How to upload Word Smash to the Curious Reader CMS through its **MCP endpoint**
(third-party game spec §8). Word Smash is a **Layout A (2-tier)** title: an
engine tier plus one language tier, **no core level**.

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
3. drives the four CMS MCP tools in order and prints the results.

## The MCP sequence and exact Word Smash arguments

Server: `POST <CR_CMS_SERVER_URL>/mcp` (Streamable HTTP, stateless), name
`curious-reader-cms`. Tools called in order:

1. **`list_inventory`** — `{}` (survey before upload).
2. **`upload_core_game`** — the engine tier:
   | arg | value |
   |---|---|
   | `engineSlug` | `wordsmash` |
   | `title` | `Word Smash` |
   | `urlTemplate` | `https://wordsmash.curiouslearning.org/?cr_lang={lang}` (query is what matters; override via `CR_URL_TEMPLATE`) |
   | `hasCoreLevel` | `false` (Layout A) |
   | `filename` | `wordsmash-eng.zip` |
   | `zipBase64` | base64 of the engine ZIP |
3. **`upload_language_pack`** — the language tier + tile icon:
   | arg | value |
   |---|---|
   | `engineSlug` | `wordsmash` |
   | `langCode` | `english` |
   | `displayName` | `English` |
   | `displayNameNative` | `English` |
   | `languageInEnglishName` | `English` |
   | `filename` | `wordsmash-lang-english.zip` |
   | `zipBase64` | base64 of the language ZIP |
   | `iconBase64` | base64 of `upload/wordsmash-icon-512.png` |
4. **`list_inventory`** — `{}` again; confirm the engine and English pack now
   appear with status `development`.

The script prints the returned **item IDs** for the engine and language pack.

## The tile icon

- Source: `attached_assets/wordsmash-icon-1024_1783970692500.png` (1024×1024).
- Upload asset: `artifacts/word-smash/upload/wordsmash-icon-512.png` — a true
  PNG, 512×512 (spec §4 recommends 512×512 square true-PNG). `file` reports
  `PNG image data`.
- The icon is uploaded **alongside** the language pack (`iconBase64`); it is
  **never** packed inside a ZIP.

## Verify, then promotion (staff-only)

After upload, confirm the items landed:

- `list_inventory` shows the `wordsmash` engine and the `english` pack as
  `development`, **or**
- check the development manifest:
  `GET <CR_CMS_SERVER_URL>/api/manifest?channel=development` — the Word Smash
  tile should list its `eng` + `lang-english` ZIPs.

**Promotion to production (`promote_content`) is Curious-Learning-staff-only.**
This script does not promote; it surfaces the item IDs for CL staff to promote
(engine first, then the language pack). A tile appears on devices only once all
of its tiers have a production version.

## Adding more languages later

Run the script with a different `--lang <code>` (the packager emits one
`wordsmash-lang-<code>.zip` per language). Add the new code's display names to
`LANG_DISPLAY` in `scripts/src/upload-wordsmash.ts` and provide a per-tile icon.
