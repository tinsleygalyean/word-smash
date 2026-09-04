#!/usr/bin/env node
// Install this machine's native build binaries.
//
// WHY THIS EXISTS
// pnpm-workspace.yaml deliberately `overrides` away every non-linux-x64 native
// package, because Replit — where this repo runs in production — is linux-x64
// and the exclusions keep that install small. The side effect is that on macOS,
// Windows, or ARM Linux a normal `pnpm install` leaves Rollup, esbuild,
// Lightning CSS, and Tailwind's oxide with no binary for the current platform,
// so every Vite build and every vitest run fails with:
//
//   Cannot find module '@rollup/rollup-darwin-arm64'
//
// This script fetches exactly those four packages, at the versions already in
// the lockfile install, and places them in the top-level node_modules where
// Node's resolution walk-up finds them. It touches nothing tracked by git:
// not package.json, not pnpm-lock.yaml, not pnpm-workspace.yaml, and above all
// not the `minimumReleaseAge` supply-chain safeguard.
//
// Safe to re-run; already-present binaries are left alone. Re-run it after any
// `pnpm install` that recreates node_modules.
//
// Usage:  pnpm setup          (no-op on linux-x64)

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), "..", "..");
const NODE_MODULES = path.join(REPO_ROOT, "node_modules");
// pnpm's virtual store hoists every dependency here, so it is a reliable place
// to read the resolved version of a transitive package.
const STORE = path.join(NODE_MODULES, ".pnpm", "node_modules");

const PLATFORM = `${process.platform}-${process.arch}`;

// [package whose version we follow, template for the platform package name]
const TARGETS = [
  ["rollup", (a) => `@rollup/rollup-${a}`],
  ["esbuild", (a) => `@esbuild/${a}`],
  ["lightningcss", (a) => `lightningcss-${a}`],
  ["@tailwindcss/oxide", (a) => `@tailwindcss/oxide-${a}`],
];

function resolvedVersion(pkg) {
  const file = path.join(STORE, pkg, "package.json");
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, "utf8")).version;
}

function main() {
  if (!fs.existsSync(NODE_MODULES)) {
    console.error(`\n❌ No node_modules — run \`pnpm install\` first, then \`pnpm setup\`.\n`);
    process.exit(1);
  }

  console.log(`\n▶ Native binaries for ${PLATFORM}`);

  if (PLATFORM === "linux-x64") {
    console.log(`  Nothing to do — the lockfile already ships linux-x64 binaries.\n`);
    return;
  }

  const work = [];
  for (const [source, nameFor] of TARGETS) {
    const version = resolvedVersion(source);
    const name = nameFor(PLATFORM);
    if (!version) {
      console.log(`  · ${name.padEnd(38)} skipped (${source} not installed)`);
      continue;
    }
    const dest = path.join(NODE_MODULES, name);
    if (fs.existsSync(path.join(dest, "package.json"))) {
      console.log(`  ✓ ${name.padEnd(38)} already present`);
      continue;
    }
    work.push({ name, version, dest });
  }

  if (!work.length) {
    console.log(`\n✅ Nothing to install — this machine is ready.\n`);
    return;
  }

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ws-native-"));
  try {
    for (const { name, version, dest } of work) {
      const spec = `${name}@${version}`;
      process.stdout.write(`  ↓ ${name.padEnd(38)} ${version} … `);
      let out;
      try {
        out = execFileSync("npm", ["pack", spec, "--pack-destination", tmp, "--json"], {
          encoding: "utf8",
          stdio: ["ignore", "pipe", "pipe"],
        });
      } catch (err) {
        console.log("failed");
        console.error(
          `\n❌ Could not download ${spec}.\n` +
            `   ${String(err.stderr || err.message).trim().split("\n")[0]}\n` +
            `   This platform may not have a published binary for that version.\n`
        );
        process.exit(1);
      }
      const filename = JSON.parse(out)[0].filename;
      // npm reports the registry filename; on disk scoped names are flattened.
      const tarball = fs.existsSync(path.join(tmp, filename))
        ? path.join(tmp, filename)
        : path.join(tmp, filename.replace(/^@/, "").replace("/", "-"));

      fs.mkdirSync(dest, { recursive: true });
      execFileSync("tar", ["-xzf", tarball, "-C", dest, "--strip-components=1"], { stdio: "inherit" });
      console.log("installed");
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }

  // esbuild ships an executable that must stay executable.
  const esbuildBin = path.join(NODE_MODULES, `@esbuild/${PLATFORM}`, "bin", "esbuild");
  if (fs.existsSync(esbuildBin)) fs.chmodSync(esbuildBin, 0o755);

  console.log(`\n✅ ${work.length} binary package(s) installed for ${PLATFORM}.`);
  console.log(`   Verify with: pnpm --filter @workspace/word-smash run test\n`);
}

try {
  main();
} catch (err) {
  console.error(`\n❌ ${err.message}\n`);
  process.exit(1);
}
