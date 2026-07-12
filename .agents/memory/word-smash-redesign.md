---
name: Word Smash reference-canvas redesign
description: Architecture + non-obvious constraints for the Word Smash "Honey & Paint" redesign
---

# Word Smash — "Honey & Paint" redesign

## Reference-canvas layout (the core decision)
All geometry is authored in a fixed **1200×540 reference canvas** and the stage is
COVER-scaled: `--ws-scale = max(vw/1200, vh/540)`, so 16:9 devices crop exactly to
a 16:9 safe area (120px side margins). Pointer events must be converted back to
reference space via `screenToStage()` before any hit-testing; every draggable
component takes `stageRef`.
**Why:** the design contract is pixel-authored art direction; percentage/flex
layout could not reproduce it faithfully. Keep new geometry in reference coords.

## Plaque identity — ONE plaque per wordId (§6)
The English pack repeats ~24 word IDs across levels (ghost vs no-ghost variants).
Per DESIGN-SPEC §6 the wall shows exactly ONE plaque per `wordId`; that plaque
carries a stable `plaqueId`, a cumulative `playCount`, and `highestLevel` (the
highest level ever reached, which drives replay). Wall drag/replay/reorder still
target `plaqueId`, never index. Completions are keyed `${wordId}_L${level}`.
**Why:** an earlier design allowed multiple plaques per word; the redesign
collapsed them.

## localStorage migration must use completions as source of truth
`storage.ts dedupePlaques(raw, completions)` collapses legacy multi-plaque saves.
Legacy plaques predate `highestLevel`/`playCount`, so defaulting them to 1 runs
replays at the WRONG level. Always derive from the completions record: take
`max(comp.highestLevel, level parsed from the "_L<n>" key)` and
`max(comp.playCount)` per word. Dedup uses max (not sum) to avoid double counting.
**Why:** defaulting legacy plaques' `highestLevel` to 1 sends returning players'
replays back to level 1 — completions are the only reliable source of true level.

## Hard offline constraints (Curious Reader file:// WebView)
No `fetch()`, no `<audio>`, no CDN. All binaries (JSON, WOFF2, MP3) load via
`loadBinary()` XHR; `file://` XHR returns **status 0 on success** (not 200) — the
loaders already special-case this. Font loads via `FontFace` from an ArrayBuffer.
Bundle `fredoka-600.woff2` (Fredoka **SemiBold 600**, Latin range U+0000–00FF) —
DESIGN-SPEC §2 mandates weight 600, NOT the heavier Fredoka One. All tile/plaque
letters render at `font-weight: 600`; the Latin subset covers every game glyph.

## No text/emoji/mascot in GAMEPLAY
Gameplay must contain zero text/emoji/mascot (the old "Level N" indicator was
removed). The pre-game loading and hard-error shell screens still use minimal
text — acceptable as fault/boot states, not gameplay.

## Level-transition tap-skip window (§8)
"~6s, tap-to-skip **after** beat 1" means skip is enabled ONLY during beats 2–3
(recap beat 1 must always play in full). `LevelTransition` gates the overlay
`pointerEvents` and the `skip()` handler on `beat >= 2`. Beat callbacks
(`onPersist`/`onStartNext`/`onDone`) are ref-guarded and idempotent, so skip can
fire them again safely.
**Why:** a code review initially had the window inverted (skip during beats 0–1).

## Wall drag-down replay resumes the sequence (does NOT restore in-progress work)
§6/§8 line 74: "returns on completion, then the normal level sequence resumes."
`restoreAfterReplay()` re-`START_WORD`s the interrupted word fresh from the saved
`preReplay {levelNum, queue}` snapshot — it deliberately does NOT rebuild a
half-assembled tray verbatim. Restarting the current word satisfies "the normal
level sequence resumes"; the spec never asks to preserve mid-rebuild piece state.
**Why:** an evaluation flagged this as "incomplete restore," but restoring
verbatim is out of scope per the spec wording — kept intentionally simple.

## Animation sequencing
Single `useReducer` in `GameScene.tsx` for discrete state; multi-step timed
animations (smash scatter, word-complete fuse/hop/flight-to-wall, level
transition) are orchestrated imperatively with `setTimeout`, never in the reducer.
Phases: loading→present→windup→rebuild→complete→levelComplete.
