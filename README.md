# Word Smash workspace

Word Smash is an offline literacy game for children ages 4–8. Children smash a
word into sound units and rebuild it while hearing those sounds. The game is
designed for Curious Learning's Curious Reader container and must run without a
network connection from a local `file://` WebView.

This repository is a pnpm/TypeScript monorepo containing three registered
artifacts:

| Artifact | Package | Purpose | Replit preview |
|---|---|---|---|
| **Word Smash** | `@workspace/word-smash` | React/Vite game and offline package builder | `/` |
| **API Server** | `@workspace/api-server` | Supporting Express API; not used by the current offline game | `/api` |
| **Canvas** | `@workspace/mockup-sandbox` | Component and design preview surface | `/__mockup` |

For the operating model behind this workspace—including agents, tasks,
artifacts, workflows, approvals, secrets, verification, and a portable
Claude-oriented blueprint—read the
[Repository AI Onboarding Playbook](docs/REPLIT_AGENT_PLAYBOOK.md).

## Getting started

Requirements: Node.js 24 and pnpm. Run commands from the repository root.

```bash
git clone <repository-url>
cd <repository-directory>
corepack enable
pnpm install

# Learn the workspace before changing it
cat README.md
cat docs/REPLIT_AGENT_PLAYBOOK.md
cat replit.md
cat docs/specs/README.md

# Canonical checks
pnpm run typecheck
pnpm --filter @workspace/word-smash run test
pnpm --filter @workspace/word-smash run package:container -- --lang english
pnpm run build
```

In Replit, start the artifact's existing managed workflow. Outside Replit, run
the package command and provide the environment that the workflow normally
injects:

```bash
# Word Smash (http://localhost:23518/)
PORT=23518 BASE_PATH=/ \
  pnpm --filter @workspace/word-smash run dev

# API Server (http://localhost:8080/api; health at /api/healthz)
PORT=8080 pnpm --filter @workspace/api-server run dev

# Canvas (http://localhost:8081/__mockup)
PORT=8081 BASE_PATH=/__mockup \
  pnpm --filter @workspace/mockup-sandbox run dev
```

Useful Word Smash release checks:

```bash
# Relative-path offline bundle only
pnpm --filter @workspace/word-smash run build:standalone

# Rebuild the bundle/ZIPs, then run offline integrity checks
pnpm --filter @workspace/word-smash run test:bundle

# Check already-built outputs without rebuilding (outputs must exist)
pnpm --filter @workspace/word-smash run test:bundle --no-build

# Show the CMS upload plan without contacting the CMS
pnpm --filter @workspace/scripts run upload:wordsmash -- \
  --lang english --dry-run
```

Do not run a live upload or publish based only on an AI's judgment. Those actions
require credentials, external side effects, and human approval.

## Starting a task with Claude or another coding AI

Give the AI the request, then ask it to:

1. Read this README, the [AI playbook](docs/REPLIT_AGENT_PLAYBOOK.md),
   [`replit.md`](replit.md), and [`docs/specs/README.md`](docs/specs/README.md).
2. Read only the product specs and reusable skills relevant to the request.
3. Inspect the current code and existing work before assuming the docs are current.
4. Separate verified repository facts from platform facts and recommendations.
5. Propose a scoped plan, risks, approval gates, and verification before editing.
6. Stop for human confirmation before credentials, external writes, publishing,
   promotion, destructive work, or a change in product intent.

A useful opening prompt is:

> Read `README.md`, `docs/REPLIT_AGENT_PLAYBOOK.md`, `replit.md`, and
> `docs/specs/README.md`. Then inspect the files and only the skills relevant to
> my request. Report what is verified, identify any ambiguity or existing
> overlapping work, and propose a plan and checks before making changes.

## Product specification map

Read and update the chain from intent to verification:

`PRD → DEVSPEC → UISPEC → TESTSPEC`

| Document | Question it answers | Source-of-truth role |
|---|---|---|
| [Specs index](docs/specs/README.md) | How do the living specs relate and change? | Authoring order, status, version, and changelog rules |
| [PRD](docs/specs/PRD.md) | What is the product, for whom, and why? | Product intent, principles, scope, and non-goals |
| [DEVSPEC](docs/specs/DEVSPEC.md) | What must be built and how must it behave? | Authoritative behavior, schemas, constants, and offline requirements |
| [UISPEC](docs/specs/UISPEC.md) | What should users see, hear, and do? | Visual and interaction contract; cites DEVSPEC for behavior |
| [TESTSPEC](docs/specs/TESTSPEC.md) | How is the required behavior and UI verified? | Test cases, fixtures, gates, and coverage map |
| [Architecture decisions](artifacts/word-smash/DECISIONS.md) | Why were important implementation constraints chosen? | Deeper rationale and Curious Reader compatibility decisions |
| [Upload guide](artifacts/word-smash/UPLOAD.md) | How are packages prepared and sent to the CMS? | Operator sequence, prerequisites, dry run, and human-controlled boundaries |

When intent changes, review downstream documents in the table order. When an
implementation detail changes without altering intent, begin at the earliest
affected document and reconcile all downstream references.

## Who owns what

| Stage | AI owns | Human owns | Shared checkpoint |
|---|---|---|---|
| Investigation | Repository search, evidence gathering, duplicate-work check | Missing context and access | Agree on verified facts and unknowns |
| Planning | Scope, dependencies, risks, implementation and test plan | Product intent, priorities, tradeoffs | Approve the plan and external effects |
| Implementation | Code/docs changes within approved scope | Credentials and irreversible decisions | Review drift before expanding scope |
| Verification | Typecheck, tests, builds, package checks, evidence | Subjective/device acceptance | Review failures and acceptance evidence |
| Release | Readiness summary, runbook, reversible preparation | Upload, promotion, publishing, production approval | Explicit go/no-go decision |
| Documentation | Keep affected docs and specs consistent | Approve product-policy changes | Confirm the record matches the decision |

AI must not disclose secrets, silently authorize integrations, choose among
accounts, publish externally, or claim subjective acceptance. Humans should not
need to perform routine repository investigation or run checks the AI can run
safely. Both parties should pause when scope, evidence, or approval changes.

## Repository guide

- `artifacts/word-smash/` — game source, language/audio assets, tests, packaging,
  architecture decisions, and upload documentation.
- `artifacts/api-server/` — supporting API service.
- `artifacts/mockup-sandbox/` — design/component canvas.
- `lib/` — shared workspace libraries.
- `scripts/` — repository automation, including the CMS upload client.
- `docs/specs/` — living Word Smash specification chain.
- `.local/skills/` — Replit Agent's on-demand operating instructions. These are
  useful source material but do not become available automatically to other AIs.
- `.replit-artifact/artifact.toml` inside each artifact — checked-in artifact
  metadata; use the owning platform's supported artifact tools when changing it.

The repository enforces pnpm and a one-day minimum package release age. Do not
disable that supply-chain safeguard to make an installation convenient.
