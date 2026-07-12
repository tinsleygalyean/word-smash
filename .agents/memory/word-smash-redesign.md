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

## Plaque identity — a word can recur across levels
The English pack repeats ~24 word IDs across levels (ghost vs no-ghost variants),
so the SAME `wordId` can legitimately appear on the wall more than once. Wall
plaques therefore carry a stable `plaqueId`; all wall drag/replay/reorder/
play-count operations must target `plaqueId`, NOT `wordId`. Keying wall behaviour
by `wordId` mutates multiple plaques at once.
**Why:** a code review caught this exact bug. Also completions are keyed
`${wordId}_L${level}` for the same reason.

## Hard offline constraints (Curious Reader file:// WebView)
No `fetch()`, no `<audio>`, no CDN. All binaries (JSON, WOFF2, MP3) load via
`loadBinary()` XHR; `file://` XHR returns **status 0 on success** (not 200) — the
loaders already special-case this. Font loads via `FontFace` from an ArrayBuffer.
Use the full-glyph `fredoka-one.woff2` (a weight-600 subset had missing glyphs).

## No text/emoji/mascot in GAMEPLAY
Gameplay must contain zero text/emoji/mascot (the old "Level N" indicator was
removed). The pre-game loading and hard-error shell screens still use minimal
text — acceptable as fault/boot states, not gameplay.

## Animation sequencing
Single `useReducer` in `GameScene.tsx` for discrete state; multi-step timed
animations (smash scatter, word-complete fuse/hop/flight-to-wall, level
transition) are orchestrated imperatively with `setTimeout`, never in the reducer.
Phases: loading→present→windup→rebuild→complete→levelComplete.
