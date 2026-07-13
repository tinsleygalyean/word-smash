# TESTSPEC — Word Smash

| | |
|---|---|
| **Title** | Word Smash — Test Specification |
| **Status** | Active |
| **Version** | 1.0.0 |
| **Last updated** | 2026-07-13 |
| **Owner/Author** | Tinsley Galyean (with Replit Agent) |

> This TESTSPEC defines **how to verify** the DEVSPEC (behavior) and the UISPEC
> (presentation). Every test case traces to a DEVSPEC module (`I.n`) and/or a
> UISPEC acceptance scenario (§9). It defines the *target* test suite a new team
> should build — **no formal automated unit/integration suite exists today**; the
> current reality (typecheck + packaging integrity checks + manual QA) is noted
> per case so the gap is explicit.

**Reference chain:** PRD → DEVSPEC → UISPEC → **TESTSPEC**.

---

## 1. Test approach & levels

1. **Static checks (exist today).** `pnpm run typecheck` from the workspace root
   (strict TS, all packages). This must pass on any change; docs-only changes must
   not affect it.
2. **Packaging integrity (exists today).** `package:container` runs built-in
   assertions on the two ZIPs (DEVSPEC §I.7). These are the only automated
   behavioral guarantees currently shipping.
3. **Unit tests (target — to build).** Pure-logic modules are directly testable in
   jsdom/node without rendering: physics, storage/migration, event-envelope
   construction, design helpers. Recommended runner: **Vitest** (already available
   at the workspace root).
4. **Component/interaction tests (target — to build).** Render `GameScene` and its
   children with React Testing Library + jsdom; simulate pointer events; assert
   phase transitions and DOM/audio side effects (audio module mocked).
5. **Manual QA (exists today).** Scripted playthrough in the dev preview and the
   `mockup-sandbox`, plus a device/offline smoke of the standalone bundle.

## 2. Fixtures & test data

- **F-PACK-MINI** — a 2-level mini language pack (1 ghost + 1 no-ghost level, 2
  words each; one word with a digraph unit, one CVC) for fast, deterministic
  engine/UI tests. Mirrors the real schema (DEVSPEC §I.1.1).
- **F-PACK-EN** — the shipped English pack (`public/lang/english/wordsmash.json`):
  10 levels × 6 words, 24 distinct words, 144 MP3s. Used for content/coverage and
  packaging checks.
- **F-SAVE-CURRENT** — a `Progress` blob in the current schema (DEVSPEC §I.1.2).
- **F-SAVE-LEGACY** — a legacy save with **multiple plaques per `wordId`** and
  missing `highestLevel`/`playCount`/`levelsPlayed`, for migration tests.
- **F-SEED** — a fixed physics seed for reproducible scatter assertions
  (DEVSPEC §I.4).
- **F-NO-AUDIO** — the pack with all MP3s absent, to force the TTS fallback path.
- **Bridge stub** — a fake `window.ReactNativeWebView.postMessage` that captures
  posted JSON strings for envelope assertions (DEVSPEC §I.6).

## 3. Dry-run & build-and-test sequence

```bash
# A. Static — must pass on every change
pnpm run typecheck

# B. Unit + component suites (once built)
pnpm --filter @workspace/word-smash run test          # target: Vitest

# C. Packaging integrity (behavioral guarantee that exists today)
pnpm --filter @workspace/word-smash run package:container -- --lang english
#    → asserts engine/lang ZIP contents + audio-count parity (DEVSPEC §I.7)

# D. Upload dry-run — prints the exact CMS plan, contacts nothing
pnpm --filter @workspace/scripts run upload:wordsmash -- --lang english --dry-run

# E. Manual QA — dev preview (/) and the mockup-sandbox; offline smoke of
#    dist/standalone/ opened from file://
```

## 4. Test cases

Each case: **ID · what it verifies · method · trace**. Method tags: `AUTO-EXISTS`
(runs today), `AUTO-TARGET` (to build), `MANUAL`.

### 4.1 Game engine / state reducer (DEVSPEC §I.2)

- **TC-ENG-01** Cold load reaches `present` with the first word seated and the
  restored level. `AUTO-TARGET` (component). Trace: I.2, UISPEC 3.2.
- **TC-ENG-02** Full phase cycle for one word: `present→windup→rebuild→complete`
  and back to `present` for the next word. `AUTO-TARGET`. Trace: I.2, UISPEC §9.
- **TC-ENG-03** Completing the 6th word of a level enters `levelComplete`, then the
  next level's first word. `AUTO-TARGET` + `MANUAL`. Trace: I.2, UISPEC 3.7.
- **TC-ENG-04** Reducer purity: dispatching any action performs no audio/DOM/
  storage I/O (spy on those modules; expect zero calls from the reducer).
  `AUTO-TARGET`. Trace: I.2, II.3.
- **TC-ENG-05** Level word order is shuffled once, persisted to `queue_<level>`,
  and restored identically on reload mid-level. `AUTO-TARGET`. Trace: I.2, I.5.

### 4.2 Audio system (DEVSPEC §I.3)

- **TC-AUD-01** With F-PACK-EN, `playWordSlow`/`playWordNatural`/`playUnit` decode
  and play the **recorded** buffer (not the TTS fallback). `AUTO-TARGET` (mock Web
  Audio; assert `decodeAudioData` + buffer play). Trace: I.3, II.5.
- **TC-AUD-02** With F-NO-AUDIO, playback degrades to `speechSynthesis` with **no
  exception**, and units route through the phoneme map. `AUTO-TARGET`. Trace: I.3.
- **TC-AUD-03** **No letter names, ever:** for every unit in F-PACK-EN, the TTS
  fallback string is a phoneme approximation, never the letter name; assert against
  the phoneme map. `AUTO-TARGET`. Trace: I.3, II.4.
- **TC-AUD-04** `playCrash` never returns the same variant twice in a row across
  many calls. `AUTO-TARGET`. Trace: I.3, UISPEC 3.4.
- **TC-AUD-05** `playUnit` does not interrupt an in-progress word playback; word
  playback does interrupt. `AUTO-TARGET`. Trace: I.3.
- **TC-AUD-06** Foley types all produce sound without throwing on a mock context.
  `AUTO-TARGET`. Trace: I.3.

### 4.3 Physics / scatter (DEVSPEC §I.4)

- **TC-PHY-01** With F-SEED, `computeScatterPositions` is deterministic (identical
  output for identical seed+count). `AUTO-TARGET`. Trace: I.4.
- **TC-PHY-02** All scatter targets fall inside the scatter box (inside the safe
  area, not under the dock) for counts 2–6. `AUTO-TARGET`. Trace: I.4, UISPEC §9.
- **TC-PHY-03** Drop acceptance: a tile dropped within `SNAP = 80` reference px of
  the nearest empty slot is accepted (and seats if the unit matches), beyond it
  bounces back. `AUTO-TARGET`. Trace: I.4, UISPEC §9 (correct/incorrect drop).
- **TC-PHY-04** Re-smash re-scatters every tile including seated ones. `AUTO-TARGET`
  + `MANUAL`. Trace: I.4, UISPEC 3.5.

### 4.4 Storage / persistence (DEVSPEC §I.5)

- **TC-STO-01** Round-trip: `saveProgress` then `getProgress` returns an equal
  `Progress`. `AUTO-TARGET`. Trace: I.5.
- **TC-STO-02** F-SAVE-LEGACY migrates to **one plaque per `wordId`**, most-recent
  position/z-order kept. `AUTO-TARGET`. Trace: I.5, I.1.2.
- **TC-STO-03** Migration reconciles `highestLevel`/`playCount`/`levelsPlayed`
  against the `completions` record (never blind-defaults to 1 for a legacy word
  played past level 1). `AUTO-TARGET`. Trace: I.5, IV.4.
- **TC-STO-04** `finishForLevelCount(levelsPlayed)` maps 1→red, 2→teal, 3→gold,
  4+→gold-face; a replay (raising `playCount` but not `levelsPlayed`) does **not**
  advance the finish. `AUTO-TARGET`. Trace: I.5, UISPEC §5.
- **TC-STO-05** Corrupt/malformed JSON in a key yields safe defaults, no throw.
  `AUTO-TARGET`. Trace: I.5, II.3.
- **TC-STO-06** `resetProgress` removes every `ws_<lang>_*` key → back to level 1.
  `AUTO-TARGET`. Trace: I.5.
- **TC-STO-07** Reopen-after-kill restores level, wall layout/z-order, hammer
  stage, finishes, tutorial flag. `MANUAL` (+ `AUTO-TARGET` via storage round-trip).
  Trace: I.5, UISPEC §5/§6.

### 4.5 Event bridge (DEVSPEC §I.6)

- **TC-EVT-01** Outside the container (no bridge) nothing posts and nothing throws.
  `AUTO-TARGET` (no stub present). Trace: I.6, II.3.
- **TC-EVT-02** With the bridge stub, each event posts a `{type:"cr_event",payload}`
  string; envelope has exactly the §I.1.3 fields; `payload_id` is a unique UUID v4
  per payload; `options` present only for `summary_data`. `AUTO-TARGET`. Trace: I.6.
- **TC-EVT-03** `session_start` fires at pack load; `word_completed` at plaque
  landing with the correct `level/word_id/ghost/replay/errors/hints/smash_count`;
  `level_completed` at transition beat 1; `summary_data` rolled up with add/replace
  options. `AUTO-TARGET` + `MANUAL`. Trace: I.6, UISPEC §9.
- **TC-EVT-04** `cr_user_id` comes from the launch URL and is `""` when absent.
  `AUTO-TARGET`. Trace: I.6.

### 4.6 Packaging pipeline (DEVSPEC §I.7)

- **TC-PKG-01** Engine ZIP has `index.html` at root and **no** `lang/`, `*.map`,
  `opengraph.jpg`, or `robots.txt`. `AUTO-EXISTS` (built-in assertion). Trace: I.7.
- **TC-PKG-02** Language ZIP contains **only** `lang/<code>/…` and includes
  `wordsmash.json`. `AUTO-EXISTS`. Trace: I.7.
- **TC-PKG-03** Language ZIP MP3 count **equals** the source `audios/` count (144
  for English). `AUTO-EXISTS`. Trace: I.7, I.1.1.
- **TC-PKG-04** The two ZIPs merge into one tree with no overwrite (engine at root,
  language under `lang/<code>/`). `AUTO-TARGET` (unzip both, assert disjoint).
  Trace: I.7.
- **TC-PKG-05** Standalone bundle uses relative paths only (no `src="/"`, no
  `url(/…)`, no absolute/CDN URLs, no `@import`/CDN font). `AUTO-TARGET` (grep the
  built bundle). Trace: I.7, II.1.
- **TC-PKG-06** Upload dry-run prints the correct MCP sequence and args
  (`hasCoreLevel:false`, `engineSlug:wordsmash`, filenames, icon as `iconBase64`)
  and contacts no server without creds. `AUTO-EXISTS` (dry-run) + `MANUAL` review.
  Trace: I.7.

### 4.7 Offline / non-functional (DEVSPEC §II)

- **TC-NFR-01** No `fetch()`, `<audio>`, or CDN `<script>/<link>/@import` in the
  shipped bundle; all assets load via XHR. `AUTO-TARGET` (grep) + `MANUAL`. Trace: II.1.
- **TC-NFR-02** Opening `dist/standalone/index.html` from `file://` loads the game,
  the bundled font, the language pack, and recorded audio (XHR status 0 handled).
  `MANUAL` (device/desktop `file://`). Trace: II.1, II.5.
- **TC-NFR-03** 30fps floor and particle budgets (chips ≤12, confetti ≤14,
  sparkles ≤6, trail ≤4) hold on a 1GB-RAM-class device. `MANUAL` (profiled). Trace: II.2.
- **TC-NFR-04** Haptics feature-detected: `navigator.vibrate` called on impact
  where supported, silently skipped otherwise. `AUTO-TARGET` + `MANUAL`. Trace: II.1, UISPEC 3.4.

### 4.8 UI / interaction (UISPEC §9)

- **TC-UI-01** Hold-through smash: dragging within 190px takes over the swing,
  scales the hammer, dims the world; holding through splits at breakpoints →
  `rebuild`. `AUTO-TARGET` (component) + `MANUAL`. Trace: UISPEC §9, I.2.
- **TC-UI-02** Release-early cancels with no penalty, plaque untouched, back to
  `present`. `AUTO-TARGET` + `MANUAL`. Trace: UISPEC §9, I.2.
- **TC-UI-03** Correct drop seats flush + plays sound; wrong drop bounces back with
  no buzzer and increments errors. `AUTO-TARGET` + `MANUAL`. Trace: UISPEC §9, I.2.
- **TC-UI-04** Ghost level shows outline letters and mute slots; no-ghost shows
  ghost play buttons that speak the belonging tile's sound. `AUTO-TARGET` + `MANUAL`.
  Trace: UISPEC 4/§9, I.1.1.
- **TC-UI-05** Word complete: fuse→hop→flight; finish blooms; lands at first free
  spot; next plaque drops in. `MANUAL` (+ component asserts for state). Trace: UISPEC 3.6/§9.
- **TC-UI-06** Wall drag: reorder/stack within the wall persists; drag-down over
  the bench replays at the word's highest level, then resumes the sequence.
  `AUTO-TARGET` + `MANUAL`. Trace: UISPEC §5/§9, I.5.
- **TC-UI-07** Hammer shows the correct stage per level (index `level-1`), size
  ramp 76→156, and persists across reload. `AUTO-TARGET` + `MANUAL`. Trace: UISPEC §6, I.5.
- **TC-UI-08** No text/emoji/mascot anywhere in gameplay (scan rendered DOM for
  text nodes in the play area). `AUTO-TARGET` + `MANUAL`. Trace: UISPEC 2/§8, II.4.
- **TC-UI-09** Tutorial hand: appears per the idle/stuck rules, pauses on touch,
  dissolves on hammer touch, and the done-flag persists only after a completed
  smash. `MANUAL` (+ component for flag). Trace: UISPEC §7, I.2/I.5.
- **TC-UI-10** Level transition: plaques bow + replay, hammer upgrades, stage +
  level persist at beat 2, next plaque drops during confetti; tap-to-skip after
  beat 1. `MANUAL`. Trace: UISPEC 3.7/§9.

### 4.9 Content (DEVSPEC §I.1.1)

- **TC-CNT-01** For every word in F-PACK-EN: `units.length === audio.units.length`
  and all referenced MP3 files exist on disk. `AUTO-TARGET`. Trace: I.1.1, I.7.
- **TC-CNT-02** Levels are 1–10; odd levels `ghost:true`, even `ghost:false`; each
  level has 6 words. `AUTO-TARGET`. Trace: I.1.1, UISPEC 4.
- **TC-CNT-03** Recurring words keep a stable `id` across levels while `units` may
  differ (e.g. `cactus` L7/L8 vs L9/L10). `AUTO-TARGET`. Trace: I.1.1, UISPEC §5.

## 5. Validation criteria (release gate)

A build is releasable when:
- **G1** `pnpm run typecheck` passes.
- **G2** All `AUTO-EXISTS` packaging integrity checks pass (TC-PKG-01..03) and the
  upload dry-run prints a correct plan (TC-PKG-06).
- **G3** The `file://` offline smoke passes (TC-NFR-02) with **recorded audio**
  playing (not TTS) and no console errors.
- **G4** No letter name is ever spoken (TC-AUD-03) and no text/emoji/mascot appears
  in gameplay (TC-UI-08).
- **G5** Persistence survives kill/reopen (TC-STO-07) and legacy saves migrate
  correctly (TC-STO-02/03).
- **G6** Once built, the target unit + component suites (§1.3–1.4) are green.

## 6. Coverage matrix (requirement → test case)

| DEVSPEC / UISPEC requirement | Test case(s) |
|---|---|
| I.1.1 Language pack schema & rules | TC-CNT-01/02/03, TC-PKG-03 |
| I.1.2 localStorage schema | TC-STO-01..07 |
| I.1.3 cr_event contract | TC-EVT-01..04 |
| I.2 Engine / reducer | TC-ENG-01..05, TC-UI-01/02/05/10 |
| I.3 Audio system | TC-AUD-01..06 |
| I.4 Physics / scatter | TC-PHY-01..04 |
| I.5 Storage / persistence | TC-STO-01..07, TC-UI-06/07/09 |
| I.6 Event bridge | TC-EVT-01..04, TC-EVT-03 |
| I.7 Packaging pipeline | TC-PKG-01..06, TC-CNT-01 |
| II.1 Offline `file://` constraints | TC-NFR-01/02, TC-PKG-05, TC-AUD-02 |
| II.2 Performance / device | TC-NFR-03 |
| II.3 Error handling | TC-ENG-04, TC-STO-05, TC-EVT-01, TC-AUD-02 |
| II.4 Constraints (no text; sounds not names; no fail) | TC-UI-08, TC-AUD-03, TC-UI-03 |
| II.5 Risks & mitigations | TC-AUD-01, TC-NFR-02, TC-PKG-05 |
| UISPEC §9 Smash hold-through / cancel | TC-UI-01/02, TC-PHY-02 |
| UISPEC §9 Scatter | TC-PHY-01/02, TC-PHY-04 |
| UISPEC §9 Drag correct/incorrect | TC-PHY-03, TC-UI-03 |
| UISPEC §9 Word complete → wall | TC-UI-05, TC-EVT-03 |
| UISPEC §4/§9 Ghost vs no-ghost | TC-UI-04, TC-CNT-02 |
| UISPEC §5/§9 Replay from wall | TC-UI-06, TC-STO-04 |
| UISPEC §6 Hammer 10 stages | TC-UI-07 |
| UISPEC §7 Tutorial hand | TC-UI-09 |
| UISPEC §3.7/§9 Level transition | TC-UI-10, TC-ENG-03, TC-EVT-03 |

## 7. Current reality vs. target

- **Exists today:** `pnpm run typecheck`; `package:container` integrity assertions
  (TC-PKG-01..03); upload dry-run (TC-PKG-06); manual QA in dev/sandbox and a
  `file://` smoke.
- **Not built yet:** the Vitest unit suite (physics, storage/migration, event
  envelopes, design helpers, content validation) and the RTL component suite
  (phase transitions, drag/drop, hint modes, wall). These `AUTO-TARGET` cases
  define the suite a new team should implement; until then their guarantees are
  covered by `MANUAL` QA.

---

## Changelog

- 2026-07-13 — Replit Agent & Tinsley Galyean — Initial spec authored
