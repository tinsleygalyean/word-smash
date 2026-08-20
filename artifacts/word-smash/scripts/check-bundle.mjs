#!/usr/bin/env node
// Bundle integrity checks for Word Smash offline delivery.
//
// Covers:
//   TC-PKG-04  Engine + language ZIPs merge with no path overlap (disjoint trees).
//   TC-PKG-05  Standalone bundle uses only relative paths — no absolute src/url,
//              no CDN/http URLs, no @import left in built output.
//   TC-NFR-01  No fetch(), <audio>, or CDN <script>/<link>/@import in shipped bundle.
//
// Usage:
//   node scripts/check-bundle.mjs [--no-build] [--lang <code>]
//   pnpm --filter @workspace/word-smash run test:bundle
//
// Exit 0 = all checks pass. Exit 1 = one or more failures.

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ARTIFACT_DIR = path.resolve(fileURLToPath(import.meta.url), "..", "..");
const STANDALONE_DIR = path.join(ARTIFACT_DIR, "dist", "standalone");
const CONTAINER_DIR = path.join(ARTIFACT_DIR, "dist", "container");

// ── Forbidden patterns (TC-PKG-05 / TC-NFR-01) ──────────────────────────────
// Each entry: { label, regex, description }
// We grep the TEXT content of all .html / .js / .css files in the standalone
// bundle (source maps are excluded by the build config).
const FORBIDDEN_PATTERNS = [
  {
    label: "absolute-path-attr",
    // src="/", href="/", srcset="/" — absolute-local paths in HTML/JS attrs.
    // Matches both quote styles and optional whitespace around `=`.
    regex: /(src|href|srcset)\s*=\s*["']\//,
    description: 'absolute local path in src/href/srcset (="/…") — breaks file:// loading',
  },
  {
    label: "absolute-url-css",
    // url(/ or url("/ or url('/ — absolute CSS asset reference
    regex: /url\(["']?\//,
    description: "absolute CSS url(/ …) — breaks file:// loading",
  },
  {
    label: "http-url",
    // CDN/external URLs appearing in actual resource-loading contexts:
    //   src="https://…"  href="https://…"  url(https://…)  @import "https://…"
    // Inline string constants (React error URLs, W3C XML namespaces) are not
    // flagged — they're never fetched at runtime.
    regex: /(src|href)=["']https?:\/\/|url\(["']?https?:\/\/|@import\s+["']https?:\/\//,
    description: "CDN/external URL in resource-load context (src/href/url()/import) — breaks offline use",
  },
  {
    label: "at-import",
    // @import left in built CSS means a pending network fetch.
    regex: /@import\b/,
    description: "@import in built CSS — not inlined, breaks offline use",
  },
  {
    label: "fetch-call",
    // fetch( — all asset loading must use XHR (status 0 on file://).
    regex: /\bfetch\s*\(/,
    description: "fetch() call — must use XHR for file:// compatibility",
  },
  {
    label: "audio-element",
    // <audio — audio elements require a server or blob URL; game must use XHR+AudioContext.
    regex: /<audio[\s>]/i,
    description: "<audio> element — must load audio via XHR+AudioContext for offline use",
  },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = { build: true, lang: "english" };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--no-build") args.build = false;
    else if (argv[i] === "--lang") args.lang = argv[++i];
    else if (argv[i].startsWith("--lang=")) args.lang = argv[i].slice("--lang=".length);
    else {
      console.error(`Unknown argument: ${argv[i]}`);
      process.exit(1);
    }
  }
  return args;
}

/** Recursively collect all file paths under dir as POSIX relative paths. */
function listFiles(dir, base = dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listFiles(full, base));
    else out.push(path.relative(base, full).split(path.sep).join("/"));
  }
  return out;
}

/** Return lines from a ZIP listing (unzip -Z1). */
function zipList(zipPath) {
  const raw = execFileSync("unzip", ["-Z1", zipPath], { encoding: "utf8" });
  return raw
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

let failures = 0;
let checks = 0;

function pass(label) {
  checks++;
  console.log(`  ✅ ${label}`);
}

function fail(label, detail) {
  checks++;
  failures++;
  console.error(`  ❌ ${label}`);
  if (detail) console.error(`     ${detail}`);
}

// ── Build step ───────────────────────────────────────────────────────────────

function ensureBuilt(lang, build) {
  if (build) {
    console.log("\n▶  Building standalone bundle…");
    execFileSync(
      "pnpm",
      ["exec", "vite", "build", "--config", "vite.standalone.config.ts"],
      { cwd: ARTIFACT_DIR, stdio: "inherit" },
    );

    console.log("\n▶  Packaging container ZIPs…");
    execFileSync(
      "node",
      ["scripts/package-container.mjs", "--no-build", "--lang", lang],
      { cwd: ARTIFACT_DIR, stdio: "inherit" },
    );
  }

  if (!fs.existsSync(path.join(STANDALONE_DIR, "index.html"))) {
    console.error(
      `❌  No standalone build at ${STANDALONE_DIR}. Run without --no-build.`,
    );
    process.exit(1);
  }

  const engineZip = path.join(CONTAINER_DIR, "wordsmash-eng.zip");
  const langZip = path.join(CONTAINER_DIR, `wordsmash-lang-${lang}.zip`);
  for (const p of [engineZip, langZip]) {
    if (!fs.existsSync(p)) {
      console.error(`❌  Missing ZIP: ${p}. Run without --no-build.`);
      process.exit(1);
    }
  }

  return { engineZip, langZip };
}

// ── TC-PKG-04: disjoint ZIP trees ────────────────────────────────────────────

function checkDisjointZips(engineZip, langZip) {
  console.log("\n▶  TC-PKG-04 — Disjoint ZIP trees");

  const engineEntries = new Set(zipList(engineZip).filter((e) => !e.endsWith("/")));
  const langEntries = new Set(zipList(langZip).filter((e) => !e.endsWith("/")));

  const overlap = [...engineEntries].filter((e) => langEntries.has(e));

  if (overlap.length === 0) {
    pass("Engine and language ZIPs share no file paths — merge is safe");
  } else {
    fail(
      "Engine and language ZIPs have overlapping paths — unzip merge would overwrite",
      `Conflicting paths (${overlap.length}): ${overlap.slice(0, 5).join(", ")}${overlap.length > 5 ? ` … +${overlap.length - 5} more` : ""}`,
    );
  }

  // Bonus sanity: verify the merged tree covers expected roots.
  const allEntries = new Set([...engineEntries, ...langEntries]);
  if ([...allEntries].some((e) => e === "index.html")) {
    pass("Merged tree contains index.html at root");
  } else {
    fail("Merged tree is missing index.html at root");
  }
}

// ── TC-PKG-05 / TC-NFR-01: forbidden patterns in standalone ──────────────────

function checkForbiddenPatterns() {
  console.log("\n▶  TC-PKG-05 / TC-NFR-01 — Forbidden patterns in standalone bundle");

  // Gather all .html, .js, .css files (source maps are not emitted by the build config).
  const allFiles = listFiles(STANDALONE_DIR);
  const targetFiles = allFiles.filter((f) =>
    f.endsWith(".html") || f.endsWith(".js") || f.endsWith(".css"),
  );

  if (targetFiles.length === 0) {
    fail("No .html/.js/.css files found in standalone dist — build may be empty");
    return;
  }
  console.log(`     Scanning ${targetFiles.length} file(s) in dist/standalone…`);

  for (const pattern of FORBIDDEN_PATTERNS) {
    const hits = [];

    for (const rel of targetFiles) {
      const content = fs.readFileSync(path.join(STANDALONE_DIR, rel), "utf8");
      // Split into lines for useful error messages.
      const lines = content.split("\n");
      for (let i = 0; i < lines.length; i++) {
        if (pattern.regex.test(lines[i])) {
          // Capture a short snippet (first 120 chars of the line).
          const snippet = lines[i].trim().slice(0, 120);
          hits.push(`${rel}:${i + 1}: ${snippet}`);
          if (hits.length >= 3) break; // cap per file to avoid noise
        }
      }
      if (hits.length >= 3) break; // cap total hits reported per pattern
    }

    if (hits.length === 0) {
      pass(`No ${pattern.label} — ${pattern.description}`);
    } else {
      fail(
        `Found ${pattern.label} — ${pattern.description}`,
        hits.join("\n     "),
      );
    }
  }
}

// ── Pattern self-test canary ──────────────────────────────────────────────────
// Runs before touching the real dist. Each pattern is exercised against a
// minimal known-bad fixture string so a silently broken regex (e.g. a future
// edit that narrows `absolute-path-attr` back to only `src`) is caught
// immediately rather than letting bad bundles through.

const PATTERN_FIXTURES = {
  // Must match: absolute local href — the exact blind-spot the reviewer flagged
  "absolute-path-attr": '<link href="/assets/app.css">',
  "absolute-url-css":   "background: url(/images/bg.png);",
  "http-url":           '<script src="https://cdn.example.com/lib.js">',
  "at-import":          '@import "variables.css";',
  "fetch-call":         "const res = await fetch('/api/data');",
  "audio-element":      "<audio src='sound.mp3' autoplay></audio>",
};

function selfTestPatterns() {
  console.log("\n▶  Pattern self-test (canary)");
  let selfFail = false;
  for (const p of FORBIDDEN_PATTERNS) {
    const fixture = PATTERN_FIXTURES[p.label];
    if (!fixture) {
      console.error(`  ⚠️  No fixture defined for pattern "${p.label}" — add one to PATTERN_FIXTURES`);
      selfFail = true;
      continue;
    }
    if (p.regex.test(fixture)) {
      console.log(`  ✅ ${p.label} fires on its fixture`);
    } else {
      console.error(`  ❌ ${p.label} did NOT match its fixture: ${JSON.stringify(fixture)}`);
      selfFail = true;
    }
  }
  if (selfFail) {
    console.error("\n❌  Pattern self-test failed — fix the regex(es) above before re-running.\n");
    process.exit(1);
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

function main() {
  const { build, lang } = parseArgs(process.argv.slice(2));

  console.log("╔══════════════════════════════════════════════════════╗");
  console.log("║  Word Smash — Offline Bundle Integrity Check         ║");
  console.log("╚══════════════════════════════════════════════════════╝");

  selfTestPatterns();

  const { engineZip, langZip } = ensureBuilt(lang, build);

  checkDisjointZips(engineZip, langZip);
  checkForbiddenPatterns();

  console.log(`\n${"─".repeat(54)}`);
  if (failures === 0) {
    console.log(`✅  All ${checks} check(s) passed — bundle is safe for offline devices.`);
  } else {
    console.error(
      `❌  ${failures} of ${checks} check(s) FAILED — fix before shipping to devices.`,
    );
    process.exit(1);
  }
}

main();
