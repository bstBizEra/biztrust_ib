# BCK-001 — Payment exception drill-down

**Date:** 1 October 2026. **State:** locally implemented and reviewed; synthetic engineering scope only. Integration and parent goal remain open.

The user supplied BIZTRUST-BE-GOAL-001 in attachment f6924625-af3e-45fc-90c2-88139b65c6c4 explicitly directs this first bounded implementation. It supplies the payment-exception journey and requirements for predicate equivalence, same-snapshot count/list, deterministic ordering, truthful truncation, tenant/role denial, minimized data and no action/coverage authority. Earlier BCK-000-C1 is design context, not production acceptance. Live metric targets, product/wording, identity, recovery and release-owner decisions remain pending.

## Execution contract

- Repository: BizTrust_IB, bstBizEra/biztrust_ib; no broader BizTrust changes.
- Checkout: C:/Users/ounkh/.codex/worktrees/bck001-payment-exceptions/biztrust_ib.
- Branch: codex/feature/bck001-payment-exceptions; local origin/main base 8c5b5451f69eb89aa8e64038be6519011a6ecb9e. Remote freshness is unverified; no publication.
- Primary skill: ECC 2.2.2 backend-patterns; api-design, Agent Skills test-driven-development, existing search-first/eval-harness methods and repository Git workflow.
- Owned implementation: server/operations.ts, server/app.ts, tests/operations.test.ts, src/OpsConsole.tsx, scripts/browser-smoke.mjs, scripts/generate-openapi.ts, tests/contract.test.ts and generated api/openapi.json; supporting package/operations/plan/board Markdown and generated board only for actual results. No database schema or dependency changes.
- Validation: reuse matching installed dependencies; approved disposable loopback PostgreSQL 25432 with generated test-only credentials through the existing isolated runner pattern, dotenv redirected to a new empty file. No existing .env/provider secrets/shared database.
- Stop: unexpected data/permission/base drift, failed safeguards or two repairs of the same failure. Checkpoint unfinished work; retain configured model. Parent backend goal remains open after this slice.

## Contract and acceptance

GET /ops/v1/payment-exceptions?limit=50 returns server-derived tenant, UTC database statement asOf, count, limit, truncated, minimized cases and synthetic true. A single statement reads applications joined to their unique invoice where payment status is failed or reconciliation_required. Count and rows use that same filtered relation/snapshot. Cases are ordered by created_at descending, then id descending; limit is an integer 1–100, default 50. This is bounded inspection, not full pagination. No match returns count 0 and cases []; truncated is count greater than returned rows. Database failure produces a safe error, never a fabricated zero.

Existing /ops/v1/cases continues returning its array. The overview uses the same internal exception predicate. Clicking Payment exceptions displays the new response's refreshed count and timestamp; a later request may differ from an earlier overview. Detail reuses the existing tenant-scoped case evidence and allowedActions remains empty. No new privacy/retention or stale-after target is inferred.

| Criterion                     | Verification                                                                                                                      |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| C1 predicate and record grain | Both failure states included, other states excluded; existing overview count agrees on a quiescent fixture.                       |
| C2 snapshot and bounds        | One statement produces total and ordered prefix; empty, ties, more than 100 records, truncation and safe limit validation tested. |
| C3 authorization/isolation    | Missing/customer role denied, server-derived tenant, reciprocal tenant counts/lists/detail protected.                             |
| C4 minimization and state     | Existing field allowlist, independent insurer/payment statuses, synthetic markers, no business writes or allowed actions.         |
| C5 journey                    | Real browser click metric → exact population → case detail; loading/failure/empty and accessibility checked where changed.        |
| C6 regression                 | Focused red/green, typecheck, lint, formatting, isolated full verify; failures and unrun checks recorded separately.              |

The parent document's P0–P7 labels are proposed backend phases, not replacements for the repository's existing phase IDs. This slice extends current staff operations/BT-02 and payment exception visibility/BT-07 with BT-14 controls. G00/G1–G6 remain separate owner gates.

## Evidence

The standalone receipts below remain historical. The [BCK-002 S3 integration checkpoint](bck002-audit-correlation.md) records subsequent full verification of BCK-001's final UI hashes together with BCK-002 request/state audit changes: 59 tests, 39 accessibility checks and nine journeys. Source branch `f2cad868` remains unchanged; the combined candidate is on `codex/integration/backend-core`. Hosted and owner acceptance remain separate.

### Executed checks

- RED: `node --import tsx --test --test-name-pattern="payment exception" tests/operations.test.ts` failed both new tests on the absent route (404). Focused GREEN passed both after implementation.
- Full isolated `npm run verify` passed at **2026-10-01T13:03:52Z**: **55/55 tests**, **39 accessibility checks**, **nine browser journeys**, lint, typecheck, build, startup (three routes and browser reload), board freshness and production dependency audit (zero vulnerabilities). Startup reload is not source-watcher verification.
- AP-02 identified misleading empty-list instructions. The only subsequent executable changes are the corrected static empty description in `src/OpsConsole.tsx` and its assertion in `scripts/browser-smoke.mjs`.
- Final affected checks at **2026-10-01T13:05:43Z** passed `npm run lint`, `npm run build` (includes typecheck), and `npm run test:e2e`: **39 accessibility checks**, **nine journeys**, no page or asset errors. Full verify was not repeated after this UI-only correction; backend/contracts/dependencies retained their passing hashes.
- Each database run initialized a disposable task-owned PostgreSQL 17.10 cluster on 127.0.0.1:25432, applied migrations 001/002 with generated test credentials and then stopped it. Summaries confirm source stability, cluster stopped and PID file absent. Existing local/shared databases and provider credentials were not used.
- A first full invocation with PowerShell whole-script output redirection stalled after cluster startup, before application checks; the owned cluster was verified and stopped. Running directly corrected the harness invocation. A first UI dispatch accidentally reran the two focused tests; its separate receipt supplies no browser proof. The corrected UI dispatch produced the final evidence above.

Local ignored receipts in this candidate's `output/bck001-verification/`: `summary-red.json`, `summary-focused.json`, `summary-full-startup-stall.json`, `summary-full.json`, `summary-ui-misdispatch.json`, `summary-ui.json` and runner `run.ps1`. Full summary SHA-256: `6CA14E1DBABA5745D4D4AEF85127053867B6E7F940303A7F7020EA11B28A46D0`; final UI summary: `2684B939D0AD6CF0CBA6680AE683FC20D300A90246AB93A39079900097BF522A`. Final browser report `output/playwright/results.json`: `1969B16FD2A9C1EC110D69D03A27C8C9F324B707875AF9247EB78FC67E86078D`. These are local evidence, not portable published artifacts.

### Independent AI review and exact executable candidate

AP-01 `bck001_security_review` used `ecc:security-review`; AP-02 `bck001_code_review` used `agent-skills:code-review-and-quality`. Both inspected source without credentials or runtime writes. AP-02's empty-copy finding was corrected and re-reviewed; both final reports contain no actionable findings. Agent review does not establish hosted or accountable-owner approval.

| File                        | Final SHA-256                                                    |
| --------------------------- | ---------------------------------------------------------------- |
| server/operations.ts        | DE5B171ADCA5ED8F68772C153872DAC90A5EF53B1DB4392D6DD59B286FE7BE27 |
| server/app.ts               | D95000C77014515BACE96A9C2F918492445320F88FD3365ADFEFF82DD57D9FDD |
| src/OpsConsole.tsx          | A73EA9BC414F71C33B80EAED6FE07BD5909390AF44F2EFE31CAB56E0ECC45B2B |
| scripts/browser-smoke.mjs   | AEE5EE4BA6EA40FB4A714661DA68F81293434C98FD12DEA95D7B5452EAF88984 |
| scripts/generate-openapi.ts | 5B7DB65A0AF20EB634DD6F0C71DE2967D20C2D4F3D42E963A50F9850F86EEC2B |
| api/openapi.json            | 96C470A7DDE6CDBBE520898DA12B19D7EFBD386459E943899CC8710FB65B4DA2 |
| tests/operations.test.ts    | 7757BFC803D001BE331F96D277D8713753B40724EEC91722015CEACDDAB8E436 |
| tests/contract.test.ts      | 53D9A5AF6CB64DC7813C9BB7CBB1FDA7A701A235FD090129B998036C794FA729 |

C1–C6 have local engineering evidence. Snapshot atomicity uses one SQL statement plus fixture assertions; no controlled concurrent-write stress test or production load test ran. Browser error/empty states are explicitly intercepted fixtures; successful metric/list/detail uses the actual API. Manual assistive-technology/user acceptance and operational freshness targets remain open.

AP-01 noted that internal response-schema validation currently uses the existing Zod error handler (HTTP 400). It remains a safe error, not a fabricated zero; distinguishing internal projection corruption from client input is a follow-up reliability consideration, not a claimed tested failure mode.

### Design evidence trace and handoff

Requirement: parent BE-O7/O10/O14/O19/O20 → evidence: existing operations predicate, RLS and read-only case detail → journey: metric/list/detail → decision: one bounded read projection, no new queue table or cursor → component: existing Metric/CaseTable/detail → code: hashes above → tests: two added database tests plus contract/browser checks → browser evidence: final report above → production metric: unrun/unapproved. User research and manual visual acceptance were not supplied; automated accessibility is not conformance certification.

Next authorized engineering action: package/reconcile this local candidate and identify the next bounded parent-goal package against actual capability gaps. Main freshness, hosted CI/review, publication and integration are unverified. No push, merge, release, deployment, Pages publication or schedule restart occurred. Product/wording, identity, recovery and release-owner decisions remain separate blockers to dependent activation. The complete backend parent goal is **not complete**.
