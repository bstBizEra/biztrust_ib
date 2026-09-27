# Agent roles, tools and plugins

**Inventory:** 26 September 2026. Scope: installed local instruction files, enabled plugin entries, current session tool declarations and repository commands. This is a readiness map, not proof of authentication, provider acceptance, CI success or production readiness. Recheck availability when a task begins.

## How to select and run

1. Identify P0–P7, BT milestones and affected G1–G6 gates from [the implementation plan](implementation-plan.md).
2. Choose one primary procedure from [skill routing](agent-skills.md). Select a role below only for a concrete responsibility.
3. Resolve the installed version and read the complete skill/role instructions and required references. A role name is not a callable tool. `agents/openai.yaml` generally describes skill UI metadata, not another worker.
4. Use the current agent for ordinary work. When delegation is explicitly authorized, use the host's collaboration tools with a bounded task, files, base, acceptance evidence and integration owner. Read-only reviewers should receive that limit explicitly. Do not copy upstream automatic-spawn, model, permission or coverage defaults into the task.
5. Choose a declared tool or verified local command. Check target access and prerequisites before writes; unavailable capabilities remain explicit gaps. A cached plugin, sample MCP configuration or executable on PATH does not prove a working service.

Role prompts supplement repository rules. Engineering roles prepare evidence; business/legal/finance/identity/release owners retain the acceptance decisions in the plan. Agent review cannot substitute for required independent human review.

## Roles mapped to the implementation plan

Role identifiers in this table refer to ECC 2.2.2 `agents/<identifier>.md`. Skills remain the primary workflow. Choose the listed alternatives according to the task, not all at once.

| Phase / gates                        | Role definitions                                                                                                                | Complementary skills                                                                             | Tools and expected evidence                                                                                                                                                                        |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P0 discovery; G1 inputs              | `planner`, `docs-lookup`, `code-explorer`                                                                                       | `ecc:product-lens`, `ecc:documentation-lookup`                                                   | Repository/search tools and authorized source documents; problem evidence, owners, constraints and decisions still needed. No agent supplies insurer/legal authority.                              |
| P1 architecture; G1–G5 design inputs | `architect`, `code-architect`, `a11y-architect`, `type-design-analyzer`                                                         | `ecc:architecture-decision-records`, `ecc:api-design`, `ecc:contract-first`, `ecc:accessibility` | File tools, Figma when a design is supplied, browser inspection; reviewed flows, contracts, NFRs and acceptance criteria.                                                                          |
| P2 local foundation                  | `tdd-guide`, `typescript-reviewer`, `react-reviewer`, `build-error-resolver`, `react-build-resolver`                            | Existing TDD/debugging routes, `ecc:coding-standards`, `ecc:react-patterns`                      | Node/npm, local tests and build; synthetic behavior and regression evidence. Build resolvers are for actual failures, not architecture changes.                                                    |
| P3 governed core; G1/G2              | `database-reviewer`, `security-reviewer`, `type-design-analyzer`, `react-reviewer`, `e2e-runner`                                | `ecc:postgres-patterns`, `ecc:database-migrations`, `ecc:api-design`, `ecc:e2e-testing`          | Local SQL/code review and authorized browser checks; product versioning, roles, tenant isolation and negative authorization evidence.                                                              |
| P4 partners and servicing; G3/G4     | `code-architect`, `database-reviewer`, `silent-failure-hunter`, `pr-test-analyzer`, `security-reviewer`                         | `ecc:contract-first`, `ecc:backend-patterns`, `ecc:postgres-patterns`                            | Repository tests and approved sandbox access; durable receipt, crash/replay, idempotency, reconciliation and policy evidence. External partner tools/access are not established by this inventory. |
| P5 security/operations; G2/G4/G5     | `security-reviewer`, `database-reviewer`, `performance-optimizer`, `doc-updater`                                                | Scoped `code-audit`/`api-security`, `ecc:deployment-patterns`, `ecc:database-migrations`         | Source review, existing dependency audit, authorized load/restore tools; findings, measured recovery and runbooks. Missing scanners and environments remain gaps.                                  |
| P6 staging; G1–G5                    | `code-reviewer`, `typescript-reviewer`, `pr-test-analyzer`, `e2e-runner`, `a11y-architect`, `performance-optimizer`             | `ecc:production-audit`, `ecc:browser-qa`, `ecc:accessibility`, `ecc:github-ops`                  | Exact-revision GitHub evidence, staging browser/tests and release rehearsal; owner acceptance remains required. Avoid duplicate review scopes.                                                     |
| P7 activation/service; G6            | `security-reviewer`, `performance-optimizer`, `doc-updater`; `loop-operator` only for requested recurring work                  | `ecc:deployment-patterns`, scoped `ecc:production-audit`, conditional `golive`                   | Authorized deployment/monitoring targets, pilot evidence and rollback readiness. No role can approve promotion or remove the startup gate on its own.                                              |
| Across phases: maintenance           | `code-explorer`, `docs-lookup`, `doc-updater`, `comment-analyzer`; `code-simplifier`/`refactor-cleaner` only for scoped cleanup | `ecc:codebase-onboarding`, `ecc:living-docs-governance`, existing verification route             | Focused repository changes, progress build/check and preserved decisions. Cleanup must serve the requested outcome.                                                                                |

`agent-evaluator`, `harness-optimizer` and `loop-operator` concern agent workflow quality; use only for a requested evaluation or loop task. `spec-miner` is conditional on a deliberate specification-extraction task; it does not authorize adding OpenSpec automatically. Unrelated language, healthcare, ML, network and marketing roles in the full inventory are not default BizTrust implementation roles.

## Installed role sources and plugins

| Source                   | Observed state                                                                                                                                                                                                   | Use and limits                                                                                                                                                                                                                        |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ECC                      | `ecc@ecc` enabled; manifest 2.2.2; 68 Markdown role definitions                                                                                                                                                  | Inspect `agents/` for role prompts and `skills/` for procedures. Current catalog exposure decides what is available in a session.                                                                                                     |
| ECC Codex configurations | Bundled `.codex/agents/explorer.toml`, `reviewer.toml`, `docs-researcher.toml`                                                                                                                                   | Reference configurations only; no evidence they are registered as selectable host agents. Do not copy the bundled configuration over user settings.                                                                                   |
| Superpowers              | `superpowers@openai-curated` enabled; manifest 5.1.3; cache revision `d6169bef`                                                                                                                                  | Planning, debugging, TDD and review procedures. Role prompts include spec-document reviewer, plan-document reviewer, implementer, spec reviewer and code-quality/code reviewer. Resolve exact prompt files within the selected skill. |
| Six Git skills           | All six local `SKILL.md` files present                                                                                                                                                                           | Use the existing Git routing and publication limits.                                                                                                                                                                                  |
| `find-skills`, `golive`  | Local `SKILL.md` files present                                                                                                                                                                                   | Discovery and scoped provider planning, respectively. Versions/provenance and GoLive acceptance requirements remain in [skill selection](agent-skills.md).                                                                            |
| Document runtimes        | Documents, spreadsheets, presentations and PDF plugin entries enabled                                                                                                                                            | Use exposed skills and the workspace-dependency tool to resolve the actual runtime. A config entry alone does not guarantee an executable capability.                                                                                 |
| Other enabled entries    | Gmail, Google Drive, Hugging Face, build-ios-apps, CircleCI, Codex Security, HeyGen, Figma, OpenAI Developers, Vercel, template-creator, computer-use, visualize, browser, codex-app-tools, unified-computer-use | Local config snapshot only. Use the callable tool catalog and relevant skill to verify runtime availability. These entries do not establish provider authentication or project adoption.                                              |

Configuration and tool catalogs may disagree. In particular, a local enabled entry is not sufficient to claim a service is callable. Do not reinstall or alter permissions solely to reconcile an inventory discrepancy.

## Tools by work area

**27 September addition:** `prompt-engineer` installed from the user-approved public GitHub source, pinned at `e69bac27f7dde6f93f925e8b17eecd506f26ac4b`. Use for substantial project-manager/agent prompt design under [the prompting procedure](agent-skills.md#project-management-prompting); it does not activate external services or expand task authority.

**Declared** means the tool is exposed in the current session; no external account operation was performed for this inventory. **Local** means its command or repository definition was observed. Refresh the schema and relevant skill before use.

| Work area                       | Existing tool/plugin surface                                                                                 | Readiness and boundary                                                                                                                                                                                                                               |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Repository work, all phases     | `exec_command`, `apply_patch`; Git, rg, Node, npm                                                            | Local commands resolved. Inspect status/diff, edit scoped files and run contribution checks. Never infer remote access from local Git availability.                                                                                                  |
| Source research, P0/P1/P4       | `web.run`; OpenAI documentation tools; Google Drive and Atlassian Rovo connector tools                       | Declared. Prefer authoritative sources and authorized project records; citations do not grant product acceptance. Do not upload private repository data unnecessarily.                                                                               |
| Design and content, P1/P3/P6    | Figma, Canva, Adobe tools; image generation; document/spreadsheet skills                                     | Declared tools or supplied skills. Use only for a concrete artifact/design task; confirm source design and output scope. Imagery does not prove accessibility or product approval.                                                                   |
| Browser verification, P2/P3/P6  | `mcp__cua_repl`, Chrome DevTools tools (ECC), project Playwright/axe checks                                  | Browser tools declared; project scripts present. Use the applicable browser skill and documented entry point. Current CUA supports browser control, not native-app control. Runtime/browser health must be checked when used.                        |
| GitHub and CI, P2/P6/P7         | GitHub connector, `gh`, Codex PR/review/worktree tools                                                       | Connector declared and `gh` found. Repository access and hosted enforcement were not tested. Attach created/requested PRs using the Codex artifact tool; honor publication scope.                                                                    |
| Verification, P2–P6             | `npm run verify`, `test:unit`, `test:integration`, `test:e2e`, `test:startup`, `security`; progress commands | Definitions observed. Test environments must be ready. `security` checks production npm dependencies; it is not full SAST, secret/license scanning or an enterprise certification.                                                                   |
| Deployment, P6/P7               | GoLive skill; Vercel and Sites tool surfaces; existing release workflow                                      | Conditional on explicit target selection, concrete plan and deployment authorization. Neither provider is selected as BizTrust production hosting. Docker was not found on the current PowerShell PATH; this does not rule out another runtime/host. |
| Recurring work and delegation   | Codex automation tools, host collaboration tools; Claude Flow/Ruflo tools                                    | Declared. Prefer native tools for host tasks. This inventory activates no workers, swarms, schedules, persistent memory or cross-agent learning. Read backend/tool requirements before any separately requested orchestration.                       |
| Governance and governed skills  | SecB MCP inspection/resolution tools                                                                         | Declared, but no BizTrust project ID, effective registration, G00 record or work package was verified. Require the actual identifiers and applicable authority; never borrow another project's registration.                                         |
| Communications and coordination | Gmail, Google Calendar/Contacts, Atlassian Rovo; Codex chat tools                                            | Declared connector surfaces. Use for an explicitly scoped task; messaging and invitations require user authorization. This inventory neither reads private messages nor sends notifications.                                                         |
| Optional product AI             | Hugging Face tools and AI engineering skills                                                                 | Available references/tools, not part of the current product plan. Only use when a product-AI task is explicitly scoped.                                                                                                                              |

Tools not called here have not passed a health check. SAST/license/secret scanners, load tooling, production runtime, insurer/payment sandboxes, KMS, backup targets and monitoring integrations require task-specific verification. Use skill discovery for a real gap; do not bulk-install plugins to make every table row look ready.

## Full ECC role inventory

The following names were extracted from the installed ECC 2.2.2 `agents/*.md` files. Listing is not activation. Recheck the installed catalog before use.

- `a11y-architect`
- `agent-evaluator`
- `architect`
- `build-error-resolver`
- `chief-of-staff`
- `code-architect`
- `code-explorer`
- `code-reviewer`
- `code-simplifier`
- `comment-analyzer`
- `conversation-analyzer`
- `cpp-build-resolver`
- `cpp-reviewer`
- `csharp-reviewer`
- `dart-build-resolver`
- `database-reviewer`
- `django-build-resolver`
- `django-reviewer`
- `doc-updater`
- `docs-lookup`
- `e2e-runner`
- `fastapi-reviewer`
- `flutter-reviewer`
- `fsharp-reviewer`
- `gan-evaluator`
- `gan-generator`
- `gan-planner`
- `go-build-resolver`
- `go-reviewer`
- `harmonyos-app-resolver`
- `harness-optimizer`
- `healthcare-reviewer`
- `homelab-architect`
- `java-build-resolver`
- `java-reviewer`
- `kotlin-build-resolver`
- `kotlin-reviewer`
- `loop-operator`
- `marketing-agent`
- `mle-reviewer`
- `network-architect`
- `network-config-reviewer`
- `network-troubleshooter`
- `opensource-forker`
- `opensource-packager`
- `opensource-sanitizer`
- `performance-optimizer`
- `php-reviewer`
- `planner`
- `pr-test-analyzer`
- `python-reviewer`
- `pytorch-build-resolver`
- `rag-pipeline-reviewer`
- `react-build-resolver`
- `react-reviewer`
- `refactor-cleaner`
- `rust-build-resolver`
- `rust-reviewer`
- `security-reviewer`
- `seo-specialist`
- `silent-failure-hunter`
- `spec-miner`
- `swift-build-resolver`
- `swift-reviewer`
- `tdd-guide`
- `type-design-analyzer`
- `typescript-reviewer`
- `vue-reviewer`
