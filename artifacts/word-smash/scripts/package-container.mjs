// Package Word Smash for the Curious Reader offline container (spec §5).
//
// Word Smash is a Layout A (2-tier) title: engine + language, NO core level.
// This script rebuilds the standalone bundle and emits two upload ZIPs into
// `dist/container/`:
//
//   wordsmash-eng.zip            engine tier — index.html at ZIP root, JS/CSS,
//                                assets/, fonts/, favicon; NO lang/, no *.map,
//                                and non-game web files (opengraph.jpg,
//                                robots.txt) excluded.
//   wordsmash-lang-<code>.zip    language tier — ONLY lang/<code>/ (wordsmash.json
//                                + every audios/*.mp3). One ZIP per language.
//
// NOTE ON THE ENGINE TOKEN: the frozen spec token for the engine tier is
// `-core`, but this project deliberately ships the engine ZIP as
// `wordsmash-eng.zip`. The Curious Learning CMS pipeline must be configured to
// classify the `-eng` token as the engine tier for this game.
//
// Usage:
//   node scripts/package-container.mjs [--lang <code>] [--no-build]
//   pnpm --filter @workspace/word-smash run package:container -- --lang english
//
// Requires the `zip` / `unzip` CLIs (present in the Replit runtime).

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ENGINE_SLUG = "wordsmash";
const ENGINE_ZIP = `${ENGINE_SLUG}-eng.zip`; // deliberate `-eng` override (see header)

const ARTIFACT_DIR = path.resolve(fileURLToPath(import.meta.url), "..", "..");
const STANDALONE_DIR = path.join(ARTIFACT_DIR, "dist", "standalone");
const OUT_DIR = path.join(ARTIFACT_DIR, "dist", "container");
const STAGE_DIR = path.join(ARTIFACT_DIR, "dist", ".engine-stage");

// Files/dirs that must never appear in the ENGINE ZIP.
const ENGINE_EXCLUDE_NAMES = new Set(["lang", "opengraph.jpg", "robots.txt"]);

function parseArgs(argv) {
  const args = { lang: "english", build: true };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--lang") args.lang = argv[++i];
    else if (a === "--no-build") args.build = false;
    else if (a.startsWith("--lang=")) args.lang = a.slice("--lang=".length);
    else throw new Error(`Unknown argument: ${a}`);
  }
  if (!args.lang || /[^a-z0-9_-]/.test(args.lang)) {
    throw new Error(`Invalid --lang "${args.lang}" (lowercase, no spaces)`);
  }
  return args;
}

function run(cmd, cmdArgs, cwd) {
  execFileSync(cmd, cmdArgs, { cwd, stdio: "inherit" });
}

function rimraf(p) {
  fs.rmSync(p, { recursive: true, force: true });
}

// Recursively collect POSIX-relative file paths under `dir`.
function listFiles(dir, base = dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listFiles(full, base));
    else out.push(path.relative(base, full).split(path.sep).join("/"));
  }
  return out;
}

function zipList(zipPath) {
  const raw = execFileSync("unzip", ["-Z1", zipPath], { encoding: "utf8" });
  return raw.split("\n").map((s) => s.trim()).filter(Boolean);
}

function fail(msg) {
  console.error(`\n❌ Integrity check failed: ${msg}`);
  process.exit(1);
}

function main() {
  const { lang, build } = parseArgs(process.argv.slice(2));
  const langZipName = `${ENGINE_SLUG}-lang-${lang}.zip`;

  if (build) {
    console.log("▶ Rebuilding standalone bundle…");
    run("pnpm", ["exec", "vite", "build", "--config", "vite.standalone.config.ts"], ARTIFACT_DIR);
  }

  if (!fs.existsSync(path.join(STANDALONE_DIR, "index.html"))) {
    fail(`no standalone build at ${STANDALONE_DIR} (run without --no-build)`);
  }
  const langSrc = path.join(STANDALONE_DIR, "lang", lang);
  if (!fs.existsSync(langSrc)) {
    fail(`language "${lang}" not found in build at ${langSrc}`);
  }

  rimraf(OUT_DIR);
  fs.mkdirSync(OUT_DIR, { recursive: true });

  // ── Engine ZIP ────────────────────────────────────────────────────────────
  // Build from a clean staging tree so exclusions are exact and deterministic.
  console.log(`\n▶ Building engine ZIP → ${ENGINE_ZIP}`);
  rimraf(STAGE_DIR);
  fs.mkdirSync(STAGE_DIR, { recursive: true });
  for (const entry of fs.readdirSync(STANDALONE_DIR, { withFileTypes: true })) {
    if (ENGINE_EXCLUDE_NAMES.has(entry.name)) continue;
    fs.cpSync(
      path.join(STANDALONE_DIR, entry.name),
      path.join(STAGE_DIR, entry.name),
      { recursive: true },
    );
  }
  // Drop any stray source maps.
  for (const rel of listFiles(STAGE_DIR)) {
    if (rel.endsWith(".map")) fs.rmSync(path.join(STAGE_DIR, rel));
  }
  const engineZipPath = path.join(OUT_DIR, ENGINE_ZIP);
  run("zip", ["-r", "-q", "-X", engineZipPath, "."], STAGE_DIR);
  rimraf(STAGE_DIR);

  // ── Language ZIP ────────────────────────────────────────────────────────────
  console.log(`▶ Building language ZIP → ${langZipName}`);
  const langZipPath = path.join(OUT_DIR, langZipName);
  // Zip the `lang/<code>` subtree with paths relative to the build root so
  // entries are stored as `lang/<code>/…` and merge cleanly with the engine.
  run("zip", ["-r", "-q", "-X", langZipPath, path.join("lang", lang)], STANDALONE_DIR);

  // ── Integrity checks (spec §7c) ─────────────────────────────────────────────
  console.log("\n▶ Verifying ZIP integrity…");
  const engineEntries = zipList(engineZipPath);
  const langEntries = zipList(langZipPath);

  if (!engineEntries.includes("index.html")) {
    fail("engine ZIP has no index.html at its root");
  }
  const strayLang = engineEntries.filter((e) => e.startsWith("lang/"));
  if (strayLang.length) fail(`engine ZIP contains lang/ entries: ${strayLang.join(", ")}`);
  const strayWeb = engineEntries.filter(
    (e) => e === "opengraph.jpg" || e === "robots.txt" || e.endsWith(".map"),
  );
  if (strayWeb.length) fail(`engine ZIP contains excluded files: ${strayWeb.join(", ")}`);

  const prefix = `lang/${lang}/`;
  const outside = langEntries.filter((e) => !e.startsWith(prefix));
  if (outside.length) fail(`language ZIP has entries outside ${prefix}: ${outside.join(", ")}`);

  // Every audio file on disk must be present in the language ZIP.
  const audiosSrc = path.join(langSrc, "audios");
  const srcAudioCount = fs.existsSync(audiosSrc)
    ? fs.readdirSync(audiosSrc).filter((f) => f.endsWith(".mp3")).length
    : 0;
  const zipAudioCount = langEntries.filter(
    (e) => e.startsWith(`${prefix}audios/`) && e.endsWith(".mp3"),
  ).length;
  if (zipAudioCount !== srcAudioCount) {
    fail(`language ZIP has ${zipAudioCount} audio files, source has ${srcAudioCount}`);
  }
  if (!langEntries.includes(`${prefix}wordsmash.json`)) {
    fail(`language ZIP is missing ${prefix}wordsmash.json`);
  }

  const kb = (p) => (fs.statSync(p).size / 1024).toFixed(1);
  console.log(`\n✅ Packaged for the Curious Reader container:`);
  console.log(`   ${path.relative(ARTIFACT_DIR, engineZipPath)}  (${kb(engineZipPath)} KB, ${engineEntries.length} entries)`);
  console.log(`   ${path.relative(ARTIFACT_DIR, langZipPath)}  (${kb(langZipPath)} KB, ${langEntries.length} entries, ${zipAudioCount} audio)`);
  console.log(`\n   engine token: -eng (deliberate override of spec's frozen -core)`);
  console.log(`   language:     ${lang}`);
}

main();
