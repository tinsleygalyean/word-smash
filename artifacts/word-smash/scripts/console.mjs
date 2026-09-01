#!/usr/bin/env node
// Word Smash console — a local control panel for the four pipeline commands.
//
// Serves a small UI that runs `content:build`, `game:build`, `game:preview`, and
// `game:upload` against a chosen language, streams their output live, and plays
// the built bundle in a phone-landscape frame.
//
// It has to be a LOCAL server, not a published Artifact: an Artifact is a
// sandboxed page on claude.ai that cannot spawn a process on this machine, and
// its CSP would block an iframe pointed at localhost.
//
// Usage:
//   node scripts/console.mjs [--port <n>] [--no-open]
//   pnpm game:console
//
// SAFETY: the upload action always runs as a DRY RUN. A live CMS upload needs a
// typed confirmation and stays a deliberate terminal action — a browser button
// is the wrong gate for an external write.

import { execFile, execFileSync } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ARTIFACT_DIR = path.resolve(fileURLToPath(import.meta.url), "..", "..");
const REPO_ROOT = path.resolve(ARTIFACT_DIR, "..", "..");
const SCRIPTS_DIR = path.join(ARTIFACT_DIR, "scripts");
const STANDALONE = path.join(ARTIFACT_DIR, "dist", "standalone");
const CONTAINER = path.join(ARTIFACT_DIR, "dist", "container");
const LANG_ROOT = path.join(ARTIFACT_DIR, "public", "lang");
const CONFIG_PATH = path.join(ARTIFACT_DIR, "content.config.json");
const UI = path.join(SCRIPTS_DIR, "console.html");

const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8",
  ".mp3": "audio/mpeg", ".woff2": "font/woff2", ".svg": "image/svg+xml",
  ".jpg": "image/jpeg", ".png": "image/png", ".txt": "text/plain; charset=utf-8",
};

function parseArgs(argv) {
  const args = { port: Number(process.env.PORT) || 23522, open: true };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--") continue;
    else if (a === "--port") args.port = Number(argv[++i]);
    else if (a.startsWith("--port=")) args.port = Number(a.slice("--port=".length));
    else if (a === "--no-open") args.open = false;
    else throw new Error(`Unknown argument: ${a}`);
  }
  return args;
}

// Terminal colour codes are noise in the browser log; the UI colours lines by
// their leading symbol instead.
const stripAnsi = (s) => s.replace(/\[[0-9;]*m/g, "");

// ── output fan-out (server-sent events) ─────────────────────────────────────
const clients = new Set();
function broadcast(line) {
  const payload = `event: out\ndata: ${JSON.stringify({ line: stripAnsi(line) })}\n\n`;
  for (const res of clients) res.write(payload);
}

// ── command table ───────────────────────────────────────────────────────────
// Each action names a script and how the language is passed. The upload action
// is pinned to --dry-run and cannot be talked out of it from the browser.
const ACTIONS = {
  content: (lang) => ({ cmd: "node", args: [path.join(SCRIPTS_DIR, "build-content.mjs"), "--lang", lang], cwd: ARTIFACT_DIR }),
  build:   (lang) => ({ cmd: "node", args: [path.join(SCRIPTS_DIR, "build-release.mjs"), "--lang", lang], cwd: ARTIFACT_DIR }),
  preview: (lang) => ({ cmd: "node", args: [path.join(SCRIPTS_DIR, "check-bundle.mjs"), "--no-build", "--lang", lang], cwd: ARTIFACT_DIR }),
  upload:  (lang) => ({ cmd: "npx", args: ["tsx", path.join(REPO_ROOT, "scripts", "src", "upload-all.ts"), "--lang", lang, "--dry-run"], cwd: REPO_ROOT }),
};

let busy = false;

function runAction(action, lang) {
  return new Promise((resolve) => {
    const spec = ACTIONS[action](lang);
    const child = execFile(spec.cmd, spec.args, { cwd: spec.cwd, maxBuffer: 1 << 26 });

    let buffered = "";
    const onData = (chunk) => {
      buffered += chunk;
      const lines = buffered.split("\n");
      buffered = lines.pop() ?? "";
      for (const l of lines) broadcast(l);
    };
    child.stdout.on("data", onData);
    child.stderr.on("data", onData);

    child.on("close", (code) => {
      if (buffered) broadcast(buffered);
      const ok = code === 0;
      broadcast(ok ? `✅ finished (${action}, ${lang})` : `❌ exited with code ${code}`);
      resolve(ok);
    });
    child.on("error", (err) => {
      broadcast(`❌ ${err.message}`);
      resolve(false);
    });
  });
}

// ── status ──────────────────────────────────────────────────────────────────
function sizeOf(file) {
  if (!fs.existsSync(file)) return null;
  const kb = fs.statSync(file).size / 1024;
  return kb > 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb.toFixed(0)} KB`;
}

function readState() {
  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
  const languages = Object.keys(config.languages).map((code) => {
    const packFile = path.join(LANG_ROOT, code, "wordsmash.json");
    const audioDir = path.join(LANG_ROOT, code, "audios");
    let levels = null, words = null;
    if (fs.existsSync(packFile)) {
      const pack = JSON.parse(fs.readFileSync(packFile, "utf8"));
      levels = pack.levels.length;
      words = pack.levels.reduce((n, l) => n + l.words.length, 0);
    }
    return {
      code,
      label: code.charAt(0).toUpperCase() + code.slice(1),
      levels,
      words,
      audio: fs.existsSync(audioDir) ? fs.readdirSync(audioDir).filter((f) => f.endsWith(".mp3")).length : null,
      zip: sizeOf(path.join(CONTAINER, `wordsmash-lang-${code}.zip`)),
    };
  });

  // Credentials may come from the environment or the untracked .env; report
  // presence only, never a value.
  let credentials = Boolean(process.env.CR_CMS_SERVER_URL && process.env.CR_MCP_API_KEY);
  if (!credentials) {
    const envFile = path.join(REPO_ROOT, ".env");
    if (fs.existsSync(envFile)) {
      const text = fs.readFileSync(envFile, "utf8");
      // Horizontal whitespace only — `\s` would match newlines and report a
      // blank `KEY=` as set.
      const has = (k) => new RegExp(`^[ \\t]*${k}[ \\t]*=[ \\t]*\\S`, "m").test(text);
      credentials = has("CR_CMS_SERVER_URL") && has("CR_MCP_API_KEY");
    }
  }

  return { languages, engineZip: sizeOf(path.join(CONTAINER, "wordsmash-eng.zip")), credentials };
}

// ── static file serving ─────────────────────────────────────────────────────
function serveFile(res, file, { noStore = true } = {}) {
  res.writeHead(200, {
    "Content-Type": TYPES[path.extname(file)] || "application/octet-stream",
    ...(noStore ? { "Cache-Control": "no-store" } : {}),
  });
  fs.createReadStream(file).pipe(res);
}

function readBody(req) {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (c) => { data += c; });
    req.on("end", () => { try { resolve(JSON.parse(data || "{}")); } catch { resolve({}); } });
  });
}

function main() {
  const { port, open } = parseArgs(process.argv.slice(2));
  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost:${port}`);
    const p = decodeURIComponent(url.pathname);

    if (p === "/") return serveFile(res, UI);

    if (p === "/assets/fredoka-600.woff2") {
      const font = path.join(ARTIFACT_DIR, "public", "fonts", "fredoka-600.woff2");
      if (fs.existsSync(font)) return serveFile(res, font, { noStore: false });
      res.writeHead(404).end();
      return;
    }

    if (p === "/api/state") {
      res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
      return res.end(JSON.stringify(readState()));
    }

    if (p === "/api/events") {
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });
      res.write(": connected\n\n");
      clients.add(res);
      req.on("close", () => clients.delete(res));
      return;
    }

    if (p === "/api/run" && req.method === "POST") {
      const { action, lang } = await readBody(req);
      const reply = (code, body) => {
        res.writeHead(code, { "Content-Type": "application/json" });
        res.end(JSON.stringify(body));
      };
      if (!ACTIONS[action]) return reply(400, { ok: false, error: `unknown action "${action}"` });
      if (!config.languages[lang]) return reply(400, { ok: false, error: `unknown language "${lang}"` });
      if (busy) return reply(409, { ok: false, error: "another command is already running" });

      busy = true;
      try {
        const ok = await runAction(action, lang);
        return reply(200, { ok });
      } finally {
        busy = false;
      }
    }

    // The built bundle, served exactly as the ZIPs contain it.
    if (p === "/preview" || p.startsWith("/preview/")) {
      const rel = p.replace(/^\/preview\/?/, "") || "index.html";
      let file = path.join(STANDALONE, rel);
      if (!file.startsWith(STANDALONE)) { res.writeHead(403).end("Forbidden"); return; }
      if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(STANDALONE, "index.html");
      if (!fs.existsSync(file)) {
        res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
        return res.end("<p style='font:14px system-ui;padding:24px;color:#555'>No build yet — run <b>game:build</b>.</p>");
      }
      return serveFile(res, file);
    }

    res.writeHead(404).end("Not found");
  });

  server.listen(port, "127.0.0.1", () => {
    const url = `http://localhost:${port}/`;
    console.log(`\n\x1b[1m▶ Word Smash console\x1b[0m`);
    console.log(`   ${url}`);
    console.log(`\n   Languages : ${Object.keys(config.languages).join(", ")}`);
    console.log(`   Upload    : dry run only from the console (live stays a terminal step)`);
    console.log(`\n   Ctrl-C to stop.\n`);
    if (open) {
      try {
        execFileSync(process.platform === "darwin" ? "open" : "xdg-open", [url], { stdio: "ignore" });
      } catch {
        /* headless or no opener — the URL above is enough */
      }
    }
  });
}

try {
  main();
} catch (err) {
  console.error(`\n❌ ${err.message}\n`);
  process.exit(1);
}
