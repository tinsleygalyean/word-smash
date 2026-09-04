// Upload every Word Smash language to the Curious Reader CMS.
//
// Thin orchestrator over `upload-wordsmash.ts`: it reads the language list from
// artifacts/word-smash/content.config.json and runs the existing, reviewed
// upload flow once per language. All CMS behaviour, argument shapes, and
// verification live in that script — this one only decides WHAT to send.
//
// SAFETY — this command dry-runs unless you ask for a live upload:
//   * without `--live` it always passes --dry-run: everything is built and
//     encoded, and the exact calls are printed, but no server is contacted.
//   * with `--live` it requires CR_CMS_SERVER_URL and CR_MCP_API_KEY in the
//     environment and pauses for a typed confirmation first.
// Uploading places items in the CMS *development* channel for human review.
// It never promotes or publishes — that stays a separate human decision.
//
// Credentials come only from the environment. Never paste a token into a chat,
// a commit, or a command line; export it in your shell or the platform's secret
// manager. This script prints only whether a variable is set, never its value.
//
// Usage:
//   pnpm game:upload                          dry run, every language
//   pnpm game:upload -- --lang english        dry run, one language
//   pnpm game:upload -- --live                real upload, after confirmation
//   pnpm game:upload -- --live --yes          real upload, no prompt (CI)

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline/promises";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), "..", "..", "..");
const WORD_SMASH_DIR = path.join(REPO_ROOT, "artifacts", "word-smash");
const CONFIG_PATH = path.join(WORD_SMASH_DIR, "content.config.json");
const UPLOADER = path.join(REPO_ROOT, "scripts", "src", "upload-wordsmash.ts");
const ENV_FILE = path.join(REPO_ROOT, ".env");

// Load credentials from an untracked .env at the repo root, if present, so they
// don't have to be exported by hand every session. Uses Node's built-in env-file
// parser (Node 20.6+) — no dependency, nothing new in the supply chain.
// Real environment variables win: an already-set value is never overwritten, so
// CI and Replit Secrets take precedence over a stale local file.
function loadEnvFile(): boolean {
  if (!fs.existsSync(ENV_FILE)) return false;
  const before = { ...process.env };
  try {
    process.loadEnvFile(ENV_FILE);
  } catch (err) {
    console.error(`⚠ Could not read .env: ${err instanceof Error ? err.message : String(err)}`);
    return false;
  }
  for (const [k, v] of Object.entries(before)) {
    if (v !== undefined) process.env[k] = v;
  }
  // An empty value is the same as unset — a half-filled .env should not read as
  // "configured" and then fail deep inside the upload.
  for (const k of ["CR_CMS_SERVER_URL", "CR_MCP_API_KEY", "CR_URL_TEMPLATE"]) {
    if (process.env[k]?.trim() === "") delete process.env[k];
  }
  return true;
}

interface Args {
  lang: string | null;
  live: boolean;
  yes: boolean;
  build: boolean;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { lang: null, live: false, yes: false, build: true };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--") continue;
    else if (a === "--live") args.live = true;
    else if (a === "--yes" || a === "-y") args.yes = true;
    else if (a === "--skip-build") args.build = false;
    else if (a === "--dry-run") args.live = false;
    else if (a === "--lang") args.lang = argv[++i];
    else if (a.startsWith("--lang=")) args.lang = a.slice("--lang=".length);
    else throw new Error(`Unknown argument: ${a}`);
  }
  if (args.lang && /[^a-z0-9_-]/.test(args.lang)) {
    throw new Error(`Invalid --lang "${args.lang}" (lowercase, no spaces)`);
  }
  return args;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8")) as {
    languages: Record<string, { tab: string }>;
  };

  const langs = args.lang ? [args.lang] : Object.keys(config.languages);
  for (const l of langs) {
    if (!config.languages[l]) {
      throw new Error(
        `Language "${l}" is not in content.config.json (known: ${Object.keys(config.languages).join(", ")})`
      );
    }
  }

  const usedEnvFile = loadEnvFile();
  const hasUrl = Boolean(process.env.CR_CMS_SERVER_URL);
  const hasKey = Boolean(process.env.CR_MCP_API_KEY);

  console.log("╔══════════════════════════════════════════════════════╗");
  console.log("║  Word Smash — CMS upload                             ║");
  console.log("╚══════════════════════════════════════════════════════╝");
  console.log(`  languages         : ${langs.join(", ")}`);
  console.log(`  credentials from  : ${usedEnvFile ? ".env + environment" : "environment"}`);
  // Only ever report presence. The values are secrets and must not be printed,
  // logged, or echoed back into a chat.
  console.log(`  CR_CMS_SERVER_URL : ${hasUrl ? "set" : "NOT set"}`);
  console.log(`  CR_MCP_API_KEY    : ${hasKey ? "set" : "NOT set"}`);
  console.log(`  mode              : ${args.live ? "LIVE UPLOAD" : "dry run (no server contacted)"}`);

  if (args.live && (!hasUrl || !hasKey)) {
    console.error(
      `\n❌ --live needs both CR_CMS_SERVER_URL and CR_MCP_API_KEY in the environment.\n` +
        `   Set them in your shell or the platform's secret manager, then re-run.\n` +
        `   Do not pass a token on the command line — it lands in your shell history.\n`
    );
    process.exit(1);
  }

  if (args.live && !args.yes) {
    console.log(
      `\n  This uploads the engine and ${langs.length} language pack(s) to the CMS\n` +
        `  development channel for human review. It does not publish or promote.`
    );
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const answer = (await rl.question(`\n  Type "upload" to continue: `)).trim();
    rl.close();
    if (answer !== "upload") {
      console.log("\n  Cancelled — nothing was sent.\n");
      process.exit(0);
    }
  }

  // The engine ZIP is identical for every language and each run re-sends it
  // under the same engineSlug, so multi-language runs update the same engine
  // item rather than creating duplicates.
  const failures: string[] = [];
  for (const lang of langs) {
    console.log(`\n\x1b[1m━━ ${lang} ${"━".repeat(46)}\x1b[0m`);
    const uploaderArgs = [UPLOADER, "--lang", lang];
    if (!args.build) uploaderArgs.push("--skip-build");
    if (!args.live) uploaderArgs.push("--dry-run");
    try {
      execFileSync("npx", ["tsx", ...uploaderArgs], { cwd: REPO_ROOT, stdio: "inherit" });
    } catch {
      failures.push(lang);
    }
  }

  if (failures.length) {
    console.error(`\n❌ Failed: ${failures.join(", ")}\n`);
    process.exit(1);
  }

  if (args.live) {
    console.log(`\n✅ Uploaded ${langs.length} language(s) to the CMS development channel.`);
    console.log(`   Next: a human reviews them in the CMS and decides on promotion.\n`);
  } else {
    console.log(`\n✅ Dry run complete for ${langs.length} language(s) — nothing was sent.`);
    console.log(`   To upload for real: pnpm game:upload -- --live\n`);
  }
}

main().catch((err) => {
  console.error(`\n❌ ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
