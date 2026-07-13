---
name: Word Smash container packaging
description: How Word Smash ships to the Curious Reader offline container — tier model, cr_event contract, and the deliberate engine-token override.
---

# Word Smash → Curious Reader container

Word Smash is a **Layout A (2-tier)** title: engine + language only, **no core
level** (`hasCoreLevel: false`, URL template `…/?cr_lang={lang}`). Engine slug
and `sub_app_id` are both `wordsmash`.

## Engine-token override (the one non-obvious decision)

The third-party spec freezes the engine-tier filename token as `-core`
(`<engine>-core.zip`). Word Smash **deliberately** ships its engine ZIP as
`wordsmash-eng.zip` instead.

**Why:** product owner chose the clearer `-eng` token over the spec's
counterintuitive `-core` (which, per the spec, names the *engine* tier, while
the *core* tier uses `-book-`). This is a real deviation from the frozen token.

**How to apply:** the Curious Learning CMS pipeline must be configured to
classify the `-eng` token as the engine tier for this game, or the upload will
be misclassified. Do not "fix" the script back to `-core` without confirming the
CMS mapping. Language ZIPs keep the spec's `-lang-<code>` token unchanged.

## cr_event contract (spec §6.2)

Post the JSON string `{ "type": "cr_event", "payload": {…} }` via
`window.ReactNativeWebView.postMessage`. Payload top-level fields are exact:
`payload_id` (fresh UUIDv4 per message — it's the dedup key), `cr_user_id`
(from launch URL, `""` if absent — never invent one), `sub_app_id`,
`payload_version: 1`, `collection` (`user_sessions_data` | `summary_data` only),
`timestamp` (ISO-8601 UTC), `data`, and `options` (**summary_data only** — must
be omitted for user_sessions_data). Ship the bridge in the standalone build;
do NOT stub it (it makes no network calls and is the only offline reporting
path). Fire-and-forget, exception-safe, silent no-op outside the container.

## Packaging

`pnpm --filter @workspace/word-smash run package:container [--lang <code>]`
rebuilds the standalone bundle and emits two ZIPs to `dist/container/`:
engine ZIP (index.html at root, no `lang/`, no `*.map`, excludes
`opengraph.jpg`/`robots.txt`) and `wordsmash-lang-<code>.zip` (only
`lang/<code>/`). The tile icon is uploaded *alongside* the language pack, never
packed inside the ZIP.

## MCP upload flow

`pnpm --filter @workspace/scripts run upload:wordsmash [-- --lang <code>]`
(`scripts/src/upload-wordsmash.ts`) regenerates the ZIPs, base64-encodes them +
the 512×512 tile icon (`artifacts/word-smash/upload/wordsmash-icon-512.png`),
and drives the CMS MCP tools in order: `list_inventory` → `upload_core_game`
(engine, `hasCoreLevel:false`) → `upload_language_pack` (+ `iconBase64`) →
`list_inventory`. Uses the official `@modelcontextprotocol/sdk`
`StreamableHTTPClientTransport` (stateless POST `<server>/mcp`, `Authorization:
Bearer`). Full guide + exact args in `artifacts/word-smash/UPLOAD.md`.

**Why dry-run matters:** creds (`CR_CMS_SERVER_URL`, `CR_MCP_API_KEY`) come from
the Curious Learning team and are NOT in secrets yet, so live upload/promotion is
externally blocked. The script reads creds from env only and no-ops with a clear
dry-run message when absent — never hard-code them. `promote_content` is
CL-staff-only; the script only surfaces item IDs.

**How to apply:** both `--lang english` and pnpm's `-- --lang english`
passthrough work (the parser skips a literal `--`) — same operator-confusion fix
the packager needed.
