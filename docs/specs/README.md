# Word Smash — Spec-Driven AI Development (SDAD) specs

This directory holds the four living specifications that are the **single source
of truth** for Word Smash. They are written so a new team could replicate and
test the product from scratch **without reading the existing code**. Future task
plans reference these documents, and the documents are updated after each
completed/approved task.

## The four documents

| File | Answers | Stability |
|---|---|---|
| [`PRD.md`](./PRD.md) | The **what & why** — product, users, value, KPIs, milestones, non-goals. Conceptual. | Stable |
| [`DEVSPEC.md`](./DEVSPEC.md) | **What gets built and how it behaves** — data schemas, per-module goals/tasks/exit criteria, non-functional requirements, implementation guide, appendices. **Source of truth for behavior.** | Active |
| [`UISPEC.md`](./UISPEC.md) | The **user-facing surface** — visual system, every phase/screen/state, hint modes, hammer stages, tutorial, and Gherkin acceptance criteria. | Active |
| [`TESTSPEC.md`](./TESTSPEC.md) | **How to verify** the DEVSPEC and UISPEC — test cases, fixtures, build-and-test sequence, validation gate, and a requirement→test coverage matrix. | Active |

## The reference chain

The documents form a directed chain, most-conceptual first:

```
PRD  →  DEVSPEC  →  UISPEC  →  TESTSPEC
```

- **PRD** is stable and self-contained. It does **not** reference the other three
  by filename (the *what/why* must not depend on implementation).
- **DEVSPEC** references the PRD for intent.
- **UISPEC** references the PRD for intent and the **DEVSPEC for behavior** (it
  never restates behavior — it cites the DEVSPEC section).
- **TESTSPEC** references **both the DEVSPEC and the UISPEC**, tracing every test
  case back to a DEVSPEC module and/or a UISPEC acceptance scenario.

Rule of thumb: information flows downstream. A change in *why* (PRD) can ripple
into *how it behaves* (DEVSPEC), then *how it looks* (UISPEC), then *how it's
verified* (TESTSPEC) — update in that order.

## Authoring conventions

### Metadata header
Every document opens with a metadata block:
**Title**, **Status** (`Draft` / `Active` / `Stable`), **Version** (semver,
starting `1.0.0`), **Last updated** (`YYYY-MM-DD`), and **Owner/Author**.

### Semver
Bump the **Version** of a document when its content changes:
- **patch** (`1.0.x`) — typos, clarifications, formatting; no requirement change.
- **minor** (`1.x.0`) — added requirements/sections that don't invalidate prior
  ones.
- **major** (`x.0.0`) — changed or removed requirements (breaking for downstream
  docs or the product). When a DEVSPEC requirement changes, check the UISPEC and
  TESTSPEC for downstream updates.

### Changelog
Every document **ends** with a `## Changelog` section in **descending order**
(newest first). Each entry uses this exact format:

```
YYYY-MM-DD — <who> — <what changed>
```

The seed entry for all four documents is:

```
2026-07-13 — Replit Agent & Tinsley Galyean — Initial spec authored
```

Also update **Last updated** (and **Version** per semver) in the header whenever
you add a changelog entry.

## Keeping the specs true

- These specs describe the **shipped product** (M1 + M2 + the "Honey & Paint"
  redesign + M3 recorded audio) and the Curious Reader offline `file://`
  constraints.
- After a task changes behavior, update the relevant spec(s) **before** or as part
  of marking the task complete, then add a changelog entry and bump the version.
- Numeric constants, level counts, phase names, and file names must stay
  **consistent across all four documents** and with the code. The DEVSPEC is
  authoritative for constants; the UISPEC and TESTSPEC must match it.
- Deeper background lives in `../../artifacts/word-smash/DECISIONS.md`
  (architecture decisions), `../../artifacts/word-smash/UPLOAD.md` (CMS upload),
  and the approved design contract at
  `../../attached_assets/word_smash_design/handoff/DESIGN-SPEC.md`.
