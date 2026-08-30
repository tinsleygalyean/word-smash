# Repository AI Onboarding Playbook

This guide explains how the current Word Smash Replit workspace operates and how
to reproduce its useful collaboration patterns with Claude or another coding AI.
It is an operational reference, not an implementation of an agent runtime.

Return to the [repository README](../README.md) for the short setup path.

## 1. Evidence labels and limits

This document uses three labels:

- **Repository fact** — verified in versioned files in this clone. Recheck after
  configuration or dependency changes.
- **Replit platform fact** — described by Replit's public documentation or the
  workspace's Replit-provided operating instructions. Recheck the linked public
  docs because platform UI and behavior can change.
- **Portable recommendation** — an engineering pattern proposed here. It can be
  implemented with Claude, CI, Git hosting, a database, or other tools; it is not
  a claim about Replit internals.

Replit's callbacks, task isolation, artifact UI, proxy routing, managed workflows,
integration authorization, and publishing behavior are platform-specific. A
portable system can reproduce the contracts and approval gates, but should not
claim to reproduce proprietary Replit internals exactly.

## 2. Current workspace, from outside in

### Hierarchy

1. **Workspace/project** — **Replit platform fact:** a project contains code,
   data, collaboration context, and one or more artifacts.
2. **Repository** — **Repository fact:** a pnpm monorepo configured by
   `package.json`, `pnpm-workspace.yaml`, `.replit`, and `replit.md`.
3. **Packages** — **Repository fact:** workspace members are discovered under
   `artifacts/*`, `lib/*`, `lib/integrations/*`, and `scripts`.
4. **Artifacts** — publishable or presentable product surfaces with metadata,
   services, and a unique preview path.
5. **Services** — long-running processes owned by an artifact. One artifact may
   own one or more services.
6. **Workflows** — managed development commands that keep services running and
   inject service environment such as `PORT` and `BASE_PATH`.
7. **Skills** — on-demand operating instructions for a role or capability. They
   guide tool use; they are not application packages or always-loaded context.
8. **Tasks** — **Replit platform fact:** persistent units of work displayed in
   Drafts, Active, Ready, and Done board groups. Their underlying lifecycle also
   represents approval/pending, queued, implementation, apply/merge, completion,
   and cancellation events.
9. **Deployments** — external releases of artifacts/services. Deployment is a
   distinct lifecycle from development preview.
10. **Integrations and MCP** — authorized routes to external services and tools.
11. **Environment variables and secrets** — runtime configuration; secret values
    must not enter prompts, logs, commits, screenshots, or client bundles.

### Current concrete artifacts

| Artifact | Metadata | Development service | Production shape |
|---|---|---|---|
| Word Smash | `artifacts/word-smash/.replit-artifact/artifact.toml`; web; `/` | `@workspace/word-smash dev`, port 23518 | Static Vite build with SPA rewrite |
| API Server | `artifacts/api-server/.replit-artifact/artifact.toml`; API; `/api` | `@workspace/api-server dev`, port 8080 | Node service; `/api/healthz` startup check |
| Canvas | `artifacts/mockup-sandbox/.replit-artifact/artifact.toml`; design; `/__mockup` | `@workspace/mockup-sandbox dev`, port 8081 | Development preview surface |

Word Smash is client-only and does not use the API Server today. The API's
presence is not permission to introduce an online dependency into the game.

### Package and routing rules

- Use `workspace:*` for internal dependencies and the root catalog for shared
  dependency versions.
- Run root typechecking before leaf checks when generated library declarations
  may be stale.
- Browser-visible URLs must preserve an artifact's base path. A local server's
  port is not its public Replit route.
- Persistent services bind to injected `PORT`; one-off typechecks, tests, and
  builds are shell commands, not replacement workflows.
- In Replit, restart an artifact's existing managed workflow after service,
  package, toolchain, or run-command changes. Do not create a competing workflow.

## 3. Specification chain

The repository's product truth is organized as:

`PRD → DEVSPEC → UISPEC → TESTSPEC`

Read [`docs/specs/README.md`](specs/README.md) first. Then use:

- [PRD](specs/PRD.md) for product intent, users, scope, and non-goals.
- [DEVSPEC](specs/DEVSPEC.md) for authoritative behavior, schemas, constants,
  packaging, and offline constraints.
- [UISPEC](specs/UISPEC.md) for the visual and interaction contract.
- [TESTSPEC](specs/TESTSPEC.md) for fixtures, checks, release gates, and known
  automation gaps.
- [DECISIONS](../artifacts/word-smash/DECISIONS.md) for architectural rationale.
- [UPLOAD](../artifacts/word-smash/UPLOAD.md) for packaging/upload operations and
  their human approval boundary.

Specs describe intent and required outcomes; current code establishes what exists
now. Investigate both. If they disagree, report the conflict rather than silently
choosing one.

## 4. Agent taxonomy and contracts

Roles are contracts, not necessarily separate model products. A small team can
run them as separate Claude sessions, subagents, CI jobs, or carefully separated
prompt phases.

| Role | Use it for | Expected output | Must not do |
|---|---|---|---|
| **Primary conversational/planning agent** | Intake, clarification, investigation strategy, plans, approvals, coordination | Evidence-backed plan, task graph, status and final summary | Hide uncertainty, bypass approval, or implement broad work before alignment |
| **Implementation/task agent** | One approved, bounded task in isolated work | Focused change, checks, drift report, merge-ready result | Expand scope, edit unrelated work, publish, or mark success without evidence |
| **Read-only explorer** | Locate code, compare specs, answer independent repository questions | Findings with file citations | Edit files, mutate tasks, run destructive commands |
| **General delegated agent** | A bounded independent research or transformation unit | Contracted result for the parent agent | Assume ownership of product decisions |
| **Design agent** | UI direction and frontend implementation under a design brief | Design rationale and implementation in agreed scope | Override product intent or treat visual taste as automatically accepted |
| **Browser-testing agent** | Exercise completed changed flows in a real browser | Steps, observed results, console evidence, failures | Rewrite product code or broaden requirements during testing |
| **Architecture/code-review agent** | Review major features, plans, security/reliability risks | Prioritized findings and recommended fixes | Become the implementer of the same change or approve its own work |
| **Persistent sidekick (optional)** | Long-running domain monitoring, triage, or repeated narrow duties | Durable queue updates or alerts | Hold secrets in memory, act without bounded permissions, or replace the primary owner |

### Suggested role prompt contract

Every delegated role should receive:

```text
Role:
Goal:
In scope:
Out of scope:
Authoritative sources:
Allowed tools and filesystem scope:
External-write policy:
Required evidence:
Output format:
Stop/ask conditions:
```

For an implementation agent, add the approved task, dependency status, branch or
worktree, validation commands, expected artifact, and drift policy. For an
explorer, make the filesystem read-only. For review, provide the diff and
requirements but not a mandate to defend the implementation.

### Skills

**Replit platform fact:** local skills contain authoritative, task-specific
instructions and may expose supported callbacks. Load only those relevant to the
request so context remains focused.

**Portable recommendation:** represent each skill as a versioned Markdown
contract plus optional scripts. Include triggers, allowed tools, safety rules,
examples, and a stable output schema. A skill never grants authorization by
itself; the runtime's permission system must enforce access.

## 5. Human-in-the-loop workflow

### End-to-end sequence

1. **Intake and clarification** — restate the outcome, identify ambiguity, and ask
   only questions that materially change scope.
2. **Investigation** — inspect instructions, specs, current code, history, and
   runtime state. Use parallel read-only explorers for independent questions.
3. **Existing-work check** — search active/proposed work before creating a new
   task. Reuse or revise overlapping work rather than duplicating it.
4. **Plan** — define done criteria, out-of-scope items, dependencies, risks,
   approval gates, affected artifacts, and verification.
5. **Approval** — a human confirms product intent and material external effects.
6. **Dependency-aware execution** — run independent approved tasks in parallel;
   block dependents until prerequisites are integrated.
7. **Isolated work** — each task changes only its scope in a branch, worktree, or
   isolated environment. Its private checklist is not the user's task list.
8. **Drift handling** — if evidence changes scope or approach, stop, report the
   difference, revise the plan, and obtain approval when material.
9. **Merge/visibility boundary** — isolated changes are not visible in the main
   workspace until reviewed and merged. Conflicts are resolved explicitly.
10. **Validation** — run static checks, focused tests, builds/package checks, and
    one end-to-end browser pass when behavior changed.
11. **Review** — use an independent reviewer for major work; address high-impact
    findings and rerun only invalidated checks.
12. **Release approval** — present evidence and residual risks. A human decides
    whether to upload, promote, publish, or deploy.

### Replit task lifecycle versus portable display language

**Replit platform fact:** the public task system presents work in the board groups
**Drafts**, **Active**, **Ready**, and **Done**. Platform/runtime records may use
more detailed states such as `PROPOSED`, `PENDING`, `QUEUED`, `IN_PROGRESS`,
`IMPLEMENTED`, `MERGING`, `MERGED`, and `CANCELLED`. A proposed task can require
acceptance before it becomes pending/queued or active. Work completed in an
isolated task environment can be implemented and ready to apply without yet being
visible in the shared workspace; applying it starts the merge boundary, and only
a successful merge makes it merged/done. Recheck the
[official task system documentation](https://docs.replit.com/core-concepts/agent/task-system)
for current UI wording and transitions.

Do not present the detailed internal state tokens as language users must learn.
Use the current board labels in a Replit UI, and explain exceptional conditions
such as “waiting for approval,” “queued,” or “merging” in plain language.

**Portable recommendation:** a non-Replit orchestrator may use the following
smaller state model if it preserves the same approval, isolation, and merge
semantics:

Use friendly display language while retaining stable machine states internally:

| User-facing language | Example machine state | Meaning |
|---|---|---|
| Proposed | `PROPOSED` | Candidate work awaiting approval or prioritization |
| Active | `IN_PROGRESS` | Approved work being investigated or implemented |
| Ready to merge | `READY` | Implementation complete; checks/review evidence attached |
| Merging | `MERGING` | Integration transaction is in progress |
| Merged | `COMPLETED` | Successfully integrated into the shared source of truth |
| Archived | `ARCHIVED` | Intentionally closed without active delivery |

These portable enum names are examples, not Replit state names. Model
cancellation separately with a reason.

Recommended transitions:

```text
Proposed --human approves/worker claims--> Active
Active --checks and review pass--> Ready to merge
Ready to merge --merge starts--> Merging
Merging --integrated--> Merged
Any non-merged state --cancel/obsolete--> Archived
Active --material drift--> Proposed (replanned) or remains Active after approval
```

A task record should contain `id`, title, outcome/done criteria, scope,
dependencies, state, owner/role, artifact, branch/worktree, plan revision,
approval events, verification evidence, review findings, drift reason, merge
reference, and timestamps. Dependencies form a directed acyclic graph; reject
self-dependencies and cycles.

## 6. Responsibility and approval boundaries

| Activity | AI | Human | Gate |
|---|---|---|---|
| Investigate repository and platform docs | Responsible | Supplies inaccessible context | Findings reviewed when ambiguous |
| Propose plan and task graph | Responsible | Accountable | Human approves material scope |
| Implement approved changes | Responsible | Consulted for product tradeoffs | Drift requires replan |
| Run automated verification | Responsible | Reviews evidence | Required checks must pass or be explicitly waived |
| Product intent and priority | Advises | Accountable | Human decision |
| Credentials/account selection | Never requests values in chat | Authorizes through secure UI | Explicit authorization |
| Subjective visual/device acceptance | Supplies evidence | Accountable | Human acceptance |
| External writes, upload, promotion | Prepares and may execute only after explicit authorization | Accountable | Confirm target and consequences |
| Publish/deploy/go-live | Readiness and runbook | Final decision | Explicit go/no-go |

Destructive changes require an explanation of consequences and informed consent.
Prefer reversible actions and checkpoints. Never turn “make it work” into implied
authorization to delete data, rotate credentials, publish, or change product
intent.

## 7. Artifact and service lifecycle

### Create or update?

Update an existing artifact when the change belongs to the same product, domain,
branding, purpose, and release unit. Create a new artifact when it is a distinct
product or deliverable, has different branding/purpose, or needs an independent
publishable lifecycle. If uncertain, ask.

Every artifact needs:

- a stable unique ID and human title;
- a unique slug/directory and preview path;
- kind (web, API, design, mobile, slides, etc.);
- owned service definitions and local ports;
- development command and environment contract;
- production build/run or static-serving contract;
- routing/rewrites and health checks when applicable.

Do not hand-edit platform metadata if the platform requires a validated artifact
operation. In a portable clone, validate the same metadata against a schema in CI.

### Routing, ports, and deployment

- Each long-running service must bind to the assigned `PORT`.
- Preview paths are part of the artifact contract: Word Smash `/`, API `/api`,
  Canvas `/__mockup`.
- A static deployment publishes built files (Word Smash currently uses static
  serving plus an SPA rewrite). A server deployment runs a process and needs
  health checks and lifecycle management (the API Server).
- Development preview, presentation/share, and production publishing are
  different events. A passing preview is not a production release.
- Artifact-owned workflows are the canonical persistent services. Use shell
  commands for one-off checks and restart the managed workflow after changes that
  affect serving.

## 8. Verification, review, and release

### Canonical repository checks

```bash
pnpm run typecheck
pnpm --filter @workspace/word-smash run test
pnpm --filter @workspace/word-smash run package:container -- --lang english
pnpm run build
```

The package command rebuilds and checks the Curious Reader engine and language
ZIPs. The upload dry run is:

```bash
pnpm --filter @workspace/scripts run upload:wordsmash -- \
  --lang english --dry-run
```

For docs-only changes, additionally validate relative links and command names.
Application checks still provide a clean baseline, but browser testing is not
needed when no behavior or presentation changed.

### Quality sequence

1. Static/type checks.
2. Focused unit/component tests for affected behavior.
3. Build and packaging integrity.
4. Restart the relevant service and inspect server/browser logs.
5. One focused browser journey for completed behavior changes.
6. Independent architecture/code review for major work.
7. Human subjective/device/offline acceptance where automation cannot decide.
8. Human release approval.

Never describe a skipped check as passing. Record the command, outcome, evidence,
and an audited reason for any waiver.

## 9. Integrations, MCP, variables, and secrets

### Authorization rules

- Prefer an existing authorized integration to asking for an API key.
- If authorization is required, use the provider/platform's secure consent flow.
- Do not silently choose between multiple accounts.
- Use least privilege and state the intended external reads/writes before consent.
- An AI instruction or skill is not authorization.
- Confirm destructive or externally visible writes immediately before execution.
- Clean up test records created in external systems when safe and agreed.

### Secret rules

- Ask only whether a required secret exists; never print or inspect its value.
- Never request passwords, tokens, private keys, or API keys in chat.
- Never place secrets in source, task records, agent memory, logs, screenshots,
  command output, URLs, browser storage, or client-side bundles.
- Inject secrets server-side at runtime. Expose non-sensitive configuration as
  environment variables only when necessary.
- Do not copy server tokens to the browser. Use a backend/proxy or narrowly scoped
  short-lived token when the provider explicitly supports it.
- Treat connector clients as short-lived handles if the platform refreshes
  credentials; do not persist access tokens.
- Human operators own credential provisioning, account selection, revocation, and
  production permission changes.

This repository's live CMS upload is intentionally separate from its dry run.
The upload guide does not authorize promotion or publishing.

## 10. Claude-agnostic replication blueprint

### Minimum viable mimic

Start with ordinary, inspectable components:

```text
.ai/
  project.md              # repository instructions and responsibility boundary
  roles/
    planner.md
    implementer.md
    explorer.md
    tester.md
    reviewer.md
  skills/                 # on-demand versioned procedures
  schemas/
    task.schema.json
    artifact.schema.json
  state/
    artifacts.json
    tasks.json
    approvals.jsonl
    verification.jsonl
scripts/
  ai-next-task.ts
  ai-verify.ts
  ai-merge.ts
```

1. **Task store:** JSON/SQLite/PostgreSQL records using the state model in §5.
2. **Artifact registry:** ID, directory, kind, preview path, services, build/run
   commands, health checks, and deployment mode.
3. **Role runner:** starts a fresh model session with the role contract, approved
   task, bounded files/tools, and read-only or write permissions.
4. **Workflow runner:** supervises declared services, assigns ports, captures
   logs, and exposes health status. Do not let agents invent unregistered daemons.
5. **Verification runner:** executes named commands, stores exit code, timestamp,
   revision, and log artifact; invalidates evidence when relevant files change.
6. **Approval log:** append-only events for plan, external-write, merge, waiver,
   and release decisions. Store actor and exact approved scope, not credentials.
7. **Merge protocol:** require approved plan, satisfied dependencies, clean diff,
   passing required checks, review resolution, and no unapproved drift.

### Minimal orchestration loop

```text
receive request
  -> load project instructions and relevant skills
  -> investigate repository read-only
  -> find overlapping tasks
  -> draft plan + dependency graph + gates
  -> wait for human approval
  -> claim next unblocked task in isolated branch/worktree
  -> implement within scope
  -> verify and review
  -> if drift: replan and wait as needed
  -> mark ready; merge transaction
  -> summarize evidence and wait for release approval
```

Use atomic task claims and optimistic versioning so two workers cannot own the
same task or overwrite a newer plan. Make merge and state transition one logical
transaction: a task must not appear “Merged” if integration failed.

### Optional enhancements

- durable queue/database and event stream;
- branch protection and CI-required checks;
- sandboxed tool/filesystem policies per role;
- signed approval events and audit retention;
- automatic dependency scheduling and cancellation propagation;
- artifact preview environments per task;
- budget/time limits and model routing by role;
- persistent sidekicks with narrow permissions and human-visible queues;
- retrieval over versioned skills and specs;
- secret scanning, dependency auditing, and policy-as-code.

## 11. Worked request-to-release example

Request: “Add a new visual hint to Word Smash.”

1. Planner reads the repository entry points, DEVSPEC, UISPEC, TESTSPEC, and
   current hint code; an explorer checks for overlapping tasks.
2. Planner reports whether the request changes product intent or only presentation.
   It proposes spec/code/test changes and names the subjective approval point.
3. Human chooses the intended behavior and approves the plan.
4. Task agent works in isolation, updates the earliest affected spec and
   downstream documents, implements only the approved behavior, and adds focused
   tests.
5. Verification runs typecheck, Word Smash tests, build/package checks, restarts
   the Word Smash workflow, and exercises one browser flow.
6. Reviewer compares the diff to requirements and flags regressions or drift.
7. Human reviews the visual evidence. The task merges only after acceptance.
8. The AI prepares release evidence. The human separately authorizes any upload,
   promotion, deployment, or publish action.

At no point does the private implementation checklist masquerade as separate
user-visible tasks, and a successful local preview does not imply go-live.

## 12. Reusable checklists

### Before planning

- [ ] Read README, project instructions, playbook, and specs index.
- [ ] Inspect relevant current code/config; do not trust stale summaries.
- [ ] Load only relevant skills.
- [ ] Search for overlapping active/proposed work.
- [ ] Label facts, unknowns, and recommendations.
- [ ] Identify product, credential, destructive, and external-write gates.

### Before implementation

- [ ] Human approved the material scope.
- [ ] Dependencies are complete.
- [ ] Done criteria and validation commands are explicit.
- [ ] Branch/worktree and filesystem scope are isolated.
- [ ] Required integrations are authorized through a secure flow.

### Before merge

- [ ] Diff is limited to scope; drift is explained and approved.
- [ ] Required specs/docs are consistent.
- [ ] Typecheck and focused tests pass.
- [ ] Build/package checks pass when affected.
- [ ] Behavior changes received one focused browser pass.
- [ ] Major work received independent review.
- [ ] No secret, generated junk, or unrelated change is present.

### Before release

- [ ] Artifact and target environment are named.
- [ ] Logs, health checks, offline/device checks, and residual risks are reviewed.
- [ ] External side effects and rollback are understood.
- [ ] Credentials remain server-side and undisclosed.
- [ ] Human explicitly approved upload/promotion/publish/deploy.

## 13. Troubleshooting

| Symptom | First checks |
|---|---|
| Blank preview | Confirm the artifact's managed workflow is running; inspect service and browser logs; verify `PORT`, host binding, `BASE_PATH`, and path-aware URLs |
| Works locally, fails behind proxy | Look for hard-coded localhost/root URLs and missing artifact base paths |
| Workflow times out | Fix application crashes first; then confirm it binds the assigned port and health path |
| Offline package fails | Re-read DEVSPEC offline rules; check relative paths, `file://` XHR status 0, bundled assets/fonts, and `test:bundle` |
| Task agents conflict | Check duplicate ownership, dependency graph, plan revision, and branch/worktree isolation before merging |
| Verification disagrees | Tie evidence to the exact revision; rerun invalidated checks and report the real failure |
| Integration fails | Check connection status and required scope; use secure reauthorization rather than pasting credentials |
| AI wants broader changes | Treat as drift: explain why, update scope/risks/checks, and obtain approval |
| Docs and code disagree | Cite both, identify the earliest source of truth affected, and reconcile downstream docs deliberately |

## 14. Glossary

- **Artifact:** independently presentable/publishable output with metadata and
  owned services.
- **Project/workspace:** repository, data, configuration, agents, and artifacts
  managed together.
- **Service:** long-running process serving an artifact path.
- **Workflow:** managed command/lifecycle for a development service.
- **Skill:** reusable, on-demand operating instructions and optional scripts.
- **Task:** persistent, dependency-aware delivery unit with approval and merge
  boundaries.
- **Explorer:** read-only agent used to gather cited evidence.
- **Drift:** implementation outcome or approach differs from the approved plan.
- **Approval event:** durable record of a human decision at a defined gate.
- **MCP:** Model Context Protocol, a standard interface for model-accessible tools.
- **Connector/integration:** authorized connection to an external provider.
- **Preview:** development view; not equivalent to a production deployment.
- **Promotion/publish:** externally visible release action controlled by a human.

## 15. Authoritative Replit references

Recheck these public pages as the platform evolves:

- [Projects](https://docs.replit.com/features/projects-and-artifacts/projects)
- [Artifacts](https://docs.replit.com/features/projects-and-artifacts/artifacts)
- [Agent task system](https://docs.replit.com/core-concepts/agent/task-system)
- [Workflows](https://docs.replit.com/features/workspace-tools/workflows)
- [Secrets](https://docs.replit.com/core-concepts/project-editor/app-setup/secrets)
- [Agent integrations](https://docs.replit.com/features/integrations/overview)
- [Connect via MCP](https://docs.replit.com/build/connect-via-mcp)
- [Warehouse connectors](https://docs.replit.com/connectors/warehouses/overview)

Repository-local `.local/skills/` files are implementation guidance for this
workspace, not universal public Replit documentation. Public documentation is
authoritative for platform claims; this repository is authoritative for its own
checked-in configuration and product contracts.

## 16. Maintenance

When the system changes, recheck:

- `package.json`, `pnpm-workspace.yaml`, `.replit`, and `replit.md`;
- each artifact's `.replit-artifact/artifact.toml` and package scripts;
- [`docs/specs/README.md`](specs/README.md) and its full downstream chain;
- Word Smash [DECISIONS](../artifacts/word-smash/DECISIONS.md) and
  [UPLOAD](../artifacts/word-smash/UPLOAD.md);
- relevant `.local/skills/` operating instructions;
- the linked public Replit documentation.

Keep the root README concise. Put operational detail here, product requirements in
the spec chain, architectural rationale in DECISIONS, and upload procedure in
UPLOAD. Do not duplicate secrets or account-specific data anywhere.