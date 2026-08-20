# Word Smash — Visual & Interaction Design Specification

**Status:** Approved by Curious Learning. This document is the design contract for the visual style, screen layout, animation, and feel of Word Smash.
**Precedence:** Curious Reader container spec §1–§6 > Game Design Document v3.0 > this document. This spec covers HOW things look/move/feel; it never overrides functional or packaging requirements in those documents. Where this spec states gameplay rules, they were approved by the design owner and refine (not replace) the GDD.
**Screens:** every rule below references a PNG in `screens/`. Blue numbered dots and dashed blue lines in the PNGs are annotations, not game art.

---

## 1. Canvas & layout geometry

Reference canvas: **1200 × 540** (scale everything proportionally to device; landscape-locked).

- Design for **20:9** full-bleed; all interactive elements must sit inside the central **16:9 safe area** (120px margins left/right at reference scale — dashed blue guides in the PNGs). Background wood may extend to the device edges.
- **Wall zone** = top ~46% (plaque wall, wood-plank wall texture).
- **Bench zone** = bottom ~54% (tray/slots, loose pieces, hammer dock). Bench front edge is a 10px highlight strip at the 46% line.
- **Hammer dock** = bottom-right inside the safe area (center ≈ x 1010, y 430 at reference).
- Minimum touch target: **88px** at reference scale (≥ 44px physical at any density). Pieces are 104–122px tall.
- Physics must never drop a piece outside the 16:9 safe area or under the hammer dock.

## 2. Visual language — "Honey & Paint"

Warm birch workshop. Bright, hand-crafted, cozy. **No text anywhere in-game. No emoji. No mascot.**

Palette (hex):
- Wall: vertical gradient `#e3c491 → #d7b47e → #cba76f`, plank lines = repeating 3px `rgba(120,80,40,.14)` every 150px; warm window-light pool `rgba(255,244,214,.5)` radial, upper center.
- Bench: `#eed0a0 → #e5c188` (top 14%), then `#d3ab70 → #c69c60`; edge strip `#f8e0b4 → #eed0a0`; board lines every 34px `rgba(120,80,40,.08)`.
- Plaque/piece face: `#faeed2 → #f2e0b8` (vertical), corner radius 16 at 122px height; resting shadow `0 5px 0 #a3713d` + soft drop.
- Neutral ink (unsmashed plaque letters): `#5a4028` (alt `#4a2e18`).
- Red: `#c9553e` (dark `#8f3a29`, tint `#e88a6f`).
- Teal: `#3d8f83` (dark `#2a6459`, tint `#8ccabf`).
- Gold: `#e0a13c` (letters-on-cream `#b98a2e`; gold face `#f6d488 → #e9b95a`, gold ink `#8a5c18`).
- Wood handle: `#a5713c` stroke `#7c5128`; raw wood `#b98a55` stroke `#8a6236`.
- Tray/recess: `rgba(90,55,20,.22–.24)` with inset shadow; tray outer padding tint `rgba(90,55,20,.14)`.
- Light/flash/starburst: `#fff3d6`, `#ffd98f`; bunting decoration: red/teal/gold triangles.

Type: **Fredoka SemiBold (600)** for all letters/words (bundle as a local font file per container spec — no CDN at runtime). Letters ~66px on a 122px piece at reference scale.

## 3. The plaque (word) lifecycle

`screens/01` — **Before smash.** The word arrives as ONE plaque seated in a routed tray on the bench. Uniform cream face, **even letter spacing, single neutral ink color, ZERO hints of the breakpoints** (no seams, no color bands, no spacing changes). On entry: plaque drops in with a soft thunk, word auto-plays slowly once, amber sound-rings expand in sync. Idle: gentle breathe (scale 1.00→1.015, 2s loop).
- Touch the plaque → play the word slowly (+ rings).
- Touch the docked hammer (tap, not drag) → also plays the current word.

`screens/02` — **Wind-up (hold-through).** Child drags the hammer from its dock. When it enters the snap radius (190px from plaque center), the game takes over: hammer winds up AND scales toward the camera — ease-in (quadratic), ~900ms, scaling to ~5.2×, world dims ~50% (vignette), rising whoosh. The child must **keep holding through the whole swing**. Release early → swing cancels: hammer glides back (350ms ease-out), no penalty, plaque untouched. Apex hangs ~150ms, then the strike snaps down in ~160ms.

`screens/03` — **Impact.** The plaque splits **exactly at the level-data breakpoints** — the reveal of where it breaks IS the reward. Simultaneously (never sequentially): 
- **Surprise crash SFX**: drawn randomly from a local pre-recorded pool (glass shatter, car crash, thunder, cymbals, bowling strike, …), never the same twice in a row; one pool shared across languages; local MP3s only.
- **Screen shake** ±14px decaying over ~350ms (sketch used 7px at half scale — tune on device).
- **Haptic**: `navigator.vibrate(80)` where supported, silently skipped otherwise.
- Pieces launch on physics arcs with ±20° tumble, gravity, one floor bounce (restitution ≈ −0.3); wood-chip particles ≤ 12. Digraphs ("oo") and syllables ("mon") fly as single rigid pieces. Once split, pieces show their color identity (band + letter color).

`screens/04` — **After smash.** The empty tray recesses remain: they ARE the slots, keeping the plaque's exact footprint in word order. Pieces rest where physics dropped them (never auto-arranged). Touch a piece → its in-word sound (pop to 1.05–1.06×, warm glow, rings). Tap = listen; drag starts after ~80ms hold.

`screens/05` — **Assembly.** Correct drop: piece sinks flush (shadow collapses), soft thunk, its sound plays; seated pieces are inert to taps but pop out on re-smash. Wrong drop: playful bounce-out arc back toward open bench — never a buzzer, no fail state. Near-snap: target recess glows warm (200ms ease-in). **Re-smash is allowed at any time** and re-scatters everything, including seated pieces; the docked hammer stays available (90% opacity) throughout assembly.

## 4. Slot hint modes

`screens/06` — one hint channel per mode:
- **Ghost level:** recesses show ghost outline letters (3px stroke `rgba(120,80,40,.4)`). Slots are NOT tappable for audio; sound comes only from touching loose pieces.
- **No-ghost level:** no letter hints. Each recess holds a faint ghost play button (dashed circle + triangle). Touching it speaks the sound of the piece that belongs there; the button solidifies + recess pulses during playback, then fades back to ghost.

## 5. Word completion celebration (second hero moment)

Deliberately quieter and shorter than the smash (~2.5s total): no shake, no haptic.

`screens/08` — **Fuse & hop.** Last piece seats → 200ms pause → pieces slide flush, seams fade (300ms), letters return to uniform neutral ink and even spacing — the plaque is whole again. It lifts from the tray, hops twice (~12px, squash on landing), ≤ 6 small sparkles, warm chime + the word at **natural speed**. The empty tray fades away beneath it. The child may tap the plaque during the celebration to replay the word.

`screens/09` — **Flight to the wall.** Single 800ms ease-out arc to the wall, shrinking to wall scale mid-flight while its **play-count finish blooms in** (300ms). Lands at the first free spot (soft glow marks it), 6% overshoot, woody tap. Thin sparkle trail ≤ 4 particles. `word_completed` fires at landing. Next word's plaque drops in 400ms after landing.

## 6. Plaque wall (the meta layer)

`screens/07`:
- Finished plaques live in the wall zone and belong to the child: touch-drag anywhere within the wall zone, overlap/stacking allowed, last-touched comes to front. Positions + z-order persist in localStorage.
- Plaques cannot leave the wall zone EXCEPT downward to the bench: dragging one over the bench makes a tray glow; dropping it **replays that word at the highest level already reached for it** (plaque leaves the wall during replay, returns on completion, then the normal level sequence resumes). This works forever, including after all 10 levels are complete.
- **Play-count finishes** (encodes how many times the word has been played, replays included):
  - 1× — cream face, red band, red letters
  - 2× — cream face, teal band, teal letters
  - 3× — cream face, gold band, gold letters (`#b98a2e` ink)
  - 4×+ — gold face (`#f6d488→#e9b95a`) on gold band, `#8a5c18` ink; stays gold-on-gold forever after.
- When a word exists in multiple levels, one plaque represents it, at the highest level already played.

## 7. Hammer evolution — 10 stages

`screens/15` — one silhouette, parameterized SVG; a visible delta at EVERY level so each level-up changes the hammer. Size ramps 76→156px at reference (~1.5× overall); identical silhouette + grip point throughout (muscle memory never breaks).

L1 plain raw wood · L2 darker wood + carved handle ring · L3 red painted head · L4 + highlight stripe · L5 teal head, thicker handle · L6 + gold inlay band · L7 red head, gold band + cream dot · L8 + second gold band, painted grip · L9 + star emblem, teal grip · L10 gold head, red + teal bands, outlined star, sparkle glints.

Hammer stage persists in localStorage per language. The docked hammer idles with a slow ~2° rock.

## 8. Level transition + hammer upgrade (the biggest celebration)

Happens 10× total, so it may outshine everything except nothing — it borrows the strike language. Three beats, ~6s, tap-to-skip after beat 1:

`screens/10` — **Beat 1 (~1.5s): the plaques bow.** Every plaque earned THIS level lights up left→right (100ms apart), each bowing (tilt ±8°, 8px hop) while its word plays back-to-back at natural speed — a spoken recap with zero text. Rising fanfare. The docked hammer straightens and shivers with anticipation.

`screens/11` — **Beat 2 (~2.5s): the transformation.** World dims 28%, warm spotlight, hammer hops to center stage, spins twice (accelerating, blur streaks), white flash (120ms) → lands as the next stage (bigger + new paint per §7). Short haptic tick + cymbal shimmer. A faint after-image of the old hammer lingers 400ms and dissolves ("your old friend grew up"). One proud practice swing at nothing.

`screens/12` — **Beat 3 (~2s): confetti smash.** The practice swing ends as a real strike on the empty bench: confetti burst (≤ 14 pieces, palette colors) + one happy crash from the surprise pool + light shake. While confetti falls, the next level's first plaque drops into a fresh tray and auto-plays — celebration and play overlap, no dead wait. `level_completed` fires at beat 1; hammer stage + level index persist at beat 2 (app killed mid-celebration → reopens at the new level with the new hammer).

## 9. First-run tutorial — the demonstrating hand

`screens/13` — **Demonstration loop.** After the first plaque's slow auto-play + 2s of no touch: a soft cream glove-hand with a pulsing touch ring fades in over the docked hammer, "grips" it, and drags a **ghost copy** along a dotted path toward the plaque (1.6s ease-in-out), stopping short of the strike zone — **the demo never smashes; that payoff belongs to the child**. Fade out, repeat after 1.5s. The loop pauses instantly on any child touch (plaque taps don't end the tutorial; the hand waits, then resumes).

`screens/14` — **Handoff + stuck rules.** The instant the child's finger lands on the hammer, the hand dissolves upward into dust motes (300ms), even mid-demo. The tutorial-done flag persists only after the FIRST **completed** smash. Afterwards the hand never returns for the hammer gesture EXCEPT: (a) 10s no-touch on a fresh un-smashed plaque → one demo loop; (b) 2 consecutive released-early half-swings → hand replays the drag, visibly holding through the whole wind-up; (c) 15s with pieces scattered and none dragged → hand demonstrates dragging one piece to its slot, once. Each hint fires at most once per word.

## 10. Interactive hammer-strike sketch

`hammer-strike-sketch/Hammer Strike Sketch.dc.html` (open directly in a browser; `screens/16` is a still). **Reference for FEEL only — do not port this code.** It demonstrates: drag → snap-radius takeover → hold-through wind-up filling the screen → cancel-on-release → strike → surprise crash (3 synth placeholders; production uses the pre-recorded pool) → shake → haptic → piece physics. Tuning values embedded in §3 above. Requires internet for its font; the production game must not.

## 11. Audio & haptics summary

- All speech = pre-recorded local MP3s per GDD §7 (slow word, natural word, per-unit in-word sounds). Units speak their contextual in-word sound, never letter names.
- Crash pool = local MP3 SFX, random without immediate repeat, shared across languages.
- UI foley: soft thunk (plaque/piece seats), woody tap (plaque lands on wall), warm chime (word complete), whoosh (wind-up), fanfare (level end), cymbal shimmer (hammer transform).
- Haptics: impact 80ms; hammer-transform tick ~30ms. Always feature-detected, never required.

## 12. Persistence (localStorage, namespaced per `cr_lang`)

Current level · per-word completion + play count (drives plaque finish) + highest level reached per word · plaque wall positions/z-order · hammer stage · tutorial flags (done + per-word hint counters).

## 13. Performance budgets

30fps floor on 1GB-RAM Android WebViews. Particles: smash chips ≤ 12, confetti ≤ 14, sparkles ≤ 6, trail ≤ 4. Prefer transform/opacity animations; no filters on animated nodes; the wind-up scale is a single transform on one node.

## 14. Screens index

| PNG | Moment |
|---|---|
| 01 | Before smash — plain plaque, listen affordances |
| 02 | Wind-up — hold-through, screen-filling hammer |
| 03 | Impact — split at breakpoints, crash/shake/haptic |
| 04 | After smash — tray recesses = slots |
| 05 | Partly assembled — seated vs loose pieces |
| 06 | Ghost vs no-ghost slot rules |
| 07 | Plaque wall — drag, stack, drag-down replay |
| 08 | Word complete — fuse & hop |
| 09 | Plaque flight to wall |
| 10 | Level end beat 1 — plaques bow |
| 11 | Level end beat 2 — hammer transformation |
| 12 | Level end beat 3 — confetti + next level |
| 13 | Tutorial — hand demonstration loop |
| 14 | Tutorial — handoff + stuck rules |
| 15 | Hammer — all 10 stages + recipe |
| 16 | Hammer-strike sketch still |
