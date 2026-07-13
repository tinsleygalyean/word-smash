# PRD — Word Smash

| | |
|---|---|
| **Title** | Word Smash — Product Requirements Document |
| **Status** | Active |
| **Version** | 1.0.0 |
| **Last updated** | 2026-07-13 |
| **Owner/Author** | Tinsley Galyean (with Replit Agent) |

> This PRD is the stable *what* and *why* for Word Smash. It is conceptual and
> does not describe implementation, and it does not reference the DEVSPEC,
> UISPEC, or TESTSPEC by filename — those documents reference back to this one.

---

## 1. Product summary

Word Smash is an **offline literacy web game for children ages 4–8**. A child is
shown a short word seated on a workbench. They pick up a hammer, smash the word
apart into letter/sound tiles, then drag those tiles back into place to rebuild
the word — hearing each sound as they go. Completed words fly up to a plaque wall
the child owns and can replay forever.

The game ships inside **Curious Learning's Curious Reader** container — an
offline-first Android/iOS WebView that loads the game from the local `file://`
protocol with **no network access at runtime**. Word Smash must therefore be a
fully self-contained, client-only experience: all art, audio, fonts, and data are
bundled and loaded locally, and all progress is stored on-device.

The experience is deliberately **wordless in its chrome**: there is no text,
emoji, or mascot anywhere in gameplay. Meaning is carried entirely by imagery,
motion, sound, and the letters of the words themselves — so a pre-literate child,
or a child who does not read the UI language, can play unaided.

## 2. Target users & context

### Primary user — the child (ages 4–8)
- Pre-literate to early-literate. May not recognize letters yet and cannot read
  instructions.
- Plays on a **low-cost Android device** (target: 1GB-RAM WebView) or iOS, often
  offline, frequently unsupervised, in a range of languages and regions served by
  Curious Learning.
- Interaction is **touch-only**, single-finger. Attention spans are short; the
  loop must be immediately legible and rewarding.

### Secondary stakeholders
- **Curious Learning / Curious Reader team** — owns the container, the CMS that
  distributes games, the analytics pipeline, and the go-live/promotion decision.
  Word Smash is a third-party title uploaded into their platform.
- **Caregivers / educators** — not direct users, but the literacy outcome and the
  "safe, no-fail, no-text" design serve their trust.

### Learning context
Word Smash teaches the core pre-reading skill of **phonemic awareness and
blending** — hearing that a word is made of individual sounds, and that those
sounds combine into the whole word. The smash makes the invisible seams of a word
*visible and physical*; the rebuild makes blending *tactile*.

## 3. Personas

- **Amara, 5, first-time reader (Kenya, offline Android).** Doesn't know all her
  letters. Loves the smash. Learns, over sessions, that "sea" is /s/ + /ea/ by
  hearing each tile as she drags it. Never sees a word she can't read, never fails
  a level, never hits a screen of text.
- **Mateo, 7, building fluency (tablet, intermittent wifi).** Races through the
  10 levels, then replays words off his plaque wall to hear them at the highest
  level he reached. Chases the gold plaque finishes and the evolving hammer.
- **The Curious Learning content operator.** Uploads the engine + language pack
  through the CMS, verifies the tile appears, and promotes it to production. Needs
  the game to be packaging-compliant and to emit clean analytics events.

## 4. Core value proposition

- **A physical, joyful way into phonics.** Smashing a word into its sounds and
  rebuilding it turns an abstract literacy skill into a hands-on toy.
- **Truly offline & universal.** Runs with zero network, in any of Curious
  Reader's languages, on cheap hardware, with no reading required to operate it.
- **No-fail, child-owned progression.** Wrong moves never punish; every finished
  word becomes a keepsake on the child's wall; the hammer visibly grows with them.
- **Sound-accurate phonics.** The game speaks the *sound a letter makes in the
  word* (/b/ = "buh"), never the letter name — a hard correctness rule, because
  saying letter names would teach the wrong thing.

## 5. Success metrics / KPIs

Analytics are reported through the container's data bridge (session, word, level,
and rolled-up summary events). Target signals:

- **Engagement:** median session length; words completed per session; return
  sessions per child.
- **Progression:** distribution of highest level reached (1–10); share of children
  who complete all 10 levels; replays initiated from the plaque wall.
- **Learning-proxy quality:** errors per word and hints used per word *trending
  down* within a level and across sessions (blending is being learned, not
  guessed).
- **Reliability (non-negotiable):** the game launches and runs fully offline from
  `file://`; audio plays from bundled files (not the TTS fallback) in the shipped
  container; no crashes on the 1GB-RAM target device.
- **Distribution:** engine + language pack upload cleanly to the CMS and appear on
  devices after promotion.

## 6. Scope & milestone history

Word Smash has shipped in four completed stages. All four are **complete** as of
this document.

| Milestone | Status | What it delivered |
|---|---|---|
| **M1** | Complete | Core loop for English levels 1–4: ghost and no-ghost word groups (2-phoneme digraph words, CVC words). Hammer smash → scatter → drag-to-rebuild, plaque wall, hammer evolution, on-device persistence, first-run tutorial hand. Speech via a fallback voice engine (no recorded audio yet). |
| **M2** | Complete | Sound-accurate speech (says the phoneme /b/ "buh", never the letter name); fixed level indicator; self-hosted bundled game font (no web-font CDN); a dedicated offline build for the container; levels 5–10 playable. |
| **"Honey & Paint" redesign** | Complete | Full visual + interaction redesign to the approved design contract: a fixed reference canvas cover-scaled to any device, no text/emoji/mascot in gameplay, the full phase lifecycle (loading → present → windup → rebuild → complete → level-complete), a 10-stage evolving hammer, and a plaque wall with drag-to-replay and play-count finishes. |
| **M3** | Complete | Real recorded audio: bundled MP3s for every word (slow + natural) and every in-word sound unit, generated so a letter name can never be spoken. The recorded audio is now the default; the fallback voice is only a safety net. |

### Product principles (stable)
- **No text, emoji, or mascot in gameplay.** Ever.
- **No fail state.** Wrong drops bounce back playfully; there is no buzzer, score
  penalty, or game-over.
- **Sounds, never letter names.**
- **Offline-first.** If it needs the network, it is out of scope.
- **The child owns their progress.** The wall, the plaque finishes, and the hammer
  are the child's growing collection, persisted on-device.

## 7. Non-goals / explicitly out of scope

- **No backend or accounts.** The game is client-only; there is no server-side
  game logic, login, or cloud save. (An unrelated API server exists in the repo
  but is not used by the game.)
- **No online features** — no leaderboards, multiplayer, ads, or in-app purchases.
- **No authoring/CMS UI inside the game.** Word and level content is authored as a
  bundled language-pack data file, not edited in-app.
- **Publishing/promotion to Curious Reader production** is a separate, externally
  gated activity (the CL team owns promotion). It is not part of building the game.
- **Non-English language packs** are supported by the architecture but not yet
  authored; only English ships today.
- **Reading comprehension, sentences, or spelling instruction** — the game targets
  phonemic awareness and blending of single short words only.

---

## Changelog

- 2026-07-13 — Replit Agent & Tinsley Galyean — Initial spec authored
