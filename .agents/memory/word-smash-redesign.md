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

## CSS keyframe `transform` clobbers inline positioning transforms
Any element positioned with an inline `transform: translate(x, y)` will be
teleported to the top-left corner if a CSS animation class (e.g. `.ws-hop`, whose
keyframes set `transform: translateY(...)`) is applied to the SAME element — the
keyframe's `transform` fully overrides the inline one.
**Why:** the completion plaque "appeared in the upper-left corner" because
`.ws-hop` was on the same div that held its `translate` position.
**How to apply:** split into two nested divs — OUTER owns positioning
(`translate`) + slide transition, INNER owns the keyframe animation. Same pattern
already needed for hammer spin (spin on inner, position on outer).

## New wall plaques must land on top (zOrder = maxZ + 1)
Because dragging a plaque bumps its `zOrder` to `maxZ + 1`, a freshly completed
plaque created with `zOrder = plaques.length` can land UNDER a previously
front-brought plaque. Always create new plaques at `maxZ + 1` too.

## Docked hammer must be hidden during the level transition
`LevelTransition` draws its own hammer; the normal `<Hammer>` in GameScene must be
gated on `!state.transition` or a duplicate/clone sits on the dock during the
upgrade sequence.

## The upgrade transition must reuse the real hammer SVG, not a copy
`LevelTransition` and the real `Hammer` share ONE `HammerSVG` renderer (exported
from `Hammer.tsx`). A previous separate `FlourishHammer` copy omitted several
recipe decorations (handle ring, stripe, 2nd gold band, cream dot, sparkle), so at
the upgrade flash the hammer showed only a partial new form and the rest "popped
in" only when the real hammer returned to dock.
**Why:** two hand-maintained SVGs silently drift.
**How to apply:** any hammer drawn anywhere must go through the shared `HammerSVG`.
It uses `useId()` for its gradient id so the multiple copies drawn during the spin
don't collide.

## Letters win the touch over the docked hammer
Draggable `Piece` tiles render with `zIndex: 50 + piece.zIndex` so a letter near
the bottom-right hammer dock (hammer dock `zIndex: 40`) captures pointerdown
instead of the hammer. The swinging hammer uses `zIndex: 900` (windup/return) so
it still sits above pieces mid-swing.

## Plaque identity — ONE plaque per wordId (§6)
The English pack repeats ~24 word IDs across levels (ghost vs no-ghost variants).
Per DESIGN-SPEC §6 the wall shows exactly ONE plaque per `wordId`; that plaque
carries a stable `plaqueId`, a cumulative `playCount`, `highestLevel` (the
highest level ever reached, which drives replay), and `levelsPlayed`. Wall
drag/replay/reorder still target `plaqueId`, never index. Completions are keyed
`${wordId}_L${level}`.
**Why:** an earlier design allowed multiple plaques per word; the redesign
collapsed them.

## Plaque finish advances by DISTINCT levels, NOT play count
The plaque colour finish (1 level red · 2 teal · 3 gold · 4+ gold-face) is driven
by `levelsPlayed` (distinct levels completed for the word), NOT cumulative
`playCount`. `finishForLevelCount(levelsPlayed)` is the only finish function.
New-level detection: on completion `isNewLevel = !existingComp` (existingComp is
the `${wordId}_L${level}` completion key); increment `levelsPlayed` only when true.
Replays run at `highestLevel`, which already has a completion key, so they never
advance the finish. Migration derives `levelsPlayed` = count of distinct
completion keys per word (`deriveFromCompletions` seenLevels set).
**Why:** product decision — dragging a wall plaque down to replay must NOT change
its colour; only reaching a genuinely new level should. `playCount` is still
tracked (analytics / cr_event) but must never drive the finish again.

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

## Level transition is a single hammer-upgrade sequence (reworked, supersedes §8)
The DESIGN-SPEC §8 three-beat transition (earned-plaques recap + confetti
practice-swing smash) was **deliberately cut** by user request. `LevelTransition`
now runs ONE focused sequence: dim+spotlight → hammer hops dock→center → spins ×2
(ghost blur streaks) → white flash lands the new stage (bigger+paint) + cymbal +
haptic → radiant burst + sparkles → hammer returns to dock → next word revealed.
Persist (`onPersist`) fires at the flash; `onStartNext` loads the next word during
the return; `onDone` removes the overlay. All three callbacks are ref-guarded and
idempotent; a tap anytime fast-forwards them all.
**Why:** DESIGN-SPEC.md §8 is now OUT OF DATE for this flow — trust the code, not
the spec, for the transition. No recap, no confetti, no tap-skip-window gating.
**Gotcha:** the return-to-dock hammer MUST match the real `Hammer` dock pose
exactly — `translate(x - w/2, y - h*0.62) rotate(-26deg)`, `transformOrigin
50% 78%`, nested outer(position)/inner(spin) divs — or the handoff visibly pops
when the overlay unmounts (the normal docked Hammer sits underneath).

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

## Audio: language-pack paths are pack-relative — must be prefixed at load
Pack stores audio paths as `audios/<file>.mp3` (relative to the pack dir), but the
loadBinary XHR resolves against the document, not the JSON. `resolveAudioPaths()`
in `App.tsx` prepends `./lang/{lang}/` at load. Without it the XHR hits the SPA
fallback (index.html, HTTP **200** — not a 404), decodeAudioData fails, and audio
silently falls back to Web Speech TTS.
**Why:** the bug was invisible through M1/M2 because no real MP3s existed to
exercise the path; a 200-returning SPA fallback masks a "missing file". Any new
lang pack or asset loaded by relative path needs the same prefixing.

## Real phoneme audio (M3) — never feed a bare letter to TTS
MP3s in `public/lang/english/audios/` are ElevenLabs TTS synthesised from phonetic
spellings (b→"buh", s→"sssss", ee→"eee"), NEVER a bare letter, so a letter name
can never be produced. Vowels/ambiguous letters are spelled per word context
(baby a→"ay", cat a→"ah", pencil c→"sssss" /s/, zebra e→"eee"). Regenerating or
adding words must keep this rule and cover every per-word unit file in the pack.
**Why:** the product's core literacy rule is phoneme SOUNDS not letter names;
enforcing it at the audio source (not just runtime) makes violations impossible.
