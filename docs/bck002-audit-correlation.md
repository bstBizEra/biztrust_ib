# BCK-002 — Request-to-audit correlation

**Date:** 1 October 2026. **State:** locally implemented, verified and independently AI-reviewed; integration/owner acceptance open.

## Bounded assignment

Parent BIZTRUST-BE-GOAL-001 BE-O12/O16/O19/O20 requires request/correlation evidence for material backend operations. Inspection found that `server/app.ts` creates an `X-Request-Id`, while the shared `audit()` writer records no request ID. Existing audit callers cover quotes, applications, invoices, payment processing and insurer simulation. This slice carries the existing server-generated ID into those audit entries without changing actor, tenant, authorization, retention or business transitions.

- Repository: BizTrust_IB (`bstBizEra/biztrust_ib`). Checkout: C:/Users/ounkh/.codex/worktrees/bck002-audit-correlation/biztrust_ib.
- Branch: codex/feature/bck002-audit-correlation. Base: local main 8c5b5451f69eb89aa8e64038be6519011a6ecb9e, remote freshness unverified. Independent of unpublished BCK-001 f2cad868; preserve that candidate and original dirty checkout.
- Primary skill: ECC 2.2.2 backend-patterns; Agent Skills test-driven-development for red/green, repository Git workflow and separate AP-01/AP-02 review. Retain configured model.
- Owned files: server/app.ts, server/db.ts, minimal server/request-context.ts, tests/integration.test.ts; package/operations/plan/board evidence. No new dependency or database migration.
- Risk: medium, audit correctness across concurrent asynchronous work. Use Node AsyncLocalStorage scoped to middleware; store only the generated UUID. No client header, URL/query, token, cookie, payload or personal field is captured. Existing detail fields and append-only/RLS policies remain.
- Phase/milestones: repository P2/P3/P5, BT-06 governed workflow traceability, BT-07 payment evidence and BT-14 assurance; G2/G4 owner acceptance remains separate. Parent phase names do not replace repository phases.
- Verification: approved disposable PostgreSQL 25432 with generated test-only credentials and empty dotenv; preserve all existing local databases/provider settings. No external setup, credential expansion, background worker, publication, merge or production activation.
- Stop: candidate/permission drift, two failed repairs per issue or 20-minute unit; preserve a checkpoint. Pending integration/owner acceptance does not block independent local engineering.

## Acceptance

| ID  | Type / target                                                                                                    | Verification                                                                                |
| --- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| C1  | Must-pass: material HTTP audit entries carry that response's server-generated request ID                         | Concurrent HTTP quotes and persisted audit reads                                            |
| C2  | Must-pass: request contexts never mix across tenants or accept caller-chosen IDs                                 | Concurrent distinct sessions, forged X-Request-Id header, scoped audit reads                |
| C3  | Must-pass: one application transaction's audit entries and a signed payment callback retain their respective IDs | Submission and callback HTTP assertions; idempotent replay produces no extra business audit |
| C4  | Must-pass: no HTTP context is invented for direct domain work; sensitive fields are not captured                 | Direct service call after HTTP requests; strict audit detail keys                           |
| C5  | Must-pass: unchanged authorization/state/production barriers and regression behavior                             | Existing isolated full verifier and independent security/code review                        |

Request IDs identify execution attempts, not identity or business idempotency. Replay responses may have a new request ID while original audit entries retain the original operation ID. Historical records remain unchanged; direct non-HTTP operations have no request ID until a separately scoped worker/service design defines their correlation. No production observability KPI or owner acceptance is inferred.

## Evidence and checkpoint

The two added integration tests first failed because audit details lacked requestId (RED), then passed with the shared writer/middleware change (GREEN). Eight concurrent requests across two tenants returned unique UUIDs matching only their persisted audit; injected client IDs were ignored. Submission writes and signed payment callback evidence each retained their own request ID. Replays left original audit entries unchanged. A later direct domain call omitted requestId and audit details excluded extra sensitive fields.

At **2026-10-01T13:23:59Z**, isolated `npm run verify` passed **55/55 tests, 34 automated accessibility checks, eight browser journeys**, board freshness, lint, typecheck, build, startup (three routes and browser reload) and production dependency audit with zero vulnerabilities. The full verifier took 82.39 seconds. This branch is based on main and does not include BCK-001; its 55-test result is not a combined-branch verification. No executable source changed after verification.

The approved disposable PostgreSQL 17.10 cluster on 127.0.0.1:25432 used fresh generated test credentials and migrations 001/002, with dotenv redirected to an empty file. The runner confirmed unchanged source, owned cluster stopped and PID file absent. No existing credential, shared database, provider or production service was used. Receipts remain local under `output/bck002-verification/summary-red.json`, `summary-focused.json`, `summary-full.json` and runner `run.ps1`. Full summary SHA-256: `04C0CBA30A8E0CAFCCD2450358DBCC8B0E2947801EDA45BAA4D016F37D3CB04F`; `output/playwright/results.json`: `3E2D9322C6399BCE62C0D70095C8AAEA6959FADB04FE9EC401A14130EF56E161`.

AP-01 `bck002_security_review` used ECC security-review; AP-02 `bck002_code_review` used Agent Skills code-review-and-quality. Both performed independent read-only source review and found no actionable findings. Their candidate hashes agree with the executed source:

| File                      | SHA-256                                                          |
| ------------------------- | ---------------------------------------------------------------- |
| server/app.ts             | B2D363701F857FC6BB6DA23F04EF61D53C5BB5A0DE3284BD0E374FD316D1B8EA |
| server/db.ts              | 4B420998FCA953F350DCB821D71C0B01285EE77298FDE95F29B6968460962E8A |
| server/request-context.ts | 9695F06FF90162D560861EF0DBA9C52D79D2F7FF0C326DEECFCE3EC573D96CB0 |
| tests/integration.test.ts | 736260F8EF9C53C05404638FA8CB56FF66E052E78F728FD82A16B322BD200727 |

C1–C5 have local engineering evidence. UI behavior is unchanged; no new user/design acceptance is claimed. Production load, provider integration, live identity, retention acceptance, operational KPI targets, hosted CI/review and G00/G1–G6 remain unverified or owner-pending. Request IDs do not establish actor authority; background-worker correlation and full provider/transaction tracing remain future bounded packages.

Next: package this exact local candidate and reconcile through a separately authorized PR. BCK-001 remains clean at f2cad868 on its separate branch; do not rewrite it or reuse its pending publication permission for BCK-002. Preserve both branches when integrating the small shared app.ts edits. No push, merge, release, deployment, Pages update or schedule restart occurred. Parent goal remains active and incomplete.

Use applicable existing skills first. Check their availability, read the selected SKILL.md, and choose one primary workflow with only the specialists needed for the task. Follow repository rules and the task's authorization.
