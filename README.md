# Word Smash workspace

**Start here.** This page is the map: what Word Smash is, what is in the
repository, and which document to read next. It contains no setup instructions —
those live in [docs/ONBOARDING.md](docs/ONBOARDING.md).

Word Smash is an offline literacy game for children ages 4–8. Children smash a
word into sound units and rebuild it while hearing those sounds. The game is
designed for Curious Learning's Curious Reader container and must run without a
network connection from a local `file://` WebView.

---

## Where to go next

Read in this order. Each document names its own prerequisite, and none of them
repeat another's content.

| # | Document | Answers | Read only after |
|---|---|---|---|
| 1 | **This page** | What is this, and where is everything? | — |
| 2 | **[docs/ONBOARDING.md](docs/ONBOARDING.md)** | How do I get it running on my machine? | This page |
| 3 | [docs/CONTENT_PIPELINE.md](docs/CONTENT_PIPELINE.md) | How do I change a word, or add a language? | Onboarding |
| — | [docs/SETUP.md](docs/SETUP.md) | *Reference.* Manual setup, rationale, troubleshooting | Onboarding — consult when something breaks |
| — | [docs/specs/README.md](docs/specs/README.md) | What is the product supposed to do? | This page |
| — | [docs/REPLIT_AGENT_PLAYBOOK.md](docs/REPLIT_AGENT_PLAYBOOK.md) | How do AI and humans split work here? | This page |
| — | [AGENTS.md](AGENTS.md) | *For AIs.* What are the standing rules and non-negotiables? | This page |

**In one line:** install prerequisites → clone → open the repo in Claude Code →
`/getstarted` → `/console`. [Onboarding](docs/ONBOARDING.md) walks all of it,
separately for Replit, the Claude Code desktop app, the VS Code extension, and
the CLI, and separately for macOS, Windows, and Ubuntu.

---

## What is in the repository

A pnpm/TypeScript monorepo with three registered artifacts:

| Artifact | Package | Purpose | Replit preview |
|---|---|---|---|
| **Word Smash** | `@workspace/word-smash` | React/Vite game and offline package builder | `/` |
| **API Server** | `@workspace/api-server` | Supporting Express API; not used by the current offline game | `/api` |
| **Canvas** | `@workspace/mockup-sandbox` | Component and design preview surface | `/__mockup` |

### Directory guide

- `artifacts/word-smash/` — game source, language/audio assets, tests,
  packaging, architecture decisions, and upload documentation.
- `artifacts/api-server/` — supporting API service.
- `artifacts/mockup-sandbox/` — design/component canvas.
- `lib/` — shared workspace libraries.
- `scripts/` — repository automation, including the CMS upload client.
- `AGENTS.md` — standing rules for any AI working here; `CLAUDE.md` is a
  one-line import of it so Claude Code loads it automatically.
- `docs/` — onboarding, setup, content pipeline, the AI playbook, and specs.
- `.claude/commands/` — this repo's Claude Code slash commands (`/getstarted`,
  `/console`). They exist only when Claude Code has the repository root open.
- `.local/skills/` — Replit Agent's on-demand operating instructions. Useful
  source material, but not automatically available to other AIs.
- `.replit-artifact/artifact.toml` inside each artifact — checked-in artifact
  metadata; change it with the owning platform's supported artifact tools.

---

## Command map

Full explanations are in [CONTENT_PIPELINE.md](docs/CONTENT_PIPELINE.md); the
manual setup and release commands are in [SETUP.md](docs/SETUP.md). This is only
a map of what exists.

| Command | Does |
|---|---|
| `pnpm preflight` | Audit the machine and print the fix for anything missing |
| `pnpm setup:native` | Install your platform's native build binaries (not needed on linux-x64) |
| `pnpm content:build` | Sheet → language JSON, validated |
| `pnpm game:build` | Content + engine ZIP + language ZIPs |
| `pnpm game:preview` | Play a built language (port 23520) |
| `pnpm game:upload` | Send to the CMS — **dry run unless `--live`** |
| `pnpm game:console` | Control panel for all four, plus a phone-landscape preview (port 23522) |
| `pnpm game:artifact` | Pack a language into one shareable HTML file |
| `pnpm run typecheck` | Full typecheck across all packages |

Add `-- --lang <code>` to any pipeline command to work on a single language.

**Level content is not in this repository.** Words and levels live in the
[Word Smash levels sheet](https://docs.google.com/spreadsheets/d/1X_A1EnF4ySLp508donSBBKuL-mDYG4Ojlv7ItcWCXfo/edit),
one tab per language; `public/lang/<code>/wordsmash.json` is generated from it.
Edit the sheet, then rebuild.

---

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
| [Content pipeline](docs/CONTENT_PIPELINE.md) | How does sheet content become a release? | Source sheet, generated files, build/preview/upload commands |
| [Container spec feedback](docs/CONTAINER_SPEC_FEEDBACK.md) | What have we asked the container team to clarify? | Open requests against the `cr_event` contract (§6) |

When intent changes, review downstream documents in table order. When an
implementation detail changes without altering intent, begin at the earliest
affected document and reconcile all downstream references.

---

## Working here with Claude or another coding AI

[`AGENTS.md`](AGENTS.md) holds the standing rules for any AI working in this
repository: the non-negotiables, the generated files that must not be hand-edited,
and the architecture details that are easy to get wrong. Claude Code loads it
automatically through [`CLAUDE.md`](CLAUDE.md), and Replit Agent is pointed at it
from [`replit.md`](replit.md). Any other AI should be told to read it.

Give the AI the request, then ask it to:

1. Read [`AGENTS.md`](AGENTS.md) — the authoritative agent brief — then this
   README, the [AI playbook](docs/REPLIT_AGENT_PLAYBOOK.md), and
   [`docs/specs/README.md`](docs/specs/README.md).
2. Read only the product specs and reusable skills relevant to the request.
3. Inspect the current code and existing work before assuming the docs are current.
4. Separate verified repository facts from platform facts and recommendations.
5. Propose a scoped plan, risks, approval gates, and verification before editing.
6. Stop for human confirmation before credentials, external writes, publishing,
   promotion, destructive work, or a change in product intent.

A useful opening prompt:

> Read `AGENTS.md`, `README.md`, `docs/REPLIT_AGENT_PLAYBOOK.md`, and
> `docs/specs/README.md`. Then inspect the files and only the skills relevant to
> my request. Report what is verified, identify any ambiguity or existing
> overlapping work, and propose a plan and checks before making changes.

### Who owns what

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

---

## Non-negotiables

- **pnpm only.** A `preinstall` guard rejects npm and yarn.
- **The one-day minimum package release age stays on.** Do not disable that
  supply-chain safeguard to make an installation convenient.
- **The game must work offline.** No `fetch()`, no `<audio>`, no CDN tags; the
  build fails the release if it finds a forbidden pattern.
- **Live uploads and publishing are human decisions.** `pnpm game:upload` dry-runs
  by default; a real upload needs credentials and a typed confirmation, and lands
  only in the CMS development channel.
