# BACKLOG — Word Smash Delivery & Development Workflow

| | |
|---|---|
| **Title** | Word Smash — Backlog and AI-Assisted Development Workflow |
| **Status** | Active |
| **Version** | 1.0.0 |
| **Last updated** | 2026-08-22 |
| **Owner/Author** | Word Smash team |

> This document is the operational source of truth for work that has not yet
> shipped. It also defines how people and AI development agents collaborate on
> Word Smash. It complements the product specifications; it does not replace
> the DEVSPEC as the source of truth for shipped behavior.

**Reference chain:** PRD → DEVSPEC → UISPEC → TESTSPEC → **BACKLOG** → delivery.

---

## 1. Purpose and operating rules

Use this file to give every contributor—human or AI—the same answer to:

1. What is the next most valuable piece of work?
2. Which specification and acceptance criteria govern it?
3. Who approves product, design, content, and release decisions?
4. What evidence is required before the work is called complete?

### Rules

- The four core specifications describe the shipped product. Update them when a
  requirement changes; update this file when work status or sequencing changes.
- Record durable, consequential choices in `DECISIONS-YYYY-MM-DD.md` and, when
  they are architectural, in `../../artifacts/word-smash/DECISIONS.md`.
- Do not store credentials, tokens, private URLs, learner data, or copied secret
  values in this repository.
- Each work item must point to an acceptance test, a specification section, or a
  concrete validation command before implementation starts.
- Keep changes small, reviewable, and independently verifiable. One meaningful
  outcome per pull request or AI task is preferred.

---

## 2. Shared human + AI development workflow

This is the default workflow for feature work, bug fixes, content updates, and
release work. A new developer agent should follow it from top to bottom after
cloning the repository.

| Stage | Human role | AI developer role | Required output / gate |
|---|---|---|---|
| 1. Frame the outcome | Explain the learner, educator, or operational need; set priority; identify any non-negotiable constraints. | Ask only the questions needed to remove material ambiguity; translate the request into a bounded proposed change. | A backlog item with outcome, priority, owner, and success criteria. |
| 2. Ground in specs | Confirm product intent, approve changed requirements, and supply authoritative content or partner guidance. | Read `PRD.md`, `DEVSPEC.md`, `UISPEC.md`, `TESTSPEC.md`, this backlog, and recent decision records; identify affected requirements and risks. | A short implementation plan tied to spec sections. |
| 3. Design the change | Approve user-facing behavior, art direction, literacy content, and any tradeoffs. | Implement a focused design or code approach that preserves the offline `file://` constraints; surface alternatives when choices materially affect the product. | Approved design/plan; decision record if the choice will guide later work. |
| 4. Build | Supply assets, language/audio review, access approvals, and timely answers to product questions. | Make the code/content/package changes; keep secrets outside source control; preserve existing patterns unless a documented decision changes them. | Clean, scoped diff and an updated implementation/spec document where required. |
| 5. Verify | Review the experience as a learner/educator and decide whether the result meets the intended outcome. | Run type checks, automated tests, relevant gameplay checks, and container/package integrity checks; report failures plainly and fix them before handoff. | Test evidence mapped to acceptance criteria. |
| 6. Review and record | Accept, reject, or request revision; make release and publication decisions. | Summarize the changed behavior, remaining risks, verification, and any follow-up work. Update the backlog and decision log. | Review-ready commit or pull request with documentation current. |
| 7. Publish and monitor | Authorize CMS upload/promotion and own partner-facing communications. | Build the Layout A container, run integrity checks, perform only authorized upload steps, and document the result without exposing credentials. | Versioned release artifact and release record. |

### Fast path for small corrections

For a typo, test-only repair, or isolated visual correction: create a concise
backlog row, make the focused change, run the directly relevant test plus
typecheck, update the row, and commit. Do not bypass the offline constraints or
specification updates when behavior changes.

---

## 3. AI developer handoff guide

### Required reading order

1. `README.md` in this directory
2. `PRD.md`, `DEVSPEC.md`, `UISPEC.md`, and `TESTSPEC.md`
3. This `BACKLOG.md`
4. The newest relevant `DECISIONS-YYYY-MM-DD.md`
5. `../../artifacts/word-smash/DECISIONS.md` and `UPLOAD.md` for implementation
   and Curious Reader packaging constraints
6. The code only after the above documents define the intended behavior

### Local setup and validation

```bash
pnpm install
pnpm run typecheck
pnpm --filter @workspace/word-smash run test
pnpm --filter @workspace/word-smash run dev
pnpm --filter @workspace/word-smash run package:container -- --lang english
```

Run `pnpm --filter @workspace/scripts run upload:wordsmash -- --lang english
--dry-run` when a change affects packaging or upload metadata. A live upload
requires separately configured secrets and explicit human approval.

### Non-negotiable implementation constraints

- The shipped game must work offline from `file://` in the Curious Reader WebView.
- Load JSON, audio, and fonts through the established XHR binary-loading path;
  do not introduce `fetch`, `<audio>`, CDN assets, or root-relative bundle URLs.
- Unit audio teaches phoneme sounds in context, never letter names.
- Word Smash is a **Layout A** Curious Reader game: engine plus language pack,
  with no shared core tier.
- Never inspect, paste, commit, or ask a user to paste secret values.

---

## 4. Choosing an AI development interface

The repository and its specifications are tool-neutral. The team may use Replit
Agent, Claude Code, or another code-capable agent as long as the workflow above
is followed.

| Tool / approach | Best use | What it should produce | Important boundary |
|---|---|---|---|
| **Replit Agent** | End-to-end work in this Replit workspace: implementation, preview, package checks, task tracking, and managed integrations. | Code changes, tests, documentation updates, and verified artifacts in the existing workspace. | Use Replit-managed secrets/integrations rather than copying credentials into prompts or files. |
| **Claude Code** | Repository-first development after cloning from GitHub; codebase exploration, implementation, tests, and pull-request preparation. | A branch/commit series tied to backlog IDs and specification references. | Give it this directory and the Curious Reader offline constraints first; it must not assume a normal online web app. |
| **Claude Artifacts** | Early product exploration: a clickable concept, visual direction, educator-facing explanation, or lightweight prototype before integration. | A disposable prototype or design reference used to inform a planned repository change. | Do not treat an Artifact as the production Word Smash codebase or as proof of offline `file://` compatibility. Graduate approved ideas into the repository and verify there. |
| **GitHub issues / pull requests** | Cross-team planning, review, and durable discussion around implementation branches. | Linked issue, review comments, and a merged pull request. | Keep the GitHub backlog synchronized with this file; do not let two sources silently disagree. |

### Recommended Claude handoff prompt

When using Claude Code or another repository agent, begin with an instruction
equivalent to:

> Read `docs/specs/README.md`, all four core specs, `BACKLOG.md`, the newest
> decision record, and `artifacts/word-smash/DECISIONS.md` before changing code.
> Select one ready backlog item, explain the plan with spec references, implement
> only that item, run its validation commands, update the backlog and relevant
> specs, and summarize any decision that requires human approval.

---

## 5. Backlog

### Status vocabulary

- **Ready** — well-defined and may be implemented.
- **In discovery** — needs product, design, or partner input.
- **In progress** — active implementation or verification.
- **Blocked** — cannot proceed until its stated dependency is resolved.
- **Done** — shipped/merged and verified; keep brief evidence for traceability.

### Ready / verification work

| ID | Priority | Status | Outcome | Source / acceptance evidence | Owner |
|---|---|---|---|---|---|
| WS-VAL-01 | High | Ready | Confirm every wall plaque keeps the correct band color while flying to the wall. | UI visual-state test and manual game check. | AI implements; human accepts. |
| WS-VAL-02 | High | Ready | Confirm no language-pack unit can cause TTS to speak a letter name. | Audio unit tests plus content review. | AI implements; human/content reviewer accepts. |
| WS-VAL-03 | High | Ready | Detect missing audio files before offline bundles ship. | Packaging integrity test fails with a precise missing-file report. | AI implements; human accepts. |
| WS-VAL-04 | Medium | Ready | Ensure the `holdThrough` counter resets so each new word can receive its own two-swing hint. | Reducer/gameplay test covering consecutive words. | AI implements; human accepts. |
| WS-VAL-05 | Medium | Ready | Keep a corrupted MP3 from silencing a word for the session. | Audio recovery test confirms fallback/retry behavior. | AI implements; human accepts. |
| WS-VAL-06 | High | Ready | Run bundle integrity automatically before every publish. | Publish path invokes package validation and blocks failures. | AI implements; human authorizes publish. |
| WS-VAL-07 | Medium | Ready | Hide the `holdThrough` hint immediately after a successful smash. | UI interaction test and manual check. | AI implements; human accepts. |
| WS-VAL-08 | Medium | Ready | Keep piece tiles and tray slots on the correct accent color during rebuild. | Visual-state test plus manual check. | AI implements; human accepts. |

### Discovery / partner decisions

| ID | Priority | Status | Outcome | Dependency / next human decision | Owner |
|---|---|---|---|---|---|
| WS-REL-01 | High | Blocked | Obtain Curious Learning confirmation that `wordsmash-eng.zip` is classified as the engine tier. | Curious Learning CMS owner confirms the `-eng` exception or provides the required filename. | Human / partner. |
| WS-REL-02 | Medium | In discovery | Update upload guidance to use the clarified personal MCP-token terminology and scope model. | Confirm final Curious Learning terminology and publication responsibilities. | Human + AI. |
| WS-REL-03 | Medium | In discovery | Add chunked MCP upload and SHA-256 support for larger future packs. | Confirm MCP tool contract and expected pack-size threshold. | AI after partner input. |
| WS-CONT-01 | Medium | In discovery | Prioritize the next language pack. | Human selects target language, curriculum, reviewer, and licensed voice/content process. | Human. |

### New backlog-item template

```md
| WS-AREA-NN | High / Medium / Low | Ready | One outcome stated in learner or operational terms. | Spec section + test or validation command. | Named human / AI role. |
```

---

## Changelog

- 2026-08-22 — Tinsley Galyean & Replit Agent — Initial backlog, team workflow, and AI-developer handoff guide authored.