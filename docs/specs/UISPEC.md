# UISPEC — Word Smash

| | |
|---|---|
| **Title** | Word Smash — UI / Interaction Specification |
| **Status** | Active |
| **Version** | 1.0.0 |
| **Last updated** | 2026-07-13 |
| **Owner/Author** | Tinsley Galyean (with Replit Agent) |

> This UISPEC defines the **user-facing surface**: layout, visual system, every
> screen/phase, and the acceptance criteria for the key interactions. It realizes
> the PRD and **references the DEVSPEC for behavior** rather than restating it.
> Where a rule concerns *how it works*, this document cites the DEVSPEC section;
> where it concerns *how it looks/moves/feels*, the rule lives here.
>
> The approved visual contract is `attached_assets/word_smash_design/handoff/DESIGN-SPEC.md`
> ("Honey & Paint"); this UISPEC is the engineering-facing distillation of it.

**Reference chain:** PRD → DEVSPEC → **UISPEC** → TESTSPEC.

---

## 1. Canvas & layout geometry

- **Reference canvas: 1200 × 540.** All interactive geometry is authored in this
  fixed space and **cover-scaled** to the device (`--ws-scale = max(vw/1200,
  vh/540)`), so 16:9 devices crop exactly to the 16:9 safe area. Pointer
  coordinates convert back to reference space via `screenToStage()` (DEVSPEC §I.4,
  `src/game/coords.ts`). Constants live in `src/game/design.ts`.
- **Safe area:** 960 × 540 centered → **120px margins left/right** (`SAFE_MARGIN
  = 120`). All interactive elements sit inside it; background wood may bleed to the
  device edges. Physics must never drop a tile outside the safe area or under the
  hammer dock (DEVSPEC §I.4).
- **Zones:** **Wall** = top ~46% (`WALL_H = round(540·0.46) ≈ 248`); **Bench** =
  bottom ~54%. The bench front edge is a highlight strip at the 46% line.
- **Hammer dock:** bottom-right inside the safe area, `HAMMER_DOCK = { x: 1012,
  y: 428 }`.
- **Tray/word anchor:** `TRAY_CENTER = { x: 548, y: 356 }` (word seats here in
  `present` and `rebuild`).
- **Tile/plaque sizing:** height `PIECE_H = 122`, corner radius `16`, gap `8`;
  width grows with glyph count (`unitWidth`, min 104). Minimum touch target 88px
  at reference scale.
- **Hammer takeover radius:** `SNAP_RADIUS = 190` (distance from plaque center at
  which the swing is taken over). **Drop-to-slot acceptance:** `SNAP = 80`
  reference px from the nearest empty slot center (DEVSPEC §I.4).

## 2. Visual language — "Honey & Paint"

Warm birch workshop; bright, hand-crafted, cozy. **No text anywhere in-game. No
emoji. No mascot.** (Product rule — DEVSPEC §II.4.)

**Palette** (hex; canonical values in `src/game/design.ts` `C`):
- Wall gradient `#e3c491 → #d7b47e → #cba76f`; plank lines `rgba(120,80,40,.14)`;
  warm window-light pool `rgba(255,244,214,.5)`.
- Bench `#eed0a0 → #e5c188` then `#d3ab70 → #c69c60`; edge strip `#f8e0b4 →
  #eed0a0`; board lines `rgba(120,80,40,.08)`.
- Plaque/tile face `#faeed2 → #f2e0b8`, resting shadow base `#a3713d`.
- Neutral ink (unsmashed) `#5a4028` (alt `#4a2e18`).
- Red `#c9553e` / dark `#8f3a29` / tint `#e88a6f`.
- Teal `#3d8f83` / dark `#2a6459` / tint `#8ccabf`.
- Gold `#e0a13c`; gold ink on cream `#b98a2e`; gold face `#f6d488 → #e9b95a`,
  gold ink `#8a5c18`.
- Wood handle `#a5713c` stroke `#7c5128`; raw wood `#b98a55` stroke `#8a6236`.
- Recess `rgba(90,55,20,.23)`; flash `#fff3d6` / `#ffd98f`.

**Color identity of units:** unsmashed the word is a single neutral ink; once
smashed each tile shows a band+letter color cycling **red → teal → gold** by unit
index (`unitColorId`).

**Typography:** **Fredoka SemiBold (600)** for all letters/words, bundled as a
local WOFF2 and applied via `FontFace` (DEVSPEC §II.1). Letters ~66px on a 122px
tile. No other type anywhere.

## 3. Phase-by-phase screens & states

Phases and their behavior are defined in DEVSPEC §I.0/§I.2. This section defines
what each phase **looks like** and its visibility rules.

### 3.1 `loading`
Radial-gradient warm background with three bouncing dots. No wall, bench, or
hammer. Present while the language pack, font, and progress load. Leaves to
`present` when ready.

### 3.2 `present` — before smash (`screens/01`)
- The whole word arrives as **ONE plaque** seated in a routed tray on the bench:
  uniform cream face, even letter spacing, single neutral ink, **zero hint of the
  breakpoints** (no seams, bands, or spacing changes).
- On entry: soft "thunk" drop; the word auto-plays **slowly once** with amber
  sound-rings expanding in sync; then a gentle idle breathe.
- **Listen affordances:** touching the plaque plays the word slowly (+ rings);
  tapping the docked hammer (tap, not drag) also plays the current word.
- The docked hammer idles with a slow rock.

### 3.3 `windup` — hold-through (`screens/02`)
- The child **drags** the hammer from its dock. When it enters `SNAP_RADIUS` (190)
  the game takes over: the hammer winds up **and scales toward the camera** (ease-
  in, filling the screen), the world dims (~50% vignette), a rising whoosh plays.
- The child must **keep holding through the whole swing.** Releasing early cancels:
  the hammer glides back to dock, **no penalty**, plaque untouched (DEVSPEC §I.2).
- Apex hangs briefly, then the strike snaps down.

### 3.4 Impact (transition into `rebuild`) (`screens/03`)
Simultaneous (never sequential): the plaque **splits exactly at the level-data
breakpoints** (the reveal is the reward); a **surprise crash SFX** (no immediate
repeat — DEVSPEC §I.3); **screen shake**; **haptic** `navigator.vibrate(80)` where
supported (silently skipped otherwise); tiles launch on physics arcs with one
floor bounce and ≤ 12 wood-chip particles (DEVSPEC §I.4). Once split, each tile
shows its color identity. Digraphs/syllables fly as one rigid tile.

### 3.5 `rebuild` — after smash & assembly (`screens/04`, `05`)
- The empty tray recesses **remain and ARE the slots**, in word order, keeping the
  plaque's exact footprint. Tiles rest where physics dropped them (never auto-
  arranged).
- **Listen:** tap a tile → its in-word sound (pop + warm glow + rings). Tap =
  listen; drag begins after a short hold.
- **Correct drop:** tile sinks flush (shadow collapses), soft thunk, its sound
  plays; seated tiles are inert to taps but pop out on re-smash.
- **Wrong drop:** playful bounce-out arc back toward the open bench — **never a
  buzzer, never a fail state** (DEVSPEC §I.2/§II.4).
- **Near-snap:** the target recess glows warm as a tile approaches.
- **Re-smash is allowed at any time** and re-scatters everything, including seated
  tiles; the docked hammer stays available (~90% opacity) throughout assembly.

### 3.6 `complete` — word completion celebration (`screens/08`, `09`)
Quieter/shorter than the smash (~2.5s; no shake, no haptic).
- **Fuse & hop:** last tile seats → brief pause → tiles slide flush, seams fade,
  letters return to uniform neutral ink + even spacing (whole again); the plaque
  lifts, hops twice with a squash landing, ≤ 6 sparkles, warm chime + the word at
  **natural speed**; the empty tray fades away. The child may tap the plaque to
  replay during the celebration.
- **Flight to wall:** a single ease-out arc to the wall, shrinking to wall scale
  while its **play-count finish blooms in**; lands at the first free spot with a
  small overshoot and a woody tap; ≤ 4-particle sparkle trail. `word_completed`
  fires at landing (DEVSPEC §I.6). The next word's plaque drops in shortly after.

### 3.7 `levelComplete` — level transition + hammer upgrade (`screens/10–12`)
Happens 10× total; three beats, tap-to-skip after beat 1.
- **Beat 1 — the plaques bow:** every plaque earned this level lights up
  left→right, each bowing while its word plays back-to-back at natural speed (a
  spoken, textless recap); rising fanfare; the docked hammer straightens and
  shivers. `level_completed` fires here (DEVSPEC §I.6).
- **Beat 2 — the transformation:** world dims, warm spotlight, the hammer hops to
  center, spins (accelerating, blur), white flash → lands as the **next stage**
  (bigger + new paint per §5); short haptic tick + cymbal shimmer; a faint after-
  image of the old hammer lingers and dissolves. Hammer stage + level index
  **persist here** (DEVSPEC §I.5).
- **Beat 3 — confetti smash:** a practice swing ends as a real strike on the empty
  bench: confetti (≤ 14) + one happy crash + light shake; while confetti falls the
  next level's first plaque drops into a fresh tray and auto-plays (celebration and
  play overlap — no dead wait).

## 4. Slot hint modes — ghost vs no-ghost (`screens/06`)

Level `ghost` flag comes from the language pack (DEVSPEC §I.1.1). One hint channel
per mode:
- **Ghost level (odd levels 1,3,5,7,9):** recesses show **ghost outline letters**
  (thin stroke). Slots are **NOT tappable** for audio; sound comes only from
  touching loose tiles.
- **No-ghost level (even levels 2,4,6,8,10):** **no letter hints.** Each recess
  holds a faint **ghost play button** (dashed circle + triangle). Touching it
  speaks the sound of the tile that belongs there; the button solidifies + the
  recess pulses during playback, then fades back to ghost.

## 5. Plaque wall (the meta layer) (`screens/07`)

- Finished plaques live in the wall zone and belong to the child: **touch-drag
  anywhere within the wall zone**, overlap/stacking allowed, last-touched comes to
  front. Positions + z-order **persist** (DEVSPEC §I.5).
- Plaques cannot leave the wall zone **except downward to the bench:** dragging one
  over the bench makes a tray glow; dropping it **replays that word at the highest
  level already reached for it** (the plaque leaves the wall during replay and
  returns on completion; the normal level sequence then resumes). Works forever,
  including after all 10 levels are done. (Behavior: DEVSPEC §I.2/§I.5.)
- **Play-count finishes** advance by **distinct levels completed** for the word,
  not raw plays (`finishForLevelCount`, DEVSPEC §I.1.2):
  - 1 level — cream face, **red** band + red letters
  - 2 levels — cream face, **teal** band + teal letters
  - 3 levels — cream face, **gold** band + gold letters (`#b98a2e`)
  - 4+ levels — **gold face** on gold band, ink `#8a5c18`; gold-on-gold forever after
- One plaque represents a word, at the highest level already played.

## 6. Hammer — 10 stages (`screens/15`)

One silhouette, parameterized; a **visible delta at every level** (muscle memory
never breaks: identical silhouette + grip point). Size ramps **76 → 156px** across
L1→L10. Stage = `hammerStageForLevel(level)` (index `level-1`), persisted per
language (DEVSPEC §I.5). Recipe (`HAMMER_STAGES`):

| Level | Stage delta |
|---|---|
| L1 | plain raw wood |
| L2 | darker wood + carved handle ring |
| L3 | red painted head |
| L4 | + highlight stripe |
| L5 | teal head, thicker handle |
| L6 | + gold inlay band |
| L7 | red head, gold band + cream dot |
| L8 | + second gold band, painted grip |
| L9 | + star emblem, teal grip |
| L10 | gold head, red+teal bands, outlined star, sparkle glints |

The docked hammer idles with a slow ~2° rock.

## 7. First-run tutorial — the demonstrating hand (`screens/13`, `14`)

Behavior/timing owned by DEVSPEC §I.2; presentation here.
- **Demonstration loop:** after the first plaque's slow auto-play and a period of
  no touch, a soft cream glove-hand with a pulsing touch ring fades in over the
  docked hammer, "grips" it, and drags a **ghost copy** along a dotted path toward
  the plaque, **stopping short of the strike zone** — the demo never smashes (that
  payoff belongs to the child). Fade out, repeat. The loop pauses instantly on any
  child touch (plaque taps don't end it; the hand waits, then resumes).
- **Handoff:** the instant the child's finger lands on the hammer, the hand
  dissolves upward into dust motes, even mid-demo. The tutorial-done flag persists
  only after the **first completed smash** (DEVSPEC §I.5).
- **Stuck rules** (each fires at most once per word): (a) prolonged no-touch on a
  fresh un-smashed plaque → one demo loop; (b) two consecutive released-early
  half-swings → the hand replays the drag, visibly holding through the whole wind-
  up; (c) a long stretch with tiles scattered and none dragged → the hand
  demonstrates dragging one tile to its slot, once.

## 8. Status-dependent visibility rules

| Element | Visible / active when |
|---|---|
| Whole plaque (word) | `present`, `complete` |
| Loose tiles | `rebuild` |
| Tray recesses / slots | `rebuild` (they are the slots); tray fades in `complete` |
| Ghost outline letters | `rebuild` **and** level is ghost |
| Ghost play buttons | `rebuild` **and** level is no-ghost |
| Docked hammer | `present`, `rebuild` (~90% opacity), idle; dragged in `windup` |
| Screen-filling hammer + vignette | `windup` only |
| Plaque wall | all phases (child may drag it during `rebuild`; drag-down replays) |
| Tutorial hand | per §7 rules; hidden once tutorial-done and no stuck condition |
| Confetti / level celebration | `levelComplete` only |
| Any text / emoji / mascot | **never** |

## 9. Acceptance criteria (Gherkin)

Behavior these verify is specified in the DEVSPEC; the TESTSPEC traces test cases
to each scenario below.

```gherkin
Feature: Smash — hold-through wind-up

  Scenario: Child holds through the whole swing and smashes the word
    Given the game is in the "present" phase with a whole plaque seated
    When the child drags the hammer within 190px of the plaque center
    Then the game takes over the swing and the hammer scales toward the camera
    And the world dims with a vignette and a rising whoosh plays
    When the child keeps holding through the apex and strike
    Then the plaque splits exactly at the word's unit breakpoints
    And a crash SFX, screen shake, and haptic fire simultaneously
    And the phase becomes "rebuild"

  Scenario: Child releases early and cancels the swing
    Given the hammer wind-up has been taken over in the "windup" phase
    When the child lifts their finger before the strike commits
    Then the swing cancels and the hammer glides back to its dock
    And no penalty is applied and the plaque is untouched
    And the phase returns to "present"

Feature: Scatter

  Scenario: Smashed word scatters into tiles on the bench
    Given the plaque has just been smashed
    Then one tile per unit launches on a physics arc and bounces once
    And every tile settles inside the 16:9 safe area, never under the hammer dock
    And each tile shows its color identity (band + letter color)
    And digraph or syllable units appear as a single rigid tile

Feature: Drag a tile to a slot

  Scenario: Correct placement
    Given the game is in the "rebuild" phase
    When the child drags a tile within 80px of its matching recess
    Then the tile sinks flush, a soft thunk plays, and its in-word sound plays
    And the seated tile becomes inert to taps

  Scenario: Incorrect placement
    Given the game is in the "rebuild" phase
    When the child drops a tile away from its matching recess
    Then the tile bounces back toward the open bench with no buzzer
    And no fail state occurs and the error counter increments

  Scenario: Re-smash during assembly
    Given some tiles are already seated in the "rebuild" phase
    When the child drags the still-available docked hammer onto the word
    Then every tile re-scatters, including the seated ones

Feature: Word completion and flight to wall

  Scenario: Last tile completes the word
    Given the final empty slot is filled correctly
    Then the tiles fuse flush, seams fade, letters return to neutral ink
    And the plaque hops, a chime plays, and the word plays at natural speed
    And the plaque flies to the first free spot on the wall
    And its play-count finish blooms in and a "word_completed" event fires at landing

Feature: Slot hint modes

  Scenario: Ghost level shows outline letters and mute slots
    Given the current level's ghost flag is true
    Then each recess shows a ghost outline letter
    And tapping a recess plays no audio
    And audio comes only from touching a loose tile

  Scenario: No-ghost level shows ghost play buttons
    Given the current level's ghost flag is false
    Then each recess shows a ghost play button and no letter hint
    When the child touches a recess play button
    Then it speaks the sound of the tile that belongs there and the recess pulses

Feature: Replay from the wall

  Scenario: Drag a finished plaque down to the bench to replay it
    Given a finished plaque is on the wall
    When the child drags it over the bench and drops it
    Then that word replays at the highest level already reached for it
    And the plaque leaves the wall during replay and returns on completion
    And the normal level sequence then resumes

Feature: Level transition and hammer upgrade

  Scenario: Completing a level upgrades the hammer
    Given the last word of a level has landed on the wall
    Then the earned plaques bow left-to-right and replay their words
    And a "level_completed" event fires at beat 1
    And the hammer transforms to the next stage (bigger, new paint)
    And the new hammer stage and level index persist
    And the next level's first plaque drops in during the confetti
```

---

## Changelog

- 2026-07-13 — Replit Agent & Tinsley Galyean — Initial spec authored
