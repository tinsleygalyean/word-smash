#!/usr/bin/env node
// Package the standalone bundle into ONE self-contained HTML file — for a
// Claude Artifact, an email attachment, or any "just open this" review link.
//
// The offline build already emits sibling asset files (lang/, fonts/, assets/).
// A single-file host has no siblings, so this script embeds the language pack,
// every MP3, and the WOFF2 font as base64 and installs a small XMLHttpRequest
// shim ahead of the bundle that serves those paths from memory. Anything not
// embedded falls through to the real XMLHttpRequest.
//
// This works precisely BECAUSE of the offline rule: the game already loads every
// runtime asset through XHR (DECISIONS.md), so no game source changes are needed
// and the reviewed artifact is built from the same dist/standalone/ output that
// ships to devices.
//
// Usage:
//   node scripts/package-artifact.mjs [--lang <code>] [--no-build] [--out <file>]
//   pnpm --filter @workspace/word-smash run package:artifact -- --lang english
//
// Output (default): dist/artifact/word-smash-<lang>.html

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ARTIFACT_DIR = path.resolve(fileURLToPath(import.meta.url), "..", "..");
const STANDALONE_DIR = path.join(ARTIFACT_DIR, "dist", "standalone");
const OUT_DIR = path.join(ARTIFACT_DIR, "dist", "artifact");

// Claude Artifacts reject pages above this; warn well before the cliff.
const SIZE_LIMIT_MB = 16;

function parseArgs(argv) {
  const args = { lang: "english", build: true, out: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--") continue;
    else if (a === "--lang") args.lang = argv[++i];
    else if (a.startsWith("--lang=")) args.lang = a.slice("--lang=".length);
    else if (a === "--no-build") args.build = false;
    else if (a === "--out") args.out = argv[++i];
    else if (a.startsWith("--out=")) args.out = a.slice("--out=".length);
    else throw new Error(`Unknown argument: ${a}`);
  }
  if (!args.lang || /[^a-z0-9_-]/.test(args.lang)) {
    throw new Error(`Invalid --lang "${args.lang}" (lowercase, no spaces)`);
  }
  return args;
}

// Never let an inline payload close its own element.
const safe = (s) => s.replace(/<\/(script|style)/gi, "<\\/$1");

// The runtime XHR shim. `LANG` is the embedded language: a request for any
// other language's pack is remapped onto it, so the page plays its embedded
// content whether or not the host URL carries ?cr_lang=.
const shimSource = (lang) => `
(function () {
  var A = window.__WS_ASSETS__;
  var LANG = ${JSON.stringify(lang)};
  var Real = window.XMLHttpRequest;
  var decoder = new TextDecoder('utf-8');

  function norm(u) {
    u = String(u).split('?')[0].split('#')[0];
    u = u.replace(/^\\.\\//, '').replace(/^\\//, '');
    return u.replace(/^lang\\/[^/]+\\//, 'lang/' + LANG + '/');
  }
  function toBuf(s) {
    var bin = atob(s), n = bin.length, out = new Uint8Array(n);
    for (var i = 0; i < n; i++) out[i] = bin.charCodeAt(i);
    return out.buffer;
  }

  function WSXHR() {
    this.readyState = 0; this.status = 0; this.statusText = '';
    this.response = null; this.responseText = ''; this.responseType = '';
    this.onload = null; this.onerror = null; this.onreadystatechange = null;
    this._headers = []; this._listeners = {};
  }
  WSXHR.prototype._fire = function (type) {
    var ev = { type: type, target: this, currentTarget: this };
    var h = this['on' + type];
    if (typeof h === 'function') h.call(this, ev);
    var ls = this._listeners[type];
    if (ls) for (var i = 0; i < ls.length; i++) ls[i].call(this, ev);
  };
  WSXHR.prototype.addEventListener = function (t, f) {
    (this._listeners[t] || (this._listeners[t] = [])).push(f);
  };
  WSXHR.prototype.removeEventListener = function (t, f) {
    var ls = this._listeners[t]; if (!ls) return;
    var i = ls.indexOf(f); if (i >= 0) ls.splice(i, 1);
  };
  WSXHR.prototype.open = function (method, url, async) {
    this._method = method; this._url = url; this._key = norm(url);
    this._async = async !== false; this.readyState = 1;
  };
  WSXHR.prototype.setRequestHeader = function (k, v) { this._headers.push([k, v]); };
  WSXHR.prototype.getAllResponseHeaders = function () { return ''; };
  WSXHR.prototype.getResponseHeader = function () { return null; };
  WSXHR.prototype.abort = function () { this._aborted = true; if (this._real) this._real.abort(); };
  WSXHR.prototype.send = function (body) {
    var self = this;
    var rec = Object.prototype.hasOwnProperty.call(A, this._key) ? A[this._key] : null;

    if (rec !== null) {
      setTimeout(function () {
        if (self._aborted) return;
        var buf = toBuf(rec);
        self.status = 200; self.statusText = 'OK'; self.readyState = 4;
        if (self.responseType === 'arraybuffer') {
          self.response = buf;
        } else {
          var text = decoder.decode(new Uint8Array(buf));
          self.response = text; self.responseText = text;
        }
        self._fire('readystatechange'); self._fire('load'); self._fire('loadend');
      }, 0);
      return;
    }

    var r = new Real();
    this._real = r;
    r.open(this._method, this._url, this._async);
    if (this.responseType) r.responseType = this.responseType;
    for (var i = 0; i < this._headers.length; i++) r.setRequestHeader(this._headers[i][0], this._headers[i][1]);
    r.onload = function () {
      self.status = r.status; self.readyState = 4; self.response = r.response;
      try { self.responseText = r.responseText; } catch (e) {}
      self._fire('readystatechange'); self._fire('load'); self._fire('loadend');
    };
    r.onerror = function () { self._fire('error'); self._fire('loadend'); };
    r.send(body);
  };

  window.XMLHttpRequest = WSXHR;
})();
`;

function main() {
  const { lang, build, out } = parseArgs(process.argv.slice(2));

  if (build) {
    console.log("▶ Rebuilding standalone bundle…");
    execFileSync("npx", ["vite", "build", "--config", "vite.standalone.config.ts"], {
      cwd: ARTIFACT_DIR,
      stdio: "inherit",
    });
  }

  if (!fs.existsSync(STANDALONE_DIR)) {
    throw new Error(`No standalone build at ${STANDALONE_DIR} — drop --no-build, or run build:standalone first.`);
  }

  const read = (p) => fs.readFileSync(path.join(STANDALONE_DIR, p));
  const b64 = (p) => read(p).toString("base64");

  const langDir = `lang/${lang}`;
  const packPath = `${langDir}/wordsmash.json`;
  if (!fs.existsSync(path.join(STANDALONE_DIR, packPath))) {
    throw new Error(
      `Language "${lang}" is not in the build (${packPath} missing).\n` +
        `   Run: pnpm content:build -- --lang ${lang}   then rebuild.`
    );
  }

  // ── embed every asset the game fetches at runtime ──────────────────────────
  const assets = {};
  assets[packPath] = b64(packPath);
  assets["fonts/fredoka-600.woff2"] = b64("fonts/fredoka-600.woff2");

  const audioDir = `${langDir}/audios`;
  const audios = fs
    .readdirSync(path.join(STANDALONE_DIR, audioDir))
    .filter((f) => f.endsWith(".mp3"))
    .sort();
  for (const f of audios) assets[`${audioDir}/${f}`] = b64(`${audioDir}/${f}`);

  const assetFiles = fs.readdirSync(path.join(STANDALONE_DIR, "assets"));
  const jsName = assetFiles.find((f) => f.endsWith(".js"));
  const cssName = assetFiles.find((f) => f.endsWith(".css"));
  if (!jsName || !cssName) throw new Error("standalone bundle is missing its js/css asset");

  const js = read(`assets/${jsName}`).toString("utf8");
  const css = read(`assets/${cssName}`).toString("utf8");

  // No <!doctype>/<html>/<head>/<body>: the Artifact host wraps this fragment.
  // <title> must appear near the top — it names the page in the tab and gallery.
  const html =
    `<title>Word Smash</title>\n` +
    `<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1" />\n` +
    `<style>\n${safe(css)}\n</style>\n` +
    `<script>window.__WS_ASSETS__ = ${JSON.stringify(assets)};</script>\n` +
    `<script>${shimSource(lang)}</script>\n` +
    `<div id="root"></div>\n` +
    `<script type="module">\n${safe(js)}\n</script>\n`;

  const outFile = out ? path.resolve(out) : path.join(OUT_DIR, `word-smash-${lang}.html`);
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, html);

  const mb = fs.statSync(outFile).size / 1048576;
  console.log(`\n✅ ${path.relative(ARTIFACT_DIR, outFile)}`);
  console.log(`   language : ${lang}`);
  console.log(`   embedded : ${Object.keys(assets).length} asset(s) — ${audios.length} mp3 + pack + font`);
  console.log(`   bundle   : ${jsName} + ${cssName}`);
  console.log(`   size     : ${mb.toFixed(2)} MB`);
  if (mb > SIZE_LIMIT_MB) {
    console.error(`\n❌ Over the ${SIZE_LIMIT_MB} MB Artifact limit — publish will be rejected.`);
    process.exit(1);
  }
  if (mb > SIZE_LIMIT_MB * 0.75) {
    console.log(`   ⚠ approaching the ${SIZE_LIMIT_MB} MB Artifact limit`);
  }
}

try {
  main();
} catch (err) {
  console.error(`\n❌ ${err.message}\n`);
  process.exit(1);
}
