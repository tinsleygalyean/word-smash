#!/usr/bin/env node
// Preview and test a built language the way a device sees it.
//
// This serves dist/standalone — the SAME files that go into the container ZIPs
// — rather than the Vite dev server, so what you play is what ships. It first
// runs the offline integrity check for the chosen language, so a bundle that
// would break on a device fails here instead of looking fine in a browser.
//
// Usage:
//   node scripts/preview-release.mjs [--lang <code>] [--port <n>] [--skip-check]
//   pnpm game:preview -- --lang english
//
// Requires a prior `pnpm game:build`.

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ARTIFACT_DIR = path.resolve(fileURLToPath(import.meta.url), "..", "..");
const SCRIPTS_DIR = path.join(ARTIFACT_DIR, "scripts");
const ROOT = path.join(ARTIFACT_DIR, "dist", "standalone");

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mp3": "audio/mpeg",
  ".woff2": "font/woff2",
  ".svg": "image/svg+xml",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".txt": "text/plain; charset=utf-8",
};

function parseArgs(argv) {
  const args = { lang: "english", port: Number(process.env.PORT) || 23520, check: true };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--") continue;
    else if (a === "--lang") args.lang = argv[++i];
    else if (a.startsWith("--lang=")) args.lang = a.slice("--lang=".length);
    else if (a === "--port") args.port = Number(argv[++i]);
    else if (a.startsWith("--port=")) args.port = Number(a.slice("--port=".length));
    else if (a === "--skip-check") args.check = false;
    else throw new Error(`Unknown argument: ${a}`);
  }
  if (!args.lang || /[^a-z0-9_-]/.test(args.lang)) {
    throw new Error(`Invalid --lang "${args.lang}" (lowercase, no spaces)`);
  }
  return args;
}

function main() {
  const { lang, port, check } = parseArgs(process.argv.slice(2));

  if (!fs.existsSync(path.join(ROOT, "index.html"))) {
    throw new Error(`No build at dist/standalone — run: pnpm game:build`);
  }
  const packPath = path.join(ROOT, "lang", lang, "wordsmash.json");
  if (!fs.existsSync(packPath)) {
    const built = fs.existsSync(path.join(ROOT, "lang")) ? fs.readdirSync(path.join(ROOT, "lang")) : [];
    throw new Error(
      `Language "${lang}" is not in the build (built: ${built.join(", ") || "none"}).\n` +
        `   Run: pnpm game:build -- --lang ${lang}`
    );
  }

  if (check) {
    console.log(`▶ Offline integrity check (${lang})…\n`);
    execFileSync("node", [path.join(SCRIPTS_DIR, "check-bundle.mjs"), "--no-build", "--lang", lang], {
      cwd: ARTIFACT_DIR,
      stdio: "inherit",
    });
  }

  const pack = JSON.parse(fs.readFileSync(packPath, "utf8"));
  const words = pack.levels.reduce((n, l) => n + l.words.length, 0);

  const server = http.createServer((req, res) => {
    const urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
    let filePath = path.join(ROOT, urlPath === "/" ? "index.html" : urlPath);

    // Keep the server inside the build directory.
    if (!filePath.startsWith(ROOT)) {
      res.writeHead(403).end("Forbidden");
      return;
    }
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      filePath = path.join(ROOT, "index.html"); // SPA fallback
    }
    res.writeHead(200, {
      "Content-Type": TYPES[path.extname(filePath)] || "application/octet-stream",
      "Cache-Control": "no-store",
    });
    fs.createReadStream(filePath).pipe(res);
  });

  server.listen(port, "0.0.0.0", () => {
    const url = `http://localhost:${port}/?cr_lang=${lang}`;
    console.log(`\n\x1b[1m▶ Word Smash — ${lang}\x1b[0m`);
    console.log(`   ${pack.levels.length} levels · ${words} word entries`);
    console.log(`\n   \x1b[4m${url}\x1b[0m`);
    console.log(`   ${url}&reset=1   (wipe saved progress, start at level 1)`);
    console.log(`\n   Serving dist/standalone — the same files that go in the ZIPs.`);
    console.log(`   Ctrl-C to stop.\n`);
  });
}

try {
  main();
} catch (err) {
  console.error(`\n❌ ${err.message}\n`);
  process.exit(1);
}
