#!/usr/bin/env node
// Create a local `.env` from `.env.example` and open it for editing.
//
// The key is typed by a person, straight into their editor. This script never
// asks for it, never receives it as an argument, and never reads an existing
// `.env` back — it only checks, by regular expression, whether each variable
// has a non-empty value. That keeps the secret out of shell history, out of
// process arguments, and out of any AI conversation driving this repo.
//
// Usage:
//   pnpm env:init             create if missing, then open in an editor
//   pnpm env:init --status    report what is set, change nothing
//   pnpm env:init --no-open   create it but do not launch an editor

import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), "..", "..");
const ENV_FILE = path.join(REPO_ROOT, ".env");
const TEMPLATE = path.join(REPO_ROOT, ".env.example");
const KEYS = ["CR_CMS_SERVER_URL", "CR_MCP_API_KEY"];

const argv = process.argv.slice(2).filter((a) => a !== "--");
const statusOnly = argv.includes("--status");
const noOpen = argv.includes("--no-open");

// Presence only. Never returns, logs, or stores a value.
function status() {
  if (!fs.existsSync(ENV_FILE)) return null;
  const text = fs.readFileSync(ENV_FILE, "utf8");
  return Object.fromEntries(
    // Horizontal whitespace only: `\s` would match newlines and let a blank
    // `KEY=` be satisfied by a later line.
    KEYS.map((k) => [k, new RegExp(`^[ \\t]*${k}[ \\t]*=[ \\t]*\\S`, "m").test(text)])
  );
}

function report(state) {
  console.log(`\n  .env  ${path.relative(process.cwd(), ENV_FILE)}`);
  for (const k of KEYS) console.log(`    ${state[k] ? "✅" : "○ "} ${k}  ${state[k] ? "set" : "not set"}`);
}

function openEditor() {
  // Prefer the user's own editor; fall back to the platform default opener.
  const editor = process.env.VISUAL || process.env.EDITOR;
  try {
    if (editor) {
      // Detach: a terminal editor should own the tty, a GUI one should not block.
      spawn(editor, [ENV_FILE], { stdio: "inherit", detached: !/vim?|nano|emacs|hx|nvim/.test(editor) });
      return editor;
    }
    if (process.platform === "darwin") { execFileSync("open", ["-e", ENV_FILE]); return "TextEdit"; }
    if (process.platform === "win32") { execFileSync("cmd", ["/c", "start", "", ENV_FILE]); return "the default editor"; }
    execFileSync("xdg-open", [ENV_FILE]); return "the default editor";
  } catch {
    return null;
  }
}

function main() {
  const existing = status();

  if (statusOnly) {
    if (!existing) {
      console.log(`\n  No .env yet — run: pnpm env:init\n`);
      process.exit(0);
    }
    report(existing);
    console.log("");
    process.exit(KEYS.every((k) => existing[k]) ? 0 : 1);
  }

  if (existing) {
    console.log(`\n▶ .env already exists — leaving it alone.`);
    report(existing);
  } else {
    if (!fs.existsSync(TEMPLATE)) {
      console.error(`\n❌ No .env.example to copy from.\n`);
      process.exit(1);
    }
    fs.copyFileSync(TEMPLATE, ENV_FILE);
    console.log(`\n▶ Created .env from .env.example`);
    console.log(`  The CMS server URL is filled in; the API key is blank.`);
  }

  const state = status();
  if (state[KEYS[1]]) {
    console.log(`\n✅ Both variables are set. Verify with a dry run (contacts no server):`);
    console.log(`     pnpm game:upload\n`);
    return;
  }

  if (!noOpen) {
    const where = openEditor();
    if (where) console.log(`\n▶ Opened .env in ${where}.`);
    else console.log(`\n▶ Could not open an editor — edit .env yourself.`);
  }

  console.log(`
  Paste the CMS API key after CR_MCP_API_KEY= and save.
  Ask the Curious Learning team for it if you do not have one.

  Do NOT paste the key into a chat, a commit, or a screenshot — type it
  straight into the editor. This repo never prints its value back.

  Then check it took:
     pnpm env:init --status

  Skipping this is fine — you only need it to upload to the CMS. Building,
  testing, and previewing the game need no credentials.
`);
}

try {
  main();
} catch (err) {
  console.error(`\n❌ ${err.message}\n`);
  process.exit(1);
}
