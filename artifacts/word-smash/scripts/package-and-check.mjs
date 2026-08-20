#!/usr/bin/env node
// Orchestrator: package the container ZIPs then run the offline integrity check.
//
// This wrapper exists so `--lang <code>` (and other args) are parsed once and
// forwarded correctly to both sub-scripts.  Without it, chaining two `node`
// invocations in the npm script means the checker always defaults to "english"
// regardless of which language was just packaged.
//
// Usage (same surface as package-container.mjs):
//   node scripts/package-and-check.mjs [--lang <code>] [--no-build]
//   pnpm --filter @workspace/word-smash run package:container -- --lang spanish

import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ARTIFACT_DIR = path.resolve(fileURLToPath(import.meta.url), "..", "..");
const SCRIPTS_DIR = path.join(ARTIFACT_DIR, "scripts");

// ── Parse args ────────────────────────────────────────────────────────────────
// Accept every flag that package-container.mjs accepts; forward them verbatim.
// npm/pnpm inserts a bare "--" separator before user-supplied args; drop it.
const passthrough = process.argv.slice(2).filter((a) => a !== "--");

// Extract --lang for the checker call (default "english" to match packager default).
let lang = "english";
for (let i = 0; i < passthrough.length; i++) {
  if (passthrough[i] === "--lang" && passthrough[i + 1]) lang = passthrough[i + 1];
  else if (passthrough[i].startsWith("--lang=")) lang = passthrough[i].slice("--lang=".length);
}

function run(script, args) {
  execFileSync("node", [path.join(SCRIPTS_DIR, script), ...args], {
    cwd: ARTIFACT_DIR,
    stdio: "inherit",
  });
}

// 1. Package (with whatever build/lang flags the caller requested).
run("package-container.mjs", passthrough);

// 2. Integrity check against the freshly generated artifacts.
//    Always --no-build here: the packager already built everything above.
run("check-bundle.mjs", ["--no-build", "--lang", lang]);
