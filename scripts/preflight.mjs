#!/usr/bin/env node
// Check whether this machine can build Word Smash, and say exactly what to do
// about anything that is missing.
//
// Read-only: it inspects and reports, it never installs or edits. `/getstarted`
// runs it before and after setup; run it yourself any time something breaks.
//
// Usage:  pnpm preflight
//
// Exit code 0 when everything required is present, 1 when a blocker remains.

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), "..", "..");
const NODE_MODULES = path.join(REPO_ROOT, "node_modules");
const WORD_SMASH = path.join(REPO_ROOT, "artifacts", "word-smash");

const REQUIRED_NODE_MAJOR = 24;
const PLATFORM = `${process.platform}-${process.arch}`;

const rows = [];
let blockers = 0;
let warnings = 0;

function ok(label, detail) { rows.push(["✅", label, detail ?? "", null]); }
function warn(label, detail, fix) { rows.push(["⚠", label, detail ?? "", fix]); warnings++; }
function bad(label, detail, fix) { rows.push(["❌", label, detail ?? "", fix]); blockers++; }

function has(cmd) {
  try {
    execFileSync(process.platform === "win32" ? "where" : "which", [cmd], { stdio: "ignore" });
    return true;
  } catch { return false; }
}

// ── Node ────────────────────────────────────────────────────────────────────
// The version genuinely matters: Node 25 ships a global localStorage that
// shadows jsdom's (every test fails), and Node 20 is too old for jsdom 30.
const major = Number(process.versions.node.split(".")[0]);
if (major === REQUIRED_NODE_MAJOR) {
  ok("Node.js", `v${process.versions.node}`);
} else if (major > REQUIRED_NODE_MAJOR) {
  bad("Node.js", `v${process.versions.node} — too new`,
      `Node ${major} shadows jsdom's localStorage and every test fails. Use: nvm install 24 && nvm use 24`);
} else {
  bad("Node.js", `v${process.versions.node} — too old`,
      `jsdom 30 needs Node 22+. Use: nvm install 24 && nvm use 24`);
}

// ── tools ───────────────────────────────────────────────────────────────────
has("pnpm") ? ok("pnpm", "on PATH") : bad("pnpm", "not found", "corepack enable");
has("git") ? ok("git", "on PATH") : bad("git", "not found", "install git");

const zips = ["zip", "unzip"].filter((c) => !has(c));
zips.length
  ? bad("zip / unzip", `missing: ${zips.join(", ")}`,
        "needed to build the container ZIPs — on Debian/Ubuntu: sudo apt install zip unzip")
  : ok("zip / unzip", "on PATH");

// ── dependencies ────────────────────────────────────────────────────────────
if (fs.existsSync(NODE_MODULES)) {
  ok("Dependencies", "node_modules present");

  // The workspace overrides away every non-linux-x64 native package, so off
  // Replit these have to be side-loaded by `pnpm setup:native`.
  const needed = [
    `@rollup/rollup-${PLATFORM}`,
    `@esbuild/${PLATFORM}`,
    `lightningcss-${PLATFORM}`,
    `@tailwindcss/oxide-${PLATFORM}`,
  ];
  if (PLATFORM === "linux-x64") {
    ok("Native binaries", "linux-x64 — shipped in the lockfile");
  } else {
    const resolvable = (name) =>
      fs.existsSync(path.join(NODE_MODULES, name, "package.json")) ||
      fs.existsSync(path.join(NODE_MODULES, ".pnpm", "node_modules", name, "package.json"));
    const missing = needed.filter((n) => !resolvable(n));
    missing.length
      ? bad("Native binaries", `${missing.length}/${needed.length} missing for ${PLATFORM}`,
            "pnpm setup:native")
      : ok("Native binaries", `${PLATFORM} — all ${needed.length} present`);
  }
} else {
  bad("Dependencies", "no node_modules", "pnpm install");
  warn("Native binaries", "cannot check until dependencies are installed", "pnpm setup:native");
}

// ── content and build outputs ───────────────────────────────────────────────
const configPath = path.join(WORD_SMASH, "content.config.json");
if (fs.existsSync(configPath)) {
  const langs = Object.keys(JSON.parse(fs.readFileSync(configPath, "utf8")).languages);
  const built = langs.filter((l) =>
    fs.existsSync(path.join(WORD_SMASH, "public", "lang", l, "wordsmash.json")));
  built.length === langs.length
    ? ok("Language packs", `${built.join(", ")}`)
    : warn("Language packs", `missing: ${langs.filter((l) => !built.includes(l)).join(", ")}`,
           "pnpm content:build");
} else {
  bad("content.config.json", "not found", "are you in the repository root?");
}

fs.existsSync(path.join(WORD_SMASH, "dist", "container", "wordsmash-eng.zip"))
  ? ok("Release ZIPs", "built")
  : warn("Release ZIPs", "not built yet", "pnpm game:build");

// ── credentials (presence only — values are never read or printed) ──────────
const envFile = path.join(REPO_ROOT, ".env");
// NB: `\s` matches newlines — `KEY=` would match the next non-blank line.
// Horizontal whitespace only, and the value must be on the same line.
const present = (text, key) => new RegExp(`^[ \\t]*${key}[ \\t]*=[ \\t]*\\S`, "m").test(text);
if (fs.existsSync(envFile)) {
  const text = fs.readFileSync(envFile, "utf8");
  const url = present(text, "CR_CMS_SERVER_URL");
  const key = present(text, "CR_MCP_API_KEY");
  if (url && key) ok("CMS credentials", ".env — both set");
  else warn("CMS credentials", `.env — ${!url ? "CR_CMS_SERVER_URL " : ""}${!key ? "CR_MCP_API_KEY " : ""}not set`,
            "only needed to upload; run: pnpm env:init");
} else {
  warn("CMS credentials", "no .env", "only needed to upload; run: pnpm env:init");
}

// ── report ──────────────────────────────────────────────────────────────────
console.log(`\n\x1b[1mWord Smash — machine check\x1b[0m  (${PLATFORM})\n`);
const width = Math.max(...rows.map(([, label]) => label.length));
for (const [mark, label, detail, fix] of rows) {
  console.log(`  ${mark} ${label.padEnd(width)}  ${detail}`);
  if (fix) console.log(`     ${" ".repeat(width)} → ${fix}`);
}

if (blockers) {
  console.log(`\n❌ ${blockers} blocker(s). Fix the arrows above, then re-run: pnpm preflight\n`);
  process.exit(1);
}
console.log(
  warnings
    ? `\n✅ Ready to build. ${warnings} optional item(s) not set up yet.\n`
    : `\n✅ Everything is set up.\n`
);
