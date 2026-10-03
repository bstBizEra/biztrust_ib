# BCK-002 — Request correlation and state-transition audit

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

### S2 — Transactional state-transition evidence (locally verified)

The parent BE-O12 also requires previous/resulting state. Source inspection after S1 found that payment and insurer audits omit these fields, and payment settlement updates the application's insurer status to queued without its own audit. This extension reuses the same audit package/branch after local S1 commit `23809b06ec0addbe8fb29c26363379a24267aca7`; BCK-001 remains untouched. Owned executable paths for S2 are `server/services.ts` and `tests/integration.test.ts`; existing audit correlation source is preserved. No new transition, role, action, provider or database schema is introduced.

Additional must-pass C6: audit actual persisted invoice and insurer previous/resulting states, including settlement's automatic awaiting_payment → queued change, in the same transaction as the state writes. Explicit same-state events must say so, repeated event IDs/insurer outcomes must not create duplicate audits, rejected transitions must leave evidence unchanged, and failed audit writes must roll back the related transition. Validate synthetic failure → settlement → insurer processing → issued plus replay/denial and rollback; preserve C1–C5. Historical audit rows are not rewritten. This is local audit completeness, not proof of accepted real provider identity or regulated audit retention.

S2 changed only `server/services.ts` and `tests/integration.test.ts` executable content. It extends the existing audit writer and transaction rather than adding a schema, library or parallel audit system. The two added tests first failed on missing state fields/queued audit, then passed. They exercise failed → settled payment, explicit settled → settled outcomes, queued → processing → synthetic issued insurer progression, duplicate/conflicting provider IDs, rejected/final insurer transitions, amount mismatch and late-payment review. Previous state uses persisted `pending` even when the read projection displays `expired`.

Audit-write failures were injected separately at `insurer.queued`, `payment.settled` and `insurer.issued`. All other queries ran against real isolated PostgreSQL. Complete before/after application, invoice, history, provider-event and outbox snapshots matched after rollback; retry succeeded once. No fixture permissions or production schema were changed.

At **2026-10-01T13:37:56Z**, `npm run verify` passed **57/57 tests, 34 automated accessibility checks and eight browser journeys**, plus board freshness, lint, types, build, startup and dependency audit (zero vulnerabilities), in 60.53 seconds. C1–C6 have local engineering evidence on S1 commit `23809b06ec0addbe8fb29c26363379a24267aca7` plus the S2 executable pins below. This candidate still excludes BCK-001. The separate AP-01 security and AP-02 code agents re-reviewed these exact files with no actionable findings; neither report is a hosted or owner approval.

| File                      | SHA-256                                                          |
| ------------------------- | ---------------------------------------------------------------- |
| server/services.ts        | 3A199BE7D9E65C48800BB0DBD50DEB6CDB2DC303635A01D65C3AAABA8469EBFA |
| tests/integration.test.ts | 46DB2D81D3FF8CBE996A3DB26365837C15B8A13A408B7402B8FD22A9178C128D |

S1 `server/app.ts`, `server/db.ts` and `server/request-context.ts` pins below remain unchanged. S2 receipts and the reviewed-runner adaptation are local under `output/bck002-s2-verification/` (`summary-red.json`, `summary-focused.json`, `summary-full.json`, `run.ps1`). Full receipt SHA-256: `6ABB86AC495AE57CF00A5D41ADBECB7146EF6B4BDCD78DB4BE4C5CEF4101B297`. Browser result SHA-256: `3E2D9322C6399BCE62C0D70095C8AAEA6959FADB04FE9EC401A14130EF56E161`. The approved disposable PostgreSQL 25432 cluster used generated test credentials and empty dotenv; source stayed stable, the owned cluster stopped and its PID file was absent.

Skill application: `ecc:search-first` found the existing audit writer, transaction and test runner sufficient, so no external package search/adoption was needed. `ecc:eval-harness` supplied predeclared capability/regression criteria; its disabled candidate executor was not used or bypassed. Checks ran through the existing authorized repository verifier. This single candidate run does not establish repeated-run reliability or owner acceptance.

### S1 — Request correlation (historical local baseline)

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

## S3 — Combined local operations and audit candidate (locally verified)

Outcome: demonstrate the BCK-001 payment-exception drill-down and BCK-002 audit foundation together on one local candidate. This extends the existing package integration checkpoint; neither source branch is rewritten. Checkout C:/Users/ounkh/.codex/worktrees/backend-core-integration/biztrust_ib, branch codex/integration/backend-core, starting at BCK-002 2cfd1936b95054b6a1a37bf27acd5ad7dcbecf11. Apply only the exact BCK-001 f2cad868685fb71c0930057f2dc1fd4895610b21 delta from shared local base 8c5b5451f69eb89aa8e64038be6519011a6ecb9e; remote freshness remains unverified.

Primary workflow: ecc:git-workflow, complementary existing repository verification and separate AP-01/AP-02 integration reviews. Medium risk: combining route/middleware and documentation changes. Reuse both implementations without new features, dependencies, roles, schema or metrics. ADF owns patch integration, this package and executable conflict resolutions; Progress Board owns plan/history/generated-board reconciliation. Read current source before resolving; preserve evidence from both sides. No concurrent writes to shared files. Configured model unchanged.

Acceptance C7 (must-pass): exact BCK-001 source preserved except mechanically combined app.ts; BCK-002 request context/audit/state tests retained; generated contracts and board current; complete isolated npm run verify includes both packages and their browser journey; independent AP-01/AP-02 assess the integrated executable candidate. Verify source digests, commands and results against the final candidate. Historical separate results are not a combined pass. Product/operations acceptance and G00/G1–G6 remain owner decisions.

**Observed result — 2026-10-01T13:50:33Z:** combined `npm run verify` passed **59/59 tests, 39 automated accessibility checks and nine browser journeys**, board freshness, lint, types, build, startup and production dependency audit (zero vulnerabilities). The verifier took 60.36 seconds. The run includes BCK-001's final empty-state copy/assertion and BCK-002 S1/S2, proving C7 locally. No application repair was needed. Documentation conflicts in the plan and update log were resolved by preserving both histories; generated HTML was rebuilt from source.

All eleven package-owned executable Git blobs match their originating commits. The twelfth file, `server/app.ts`, mechanically combines the existing request-context middleware with the exception import/route; its SHA-256 is `DB9C9C26C881BBA1FAB061EC1C2A5B0CBF18DE7774DDB0CDD4C9044BD78B0A1A`, Git blob `f69e821313fac84fc2e6d0e6dce9816d0a1fad3e`. Remaining executable SHA-256 pins are unchanged from the BCK-001 and S2 tables above. Independent AP-01 `bck002_security_review` and AP-02 `bck002_code_review` checked all 12 pins and the integrated behavior with no actionable findings. These are AI engineering reviews only.

Local receipts: `output/backend-core-verification/summary-full.json` SHA-256 `844D98B3E97554889E5C35F1FA7AB2B04E83A6336301983C3AD28FD17612C7D4`; `executable-pins.json` SHA-256 `9D42C008614F1AAB1877C9E353A343FC6526BB1E694D27B30A62581D08AE11BE`; `output/playwright/results.json` SHA-256 `1969B16FD2A9C1EC110D69D03A27C8C9F324B707875AF9247EB78FC67E86078D`. The verifier confirms stable source, isolated cluster stopped and PID file absent. Both original source branches remain unchanged. Local combined proof does not establish current hosted main, CI, qualifying review, owner acceptance or production readiness.

Next: package this reviewed combined candidate for separately authorized publication, preserving source provenance and pending owner decisions. The previous BCK-001-only publication request does not authorize publishing this expanded candidate. The full parent goal remains incomplete: live identity/provider/insurance authority, governed staff commands, worker/notification capabilities, recovery and release acceptance still need their applicable packages and decisions.

Use only approved disposable PostgreSQL 25432, generated test credentials and empty dotenv; stop task-owned services after checks. No existing .env, credentials, shared DB, provider writes, publication, hosted merge, deployment, Pages or recurring schedule change. Stop drift, material scope change, 20-minute unit or two failed repairs per issue; checkpoint the exact state. Return changed files, actual verification, unresolved criteria and next action. Parent goal remains active and incomplete.

Use applicable existing skills first. Check their availability, read the selected SKILL.md, and choose one primary workflow with only the specialists needed for the task. Follow repository rules and the task's authorization.
