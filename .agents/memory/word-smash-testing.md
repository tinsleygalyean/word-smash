---
name: Word Smash test harness
description: Conventions/quirks of the Vitest+RTL suite for Word Smash gameplay tests.
---

The Word Smash Vitest suite (jsdom + React Testing Library) relies on three setup tricks; break them and the component tests silently fail:

- **Pinned stage rect.** `getBoundingClientRect` is stubbed to 1200×540 at (0,0) so `screenToStage` scale is exactly 1 — pointer-event `clientX/Y` ARE reference-canvas coords. jsdom's default 0×0 rect makes the game divide by zero.
- **requestAnimationFrame stubbed to never fire.** The scatter physics runs on rAF; with it inert, "scattered" pieces keep their pre-smash slot coordinates, making drag/drop assertions deterministic. Don't let fake timers fake rAF (`toFake` list excludes it on purpose).
- **Fake timers exclude `performance`/rAF**, and per-level word order is pinned by pre-seeding `ws_<lang>_queue_<level>` in localStorage before render (the game restores a saved queue instead of shuffling).

**Why:** the game has no test ids; elements are found structurally (piece = div with `will-change: transform`, hammer = parent of `.ws-hammer-rock`, wall plaque = 150px grab div, ghost outline = transparent-color span).

Critical CI-style guards live in the suite: TC-AUD-03 (phoneme map never speaks a letter name — `PHONEME_TTS`/`phonemeApprox` are exported from audio.ts solely for this) and TC-UI-08 (every rendered text node must be pack content, no emoji).
