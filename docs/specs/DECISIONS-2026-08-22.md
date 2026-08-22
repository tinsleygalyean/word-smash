# DECISIONS — 2026-08-22

| | |
|---|---|
| **Title** | Word Smash — Decision Record for 2026-08-22 |
| **Status** | Active |
| **Version** | 1.0.0 |
| **Last updated** | 2026-08-22 |
| **Owner/Author** | Tinsley Galyean & Replit Agent |

> This is a dated record of decisions made on 2026-08-22. It captures context
> that future teams and AI agents need but does not restate implementation
> details that are discoverable from code.

---

## D-2026-08-22-01 — Publish the project in a public GitHub repository

**Decision:** Word Smash is published at
[`tinsleygalyean/word-smash`](https://github.com/tinsleygalyean/word-smash) as a
public GitHub repository.

**Why:** The project’s assets are open source or Creative Commons, and public
source control enables collaboration, review, cloning, and continuity outside
one development workspace.

**Guardrail:** Public publication is acceptable only while secrets remain in
Replit-managed secret storage and are never committed. Any future proprietary,
licensed, learner, or credential-bearing asset requires a fresh visibility
decision before it is added.

## D-2026-08-22-02 — Preserve local history when connecting the workspace to GitHub

**Decision:** The workspace’s `main` branch is connected to the GitHub
repository as `origin/main`, and the initially separate histories have been
merged without replacing project files.

**Why:** The first public GitHub publication created a source snapshot through
the GitHub API. Merging the histories preserves the workspace’s prior
development trail while retaining the public repository snapshot.

**Guardrail:** Do not force-push merely to make histories look linear. Future
pushes should use the configured `origin/main` tracking branch. If GitHub
authentication or a non-fast-forward error appears, resolve it through the
authorized Git interface or with an explicit reviewed reconciliation.

## D-2026-08-22-03 — Maintain a tool-neutral, specification-led AI workflow

**Decision:** Word Smash development remains specification-led and
tool-neutral. Replit Agent is a supported primary developer interface, and
Claude Code or another repository-capable AI may work from the same cloned
repository and specifications.

**Why:** Multiple teams need a shared process that outlives any single AI tool.
The product’s offline constraints and literacy rules are more important than a
particular coding interface.

**How to apply:** Any AI developer must read the spec index, four core specs,
current backlog, newest decision record, and implementation decision guide
before modifying code. It must connect implementation and tests back to those
documents.

## D-2026-08-22-04 — Use Claude Artifacts for exploration, not production delivery

**Decision:** Claude Artifacts may be used for visual, interaction, or
stakeholder exploration. Production changes must be rebuilt and verified in the
Word Smash repository.

**Why:** A standalone prototype can accelerate discussion, but it does not
prove compliance with the Curious Reader offline WebView, packaging, audio, or
event-bridge requirements.

**How to apply:** Treat an approved Artifact as a reference input. Convert the
approved behavior into a scoped backlog item, implement it in the repository,
and run the documented validation gates before merging.

## D-2026-08-22-05 — Centralize operational coordination in versioned documents

**Decision:** `BACKLOG.md` is the central repository record for future work and
workflow, and dated decision records capture significant cross-team choices.

**Why:** Several teams and agents need a durable, reviewable handoff mechanism.
Code alone cannot explain why priorities, ownership, release gates, or
cross-tool practices were selected.

**How to apply:** Update the backlog whenever a work item changes status,
priority, acceptance criteria, or owner. Add a dated decision record when a
choice changes collaboration, product scope, architecture, publication, or
release policy. Update the core specifications too when the shipped product’s
requirements change.

---

## Changelog

- 2026-08-22 — Tinsley Galyean & Replit Agent — Initial decision record authored.