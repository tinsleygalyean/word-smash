#!/usr/bin/env node
// Generate `public/lang/<code>/wordsmash.json` from the Word Smash levels
// Google Sheet — the authoritative source for level and word content.
//
// The sheet has one tab per language. Each content row is three columns:
//
//   level | word with dashes at breakpoints | ghost (y/n)
//
// Columns to the right are the team's audio-tracking notes and are ignored.
//
// Every audio path is DERIVED from the word and its units, never read from the
// sheet, so the sheet stays a content document and the naming convention lives
// in exactly one place (see `wordAudio`).
//
// Usage:
//   node scripts/build-content.mjs [--lang <code>|--all] [--check] [--from-csv <file>]
//   pnpm --filter @workspace/word-smash run content:build -- --all
//
// Flags:
//   --lang <code>   build one language (default: english)
//   --all           build every language in content.config.json
//   --check         validate and diff only; write nothing, non-zero exit on drift
//   --from-csv <f>  read a saved CSV export instead of fetching the sheet
//                   (offline/no-network path; see docs/CONTENT_PIPELINE.md)
//   --snapshot      also write the fetched sheet CSV to dist/content/
//
// Network: this script fetches over HTTPS at BUILD time. That is unrelated to
// the game's offline rule — nothing here ships into the bundle.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ARTIFACT_DIR = path.resolve(fileURLToPath(import.meta.url), "..", "..");
const CONFIG_PATH = path.join(ARTIFACT_DIR, "content.config.json");
const LANG_ROOT = path.join(ARTIFACT_DIR, "public", "lang");
// Anything written under public/ is copied into the build by Vite and then
// swept into the language ZIP by `zip -r lang/<code>` — i.e. shipped to a
// child's device. Working files that are not game assets go here instead.
const WORK_DIR = path.join(ARTIFACT_DIR, "dist", "content");

// ── args ─────────────────────────────────────────────────────────────────────
function parseArgs(argv) {
  const args = { lang: null, all: false, check: false, fromCsv: null, snapshot: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--") continue;
    else if (a === "--all") args.all = true;
    else if (a === "--check") args.check = true;
    else if (a === "--snapshot") args.snapshot = true;
    else if (a === "--lang") args.lang = argv[++i];
    else if (a.startsWith("--lang=")) args.lang = a.slice("--lang=".length);
    else if (a === "--from-csv") args.fromCsv = argv[++i];
    else if (a.startsWith("--from-csv=")) args.fromCsv = a.slice("--from-csv=".length);
    else throw new Error(`Unknown argument: ${a}`);
  }
  if (args.lang && /[^a-z0-9_-]/.test(args.lang)) {
    throw new Error(`Invalid --lang "${args.lang}" (lowercase, no spaces)`);
  }
  if (!args.lang && !args.all) args.lang = "english";
  if (args.all && args.fromCsv) {
    throw new Error("--from-csv builds a single language; use it with --lang, not --all");
  }
  return args;
}

// ── CSV ──────────────────────────────────────────────────────────────────────
// RFC-4180 enough for Google's gviz export: quoted fields, "" escapes, CRLF.
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (c !== "\r") field += c;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  return rows;
}

async function fetchTabCsv(sheetId, tab) {
  const url =
    `https://docs.google.com/spreadsheets/d/${encodeURIComponent(sheetId)}` +
    `/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tab)}`;
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) {
    throw new Error(
      `Sheet fetch failed (HTTP ${res.status}) for tab "${tab}".\n` +
        `   URL: ${url}\n` +
        `   The sheet must be shared as "Anyone with the link can view", and the\n` +
        `   tab name in content.config.json must match the sheet exactly.\n` +
        `   Offline? Export the tab as CSV and pass --from-csv <file>.`
    );
  }
  const body = await res.text();
  if (/^\s*<(!doctype|html)/i.test(body)) {
    throw new Error(
      `Sheet fetch for tab "${tab}" returned an HTML page, not CSV — the sheet is\n` +
        `   almost certainly not link-shared for viewing. Fix sharing, or use --from-csv.`
    );
  }
  return body;
}

// ── content model ────────────────────────────────────────────────────────────
// Audio filenames for one word. Whole-word clips are per word; unit clips are
// SHARED across every word that uses the unit — `audios/a.mp3` serves cat, hat,
// flag, baby … — because the recorded phoneme/syllable sounds are the same in
// every word of the pack (decided 2026-09, see DECISIONS.md). A unit that repeats
// inside a word ("cactus" → c,a,c,t,u,s) simply references the same clip twice.
// This must match the recorded files in public/lang/<code>/audios/ exactly.
function wordAudio(id, units) {
  return {
    slow: `audios/${id}_slow.mp3`,
    natural: `audios/${id}_natural.mp3`,
    units: units.map((u) => `audios/${u}.mp3`),
  };
}

// Turn the sheet rows into the level structure, collecting every problem rather
// than throwing on the first one — a content editor should see all of it at once.
function buildPack(langCode, rows, errors, warnings) {
  const byLevel = new Map();
  const seenPerLevel = new Map(); // level → Set(word)

  rows.forEach(({ level, word, ghost, line }) => {
    const where = `row ${line}`;

    if (!/^\d+$/.test(level)) { errors.push(`${where}: level "${level}" is not a whole number`); return; }
    const lvl = Number(level);
    if (lvl < 1) { errors.push(`${where}: level ${lvl} must be 1 or greater`); return; }

    const g = ghost.trim().toLowerCase();
    if (g !== "y" && g !== "n") {
      errors.push(`${where} (level ${lvl}, "${word}"): ghost must be "y" or "n", got "${ghost}"`);
      return;
    }

    const raw = word.trim();
    if (!raw) { errors.push(`${where}: word is empty`); return; }
    if (/\s/.test(raw)) { errors.push(`${where}: word "${raw}" contains whitespace`); return; }
    if (raw !== raw.toLowerCase()) {
      errors.push(`${where}: word "${raw}" must be lowercase`);
      return;
    }

    const units = raw.split("-");
    if (units.some((u) => u === "")) {
      errors.push(`${where}: word "${raw}" has an empty unit (leading, trailing, or doubled dash)`);
      return;
    }
    if (units.length < 2) {
      errors.push(`${where}: word "${raw}" has no breakpoint — it needs at least one dash`);
      return;
    }

    const id = units.join("");
    const seen = seenPerLevel.get(lvl) ?? new Set();
    if (seen.has(id)) {
      errors.push(`${where}: "${id}" appears twice in level ${lvl}`);
      return;
    }
    seen.add(id);
    seenPerLevel.set(lvl, seen);

    const entry = byLevel.get(lvl) ?? { level: lvl, ghost: g === "y", words: [], ghostRows: new Set() };
    entry.ghostRows.add(g);
    entry.words.push({
      id,
      display: id,
      units,
      audio: wordAudio(id, units),
    });
    byLevel.set(lvl, entry);
  });

  const levels = [...byLevel.values()].sort((a, b) => a.level - b.level);

  for (const l of levels) {
    if (l.ghostRows.size > 1) {
      errors.push(
        `level ${l.level}: mixed ghost values (${[...l.ghostRows].join(", ")}) — ` +
          `every word in a level shares one ghost setting`
      );
    }
    delete l.ghostRows;
  }

  // Levels are progressed through in order, so a gap would strand the player.
  levels.forEach((l, i) => {
    if (l.level !== i + 1) {
      errors.push(`level numbering is not contiguous from 1 — expected ${i + 1}, found ${l.level}`);
    }
  });

  if (!levels.length) errors.push("no content rows found — is the tab name right?");

  for (const l of levels) {
    if (l.words.length < 2) {
      warnings.push(`level ${l.level} has only ${l.words.length} word(s); levels are normally groups of several`);
    }
  }

  return { langCode, levels };
}

// Audio is recorded separately (ElevenLabs, see replit.md M3). The generator
// never invents recordings — it reports exactly which files a content change
// would require, and refuses to emit a pack that points at missing audio.
function checkAudio(pack, langCode, errors) {
  const dir = path.join(LANG_ROOT, langCode, "audios");
  const have = fs.existsSync(dir) ? new Set(fs.readdirSync(dir)) : new Set();
  const need = new Set();

  for (const level of pack.levels) {
    for (const w of level.words) {
      for (const p of [w.audio.slow, w.audio.natural, ...w.audio.units]) {
        if (/^([a-z]+:)?\/\//i.test(p) || p.startsWith("/")) {
          errors.push(`absolute audio URL "${p}" — paths must stay relative for offline file:// use`);
        }
        need.add(p.replace("audios/", ""));
      }
    }
  }

  const missing = [...need].filter((f) => !have.has(f)).sort();
  const unused = [...have].filter((f) => f.endsWith(".mp3") && !need.has(f)).sort();
  return { missing, unused, needed: need.size, present: have.size };
}

// ── serialization ────────────────────────────────────────────────────────────
// Match the committed file's house style byte-for-byte: objects expanded at
// 2-space indent, arrays of strings inline. A plain JSON.stringify would
// reformat the whole file and bury real content changes in diff noise.
function serialize(pack) {
  const s = JSON.stringify;
  const inline = (arr) => `[${arr.map(s).join(", ")}]`;
  const out = [];
  out.push("{");
  out.push(`  "langCode": ${s(pack.langCode)},`);
  out.push(`  "levels": [`);
  pack.levels.forEach((level, li) => {
    out.push("    {");
    out.push(`      "level": ${level.level},`);
    out.push(`      "ghost": ${level.ghost},`);
    out.push(`      "words": [`);
    level.words.forEach((w, wi) => {
      out.push("        {");
      out.push(`          "id": ${s(w.id)},`);
      out.push(`          "display": ${s(w.display)},`);
      out.push(`          "units": ${inline(w.units)},`);
      out.push(`          "audio": {`);
      out.push(`            "slow": ${s(w.audio.slow)},`);
      out.push(`            "natural": ${s(w.audio.natural)},`);
      out.push(`            "units": ${inline(w.audio.units)}`);
      out.push(`          }`);
      out.push(`        }${wi === level.words.length - 1 ? "" : ","}`);
    });
    out.push(`      ]`);
    out.push(`    }${li === pack.levels.length - 1 ? "" : ","}`);
  });
  out.push(`  ]`);
  out.push("}");
  return out.join("\n") + "\n";
}

// ── per-language build ───────────────────────────────────────────────────────
async function buildLang(langCode, tab, config, args) {
  console.log(`\n▶ ${langCode}  (sheet tab "${tab}")`);

  let csv;
  if (args.fromCsv) {
    csv = fs.readFileSync(args.fromCsv, "utf8");
    console.log(`  source: ${args.fromCsv}`);
  } else {
    csv = await fetchTabCsv(config.sheetId, tab);
    console.log(`  source: docs.google.com/spreadsheets/d/${config.sheetId} → "${tab}"`);
  }

  const rows = parseCsv(csv)
    .map((cells, i) => ({
      level: (cells[0] ?? "").trim(),
      word: (cells[1] ?? "").trim(),
      ghost: (cells[2] ?? "").trim(),
      line: i + 1,
    }))
    // Header/spacer rows have a non-numeric first column; content rows start
    // with a level number. Anything else is the team's notes to the right.
    .filter((r) => /^\d+$/.test(r.level) && r.word !== "");

  console.log(`  rows:   ${rows.length} content row(s)`);

  const errors = [];
  const warnings = [];
  const pack = buildPack(langCode, rows, errors, warnings);
  const audio = errors.length ? null : checkAudio(pack, langCode, errors);

  if (audio?.missing.length) {
    errors.push(
      `${audio.missing.length} audio file(s) referenced but not present in ` +
        `public/lang/${langCode}/audios/:\n     ` +
        audio.missing.join("\n     ") +
        `\n   Record these before shipping — see docs/CONTENT_PIPELINE.md ("Adding a word").`
    );
  }
  if (audio?.unused.length) {
    warnings.push(
      `${audio.unused.length} unused recording(s) in audios/ (no longer referenced): ` +
        audio.unused.join(", ")
    );
  }

  for (const w of warnings) console.log(`  ⚠ ${w}`);

  if (errors.length) {
    console.error(`\n❌ ${langCode}: ${errors.length} problem(s) in the sheet\n`);
    for (const e of errors) console.error(`   • ${e}`);
    console.error("");
    return { ok: false, changed: false };
  }

  const text = serialize(pack);
  const outDir = path.join(LANG_ROOT, langCode);
  const outFile = path.join(outDir, "wordsmash.json");
  const before = fs.existsSync(outFile) ? fs.readFileSync(outFile, "utf8") : null;
  const changed = before !== text;

  const words = pack.levels.reduce((n, l) => n + l.words.length, 0);
  console.log(
    `  built:  ${pack.levels.length} level(s), ${words} word entries, ${audio.needed} audio file(s) — all present`
  );

  if (args.check) {
    console.log(changed ? `  ⚠ DRIFT: ${path.relative(ARTIFACT_DIR, outFile)} differs from the sheet` : `  ✅ up to date with the sheet`);
    return { ok: !changed, changed };
  }

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outFile, text);
  console.log(`  wrote:  ${path.relative(ARTIFACT_DIR, outFile)}${changed ? " (changed)" : " (no change)"}`);

  if (args.snapshot) {
    // dist/content/, never public/ — a CSV under public/ would ship to devices
    // inside the language ZIP. See WORK_DIR.
    fs.mkdirSync(WORK_DIR, { recursive: true });
    const snap = path.join(WORK_DIR, `${langCode}-source.csv`);
    fs.writeFileSync(snap, csv);
    console.log(`  wrote:  ${path.relative(ARTIFACT_DIR, snap)}`);
  }

  return { ok: true, changed };
}

// ── main ─────────────────────────────────────────────────────────────────────
async function main() {
  const args = parseArgs(process.argv.slice(2));
  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));

  const codes = args.all ? Object.keys(config.languages) : [args.lang];
  for (const code of codes) {
    if (!config.languages[code]) {
      console.error(
        `\n❌ Language "${code}" is not in content.config.json.\n` +
          `   Known: ${Object.keys(config.languages).join(", ")}\n` +
          `   Add its tab to the sheet, then add an entry here.\n`
      );
      process.exit(1);
    }
  }

  console.log(
    `╔══════════════════════════════════════════════════════╗\n` +
      `║  Word Smash — language pack build${args.check ? " (check only)" : "                  "}   ║\n` +
      `╚══════════════════════════════════════════════════════╝`
  );

  const results = [];
  for (const code of codes) {
    results.push([code, await buildLang(code, config.languages[code].tab, config, args)]);
  }

  const failed = results.filter(([, r]) => !r.ok);
  if (failed.length) {
    if (args.check) {
      console.error(
        `\n❌ ${failed.length} language(s) out of date with the sheet: ` +
          `${failed.map(([c]) => c).join(", ")}\n   Run without --check to regenerate.\n`
      );
    }
    process.exit(1);
  }

  const changed = results.filter(([, r]) => r.changed).map(([c]) => c);
  console.log(
    `\n✅ ${results.length} language(s) ${args.check ? "match the sheet" : "built"}` +
      (!args.check && changed.length ? ` — content changed: ${changed.join(", ")}` : "") +
      (!args.check && !changed.length ? " — no content changes" : "")
  );
  if (!args.check && changed.length) {
    console.log(`   Next: pnpm game:build   (rebuild engine + language ZIPs)`);
  }
}

main().catch((err) => {
  console.error(`\n❌ ${err.message}\n`);
  process.exit(1);
});
