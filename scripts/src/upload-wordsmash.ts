// Upload Word Smash to the Curious Reader CMS via its MCP endpoint (spec §8).
//
// Word Smash is a Layout A (2-tier) title: engine + language, NO core level.
// This script, in one flow:
//   1. (re)generates the container ZIPs via the Phase-1 packager
//      (`wordsmash-eng.zip` + `wordsmash-lang-<code>.zip`),
//   2. base64-encodes them and the tile icon, and
//   3. drives the four CMS MCP tools in order:
//        list_inventory → upload_core_game → upload_language_pack → list_inventory
//      then surfaces the returned item IDs for CL-staff promotion.
//
// Credentials come ONLY from the environment (never hard-coded):
//   CR_CMS_SERVER_URL   base URL of the CMS server (e.g. https://cms.example.org)
//   CR_MCP_API_KEY      MCP API key (sent as `Authorization: Bearer <key>`)
//   CR_URL_TEMPLATE     (optional) engine URL template; defaults below
// If either required var is absent the script performs a DRY RUN: it builds and
// encodes everything, prints exactly what it would send, and exits cleanly
// without contacting any server.
//
// Usage:
//   pnpm --filter @workspace/scripts run upload:wordsmash [-- --lang english] [--skip-build] [--dry-run]
//   tsx scripts/src/upload-wordsmash.ts --lang english

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

// ── Word Smash constants (agreed with the Curious Learning team) ──────────────
const ENGINE_SLUG = "wordsmash";
const TITLE = "Word Smash";
const HAS_CORE_LEVEL = false; // Layout A (2-tier)
const DEFAULT_URL_TEMPLATE = "https://wordsmash.curiouslearning.org/?cr_lang={lang}";

// English display names for a language new to the catalog (spec §8.4).
const LANG_DISPLAY: Record<string, { displayName: string; displayNameNative: string; languageInEnglishName: string }> = {
  english: { displayName: "English", displayNameNative: "English", languageInEnglishName: "English" },
};

// ── Paths ────────────────────────────────────────────────────────────────────
const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), "..", "..", "..");
const WORD_SMASH_DIR = path.join(REPO_ROOT, "artifacts", "word-smash");
const PACKAGER = path.join(WORD_SMASH_DIR, "scripts", "package-container.mjs");
const CONTAINER_DIR = path.join(WORD_SMASH_DIR, "dist", "container");
const ICON_PATH = path.join(WORD_SMASH_DIR, "upload", "wordsmash-icon-512.png");

interface Args {
  lang: string;
  build: boolean;
  forceDryRun: boolean;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { lang: "english", build: true, forceDryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--") continue; // tolerate the pnpm `--` passthrough separator
    else if (a === "--lang") args.lang = argv[++i];
    else if (a.startsWith("--lang=")) args.lang = a.slice("--lang=".length);
    else if (a === "--skip-build") args.build = false;
    else if (a === "--dry-run") args.forceDryRun = true;
    else throw new Error(`Unknown argument: ${a}`);
  }
  if (!args.lang || /[^a-z0-9_-]/.test(args.lang)) {
    throw new Error(`Invalid --lang "${args.lang}" (lowercase, no spaces)`);
  }
  return args;
}

function kb(bytes: number): string {
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function readBase64(file: string): { base64: string; bytes: number } {
  const buf = fs.readFileSync(file);
  return { base64: buf.toString("base64"), bytes: buf.byteLength };
}

// Best-effort extraction of a content-item id from an MCP tool result, whose
// exact shape is server-defined. Checks structuredContent first, then any
// JSON embedded in text content parts.
function extractItemId(result: unknown): string | undefined {
  const findId = (v: unknown): string | undefined => {
    if (!v || typeof v !== "object") return undefined;
    const o = v as Record<string, unknown>;
    if (typeof o.id === "string") return o.id;
    if (o.item && typeof o.item === "object") return findId(o.item);
    if (o.content && typeof o.content === "object") return findId(o.content);
    return undefined;
  };
  const r = result as Record<string, unknown> | null;
  if (!r) return undefined;
  const structured = findId(r.structuredContent);
  if (structured) return structured;
  const content = r.content;
  if (Array.isArray(content)) {
    for (const part of content) {
      if (part && typeof part === "object" && (part as Record<string, unknown>).type === "text") {
        const text = (part as Record<string, unknown>).text;
        if (typeof text === "string") {
          try {
            const id = findId(JSON.parse(text));
            if (id) return id;
          } catch {
            /* not JSON — ignore */
          }
        }
      }
    }
  }
  return undefined;
}

function resultText(result: unknown): string {
  const r = result as Record<string, unknown> | null;
  const content = r?.content;
  if (Array.isArray(content)) {
    const parts = content
      .filter((p) => p && typeof p === "object" && (p as Record<string, unknown>).type === "text")
      .map((p) => (p as Record<string, unknown>).text as string);
    if (parts.length) return parts.join("\n");
  }
  return JSON.stringify(result, null, 2);
}

async function main(): Promise<void> {
  const { lang, build, forceDryRun } = parseArgs(process.argv.slice(2));

  const engineZip = path.join(CONTAINER_DIR, `${ENGINE_SLUG}-eng.zip`);
  const langZip = path.join(CONTAINER_DIR, `${ENGINE_SLUG}-lang-${lang}.zip`);
  const engineFilename = path.basename(engineZip);
  const langFilename = path.basename(langZip);

  const display = LANG_DISPLAY[lang];
  if (!display) {
    throw new Error(
      `No display names configured for lang "${lang}". Add an entry to LANG_DISPLAY (displayName / displayNameNative / languageInEnglishName).`,
    );
  }

  // ── 1. (Re)generate the ZIPs ───────────────────────────────────────────────
  if (build) {
    console.log(`▶ Regenerating container ZIPs (--lang ${lang})…`);
    execFileSync("node", [PACKAGER, "--lang", lang], { stdio: "inherit" });
  } else {
    console.log("▶ Skipping build (--skip-build); using existing ZIPs.");
  }

  for (const f of [engineZip, langZip]) {
    if (!fs.existsSync(f)) {
      throw new Error(`Missing ZIP: ${f}. Run without --skip-build to generate it.`);
    }
  }
  if (!fs.existsSync(ICON_PATH)) {
    throw new Error(`Missing tile icon: ${ICON_PATH}`);
  }

  // ── 2. Encode ──────────────────────────────────────────────────────────────
  const engine = readBase64(engineZip);
  const langPack = readBase64(langZip);
  const icon = readBase64(ICON_PATH);

  const urlTemplate = process.env.CR_URL_TEMPLATE ?? DEFAULT_URL_TEMPLATE;
  const serverUrlRaw = process.env.CR_CMS_SERVER_URL?.trim();
  const apiKey = process.env.CR_MCP_API_KEY?.trim();
  const isDryRun = forceDryRun || !serverUrlRaw || !apiKey;

  console.log("\n── Word Smash upload plan ──────────────────────────────────");
  console.log(`  engineSlug:    ${ENGINE_SLUG}`);
  console.log(`  title:         ${TITLE}`);
  console.log(`  urlTemplate:   ${urlTemplate}`);
  console.log(`  hasCoreLevel:  ${HAS_CORE_LEVEL}`);
  console.log(`  langCode:      ${lang}`);
  console.log(`  displayName:   ${display.displayName} / native ${display.displayNameNative} / english ${display.languageInEnglishName}`);
  console.log(`  engine ZIP:    ${engineFilename}  (${kb(engine.bytes)}, base64 ${kb(engine.base64.length)})`);
  console.log(`  lang ZIP:      ${langFilename}  (${kb(langPack.bytes)}, base64 ${kb(langPack.base64.length)})`);
  console.log(`  icon:          ${path.basename(ICON_PATH)}  (${kb(icon.bytes)}, base64 ${kb(icon.base64.length)})`);
  console.log("────────────────────────────────────────────────────────────");

  if (isDryRun) {
    console.log("\n⚠ DRY RUN — no server contacted.");
    if (!serverUrlRaw || !apiKey) {
      console.log("  Reason: CR_CMS_SERVER_URL and/or CR_MCP_API_KEY are not set.");
      console.log("  Ask the Curious Learning team for the CMS server URL and an MCP API key,");
      console.log("  add them as secrets, then re-run this script to perform the live upload.");
    } else {
      console.log("  Reason: --dry-run was passed.");
    }
    console.log("\n  Would call, in order:");
    console.log("    1. list_inventory()");
    console.log(`    2. upload_core_game({ engineSlug, title, urlTemplate, hasCoreLevel:${HAS_CORE_LEVEL}, filename:"${engineFilename}", zipBase64 })`);
    console.log(`    3. upload_language_pack({ engineSlug, langCode:"${lang}", displayName, displayNameNative, languageInEnglishName, filename:"${langFilename}", zipBase64, iconBase64 })`);
    console.log("    4. list_inventory()  → confirm both items appear as `development`");
    console.log("\n  Promotion (promote_content) is Curious-Learning-staff-only and is NOT performed here.");
    return;
  }

  // ── 3. Live upload over MCP (Streamable HTTP, stateless) ────────────────────
  const base = serverUrlRaw.replace(/\/+$/, "");
  const mcpUrl = new URL(base.endsWith("/mcp") ? base : `${base}/mcp`);
  console.log(`\n▶ Connecting to MCP endpoint ${mcpUrl.origin}${mcpUrl.pathname}…`);

  const transport = new StreamableHTTPClientTransport(mcpUrl, {
    requestInit: { headers: { Authorization: `Bearer ${apiKey}` } },
  });
  const client = new Client({ name: "wordsmash-uploader", version: "1.0.0" });

  try {
    await client.connect(transport);

    console.log("\n▶ list_inventory (before)…");
    const before = await client.callTool({ name: "list_inventory", arguments: {} });
    console.log(resultText(before));

    console.log(`\n▶ upload_core_game (engine ${engineFilename})…`);
    const engineRes = await client.callTool({
      name: "upload_core_game",
      arguments: {
        engineSlug: ENGINE_SLUG,
        title: TITLE,
        urlTemplate,
        hasCoreLevel: HAS_CORE_LEVEL,
        filename: engineFilename,
        zipBase64: engine.base64,
      },
    });
    console.log(resultText(engineRes));
    const engineId = extractItemId(engineRes);

    console.log(`\n▶ upload_language_pack (${lang} + icon)…`);
    const langRes = await client.callTool({
      name: "upload_language_pack",
      arguments: {
        engineSlug: ENGINE_SLUG,
        langCode: lang,
        displayName: display.displayName,
        displayNameNative: display.displayNameNative,
        languageInEnglishName: display.languageInEnglishName,
        filename: langFilename,
        zipBase64: langPack.base64,
        iconBase64: icon.base64,
      },
    });
    console.log(resultText(langRes));
    const langId = extractItemId(langRes);

    console.log("\n▶ list_inventory (after)…");
    const after = await client.callTool({ name: "list_inventory", arguments: {} });
    console.log(resultText(after));

    console.log("\n✅ Upload complete. Items landed in the `development` channel.");
    console.log("   Item IDs for Curious-Learning-staff promotion (promote_content):");
    console.log(`     engine (${ENGINE_SLUG}):        ${engineId ?? "<see upload_core_game response above>"}`);
    console.log(`     lang (${lang}):        ${langId ?? "<see upload_language_pack response above>"}`);
    console.log("   Promotion to production is staff-only and is NOT performed by this script.");
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error(`\n❌ ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
