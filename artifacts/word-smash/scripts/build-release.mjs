#!/usr/bin/env node
// Build a complete Word Smash release: refresh content from the sheet, rebuild
// the offline bundle once, then emit the engine ZIP and one language ZIP per
// language — running the offline integrity check on each.
//
// This is the "make me a new version of the engine and language files" command.
// It is the only build step needed before previewing or uploading.
//
// Usage:
//   node scripts/build-release.mjs [--lang <code>|--all] [--skip-content]
//   pnpm game:build            (all languages, content refreshed from the sheet)
//   pnpm game:build -- --lang english --skip-content
//
// Outputs into dist/:
//   standalone/                     offline bundle (relative paths, file://)
//   container/wordsmash-eng.zip     engine tier
//   container/wordsmash-lang-*.zip  one per language

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ARTIFACT_DIR = path.resolve(fileURLToPath(import.meta.url), "..", "..");
const SCRIPTS_DIR = path.join(ARTIFACT_DIR, "scripts");
const CONFIG_PATH = path.join(ARTIFACT_DIR, "content.config.json");
const CONTAINER_DIR = path.join(ARTIFACT_DIR, "dist", "container");

function parseArgs(argv) {
  const args = { lang: null, all: false, content: true };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--") continue;
    else if (a === "--all") args.all = true;
    else if (a === "--skip-content") args.content = false;
    else if (a === "--lang") args.lang = argv[++i];
    else if (a.startsWith("--lang=")) args.lang = a.slice("--lang=".length);
    else throw new Error(`Unknown argument: ${a}`);
  }
  if (!args.lang) args.all = true;
  return args;
}

function run(cmd, cmdArgs) {
  execFileSync(cmd, cmdArgs, { cwd: ARTIFACT_DIR, stdio: "inherit" });
}
const node = (script, scriptArgs) => run("node", [path.join(SCRIPTS_DIR, script), ...scriptArgs]);

function step(n, total, title) {
  console.log(`\n\x1b[1m━━ ${n}/${total} ${title} ${"━".repeat(Math.max(0, 46 - title.length))}\x1b[0m`);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
  const langs = args.all ? Object.keys(config.languages) : [args.lang];

  for (const l of langs) {
    if (!config.languages[l]) {
      throw new Error(
        `Language "${l}" is not in content.config.json (known: ${Object.keys(config.languages).join(", ")})`
      );
    }
  }

  const total = args.content ? 3 : 2;
  let n = 0;

  if (args.content) {
    step(++n, total, "Refresh content from the Google Sheet");
    node("build-content.mjs", args.all ? ["--all"] : ["--lang", args.lang]);
  }

  // Build the bundle ONCE: it is language-independent apart from the lang/ files
  // that Vite copies wholesale from public/.
  step(++n, total, "Build the offline bundle");
  run("npx", ["vite", "build", "--config", "vite.standalone.config.ts"]);

  step(++n, total, `Package engine + ${langs.length} language ZIP(s)`);
  for (const lang of langs) {
    console.log(`\n· ${lang}`);
    node("package-and-check.mjs", ["--no-build", "--lang", lang]);
  }

  console.log(`\n\x1b[1m━━ Release contents ${"━".repeat(31)}\x1b[0m`);
  for (const f of fs.readdirSync(CONTAINER_DIR).sort()) {
    const kb = fs.statSync(path.join(CONTAINER_DIR, f)).size / 1024;
    console.log(`   ${f.padEnd(34)} ${kb > 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb.toFixed(0)} KB`}`);
  }
  console.log(`\n   in ${path.relative(process.cwd(), CONTAINER_DIR)}`);
  console.log(`\n✅ Release built for: ${langs.join(", ")}`);
  console.log(`   Preview : pnpm game:preview -- --lang ${langs[0]}`);
  console.log(`   Upload  : pnpm game:upload            (dry run by default)`);
}

try {
  main();
} catch (err) {
  console.error(`\n❌ ${err.message}\n`);
  process.exit(1);
}
