# BCK-004 — Insurer timeout drill-down

**Date:** 1 October 2026. **State:** S1 API and S2 metric/list/detail journey locally verified and independently AI-reviewed; hosted and owner acceptance pending.

Parent BIZTRUST-BE-GOAL-001 BE-O10/O14/O19/O20 requires operations metrics to open their exact population. The existing overview counts applications with insurer_status=timeout but has no matching bounded count/list response. Reuse BCK-001's single-statement read projection and existing case evidence; add no retry command, role, provider or business authority.

## Execution contract

- BizTrust_IB only; checkout C:/Users/ounkh/.codex/worktrees/bck004-insurer-timeouts/biztrust_ib; branch codex/feature/bck004-insurer-timeouts; local dependent base 7b5b3cfd2f6c85447da4a75b059a8b5ef5f43833. Preserve BCK-001/002/003 candidates and original dirty application checkout. Remote freshness unverified.
- Primary ECC backend-patterns; complementary Agent Skills test-driven-development, existing ECC search-first/eval-harness methods and AP-01/AP-02 reviews. Reuse installed dependencies, exact existing timeout predicate and projection pattern. No external search/adoption is needed; preserve model.
- ADF owns server/operations.ts, server/app.ts, scripts/generate-openapi.ts, generated api/openapi.json, tests/operations.test.ts, tests/contract.test.ts and this package/operations notes. Subsequent S2 owns existing src/OpsConsole.tsx and scripts/browser-smoke.mjs for the metric/list/detail journey. Board owner owns plan/progress/history/generated board. No concurrent writers.
- S1: GET /ops/v1/insurer-timeouts?limit=50 returns tenant, database statement UTC asOf, count, limit, truncated, minimized cases, synthetic:true. Predicate is precisely a.insurer_status='timeout'; count/list share one statement snapshot. Order created_at DESC,id DESC; limit integer 1–100 default50; unknown query keys rejected. No match gives zero/empty; failure is an error, never zero. Payment state remains independent and timeout grants no coverage.
- C1 must-pass: overview predicate equivalence, same-statement count/list, stable tie ordering, empty/bounded/truncated results and strict input validation.
- C2 must-pass: staff-only/server tenant, customer and anonymous denial, reciprocal tenant/detail isolation, minimized response and no application/payment/audit mutation.
- C3 must-pass: current OpenAPI and focused regression checks, full isolated verification, exact executable pins and independent AI reviews. Only existing authorized disposable PostgreSQL25432 with generated credentials and empty dotenv; no local15432/shared/provider credentials or production.
- C4 remains pending until S2: browser metric→matching list→Case360, truthful refreshed count/asOf, focus/loading/failure/empty/mobile/accessibility checks, then full verification and review on final source. S1 alone does not complete the journey or parent goal.
- Repository P3 staff operations/BT-02 and BT-08 exception visibility, BT-14 assurance; owner/provider/release/G00/G1–G6 remain separate. Parent phase labels do not replace repository phases.
- One bounded unit,20minutes,two repairs per failure. Stop for authorization/candidate drift. No publication, App review, merge, deploy, Pages or scheduling. Return executed evidence, unrun criteria and next action.

## Evidence

### S2 execution contract

Continue from S1 commit `bdcbedae12cc4e9800eff375e6174b10c9aa20b3` in the same branch. ADF owns only `src/OpsConsole.tsx`, `scripts/browser-smoke.mjs`, this package and the operations note; the Board owner retains progression files. Primary skill: Agent Skills frontend-ui-engineering; complementary ECC browser-qa and existing test-driven-development. Reuse the payment metric/table/detail and request lifecycle, with a selected exception kind; keep payment navigation and all routes/permissions unchanged. No visual redesign or new dependencies.

C4 must-pass evidence: keyboard activation of Insurer timeouts opens its refreshed same-snapshot count/list and timestamp; focus moves to the list heading; row/detail matches the API; insurer/payment remain independent; mocked loading, failure and empty states do not present stale rows or false success. Verify payment regression, responsive widths 1440/390/320, automated accessibility and the full isolated verifier. Record screenshots as local synthetic evidence, not visual-owner or production acceptance. No production metrics or manual screen-reader acceptance are available. Same 20-minute/two-repair boundaries and credential/network restrictions apply. First establish missing-button red evidence, then implement, verify and obtain independent exact-source AI reviews.

### S2 completed local checkpoint

S1 commit bdcbedae12cc4e9800eff375e6174b10c9aa20b3 plus the two source hashes below passed full isolated npm run verify at **2026-10-01T14:34:21Z** (67.83 seconds): lint, typecheck, full tests, build, startup, **44 automated accessibility checks, ten browser journeys**, and production dependency audit with zero vulnerabilities. Migration/replay exited0, source remained stable and the owned PostgreSQL25432 cluster stopped with PID file absent. S1 backend/contract hashes remain unchanged.

The real browser journey activated Insurer timeouts by keyboard, verified heading focus, exact response count/rows and rendered asOf, opened matching case evidence, and preserved independent timeout/settled states. The payment drill-down ran the same regression assertions. A held real response verified loading clears prior rows/count; separately mocked failed/empty responses verified no stale list or fabricated zero on error, truthful zero on an empty snapshot and successful recovery. At1440/390/320 widths, overflow/accessibility assertions passed. Desktop and320px timeout screenshots were inspected: existing branding, synthetic notice, count, independent states and snapshot footer are visible; narrow tables retain existing horizontal scrolling.

Initial test attempt used the wrong loading label; this fixture was corrected to the actual case-queue label. The subsequent red run failed specifically on the absent timeout inspection control (0 versus1). The UI implementation then passed the full verifier without application repair. Historical red/fixture receipts remain in output/bck004-s2-verification; neither is represented as a passing run.

| File                      | SHA-256                                                          |
| ------------------------- | ---------------------------------------------------------------- |
| src/OpsConsole.tsx        | EB676F5B24C9DEE7C657618B3FDAE6362D316ADCDC0E3D83FFA3A5BCB74A0D72 |
| scripts/browser-smoke.mjs | A4D4F085BF3260B4BB2D221FC88F79CCFD538091424EFAF1319585300A481DF7 |

Local full receipt output/bck004-s2-verification/summary-full.json SHA-256 ADDAFE4F301E4CD2C7A990CB8EC90331376FCEDDB74654392C3A368E6396346E. Two-file manifest SHA-256121B2BE57D2978323AE2B623825B1F4393096A7412EFA710445A6282705FC0BA. Browser report output/playwright/results.json SHA-256 DF7160BBD4043C021324065F2C696C69389248657DF7AB11E6CA17649BD7D357. Screenshot evidence: output/playwright/operations-insurer-timeouts.png and operations-insurer-timeouts-390.png/-320.png (synthetic local only).

Independent AI AP-01 bck002_security_review and AP-02 bck002_code_review reviewed these exact source hashes with **no actionable findings**. Both were read-only reviews; execution was by the isolated runner. C1–C4 now have local engineering evidence, not production or hosted acceptance. Manual screen-reader testing, Lao translation of the existing English-only staff console, user acceptance, visual baseline comparison and production analytics remain unrun; no automated WCAG-conformance claim is made.

**Design evidence trace:** BE-O10 exact metric population → existing timeout predicate and S1 contract/tests → metric/list/Case360 journey → reuse the payment projection UI with explicit exception kind → Metric, useResource, CaseTable and CaseDialog → OpsConsole source above → backend negative tests and parameterized browser assertions → local44/10 report and screenshots → production metric unrun/unapproved. This package carries the trace; the original control-plane Design Evidence Ledger links to it.

**Next:** package the completed local journey and reconcile this dependent branch after its prerequisites integrate, under separate publication/hosted-review authority. Preserve all original dirty application work and the existing pending combined-publication question. Parent BE-O10 and the full backend goal remain incomplete: other operational populations/actions and external business/provider/identity/recovery/release decisions remain outstanding. No push, merge, App review, deployment, Pages or schedule restart occurred.

### S1 API checkpoint (historical)

At 2026-10-01T14:22:34Z, the approved isolated runner completed npm run verify with exit 0 (67.92 seconds). Lint, types, full domain/integration/contract tests including both new timeout projection tests, build, startup, 39 accessibility checks, nine existing browser journeys and dependency audit passed; audit reported zero vulnerabilities. The two existing payment-projection tests were parameterized with the same assertions and retained. The new timeout journey is not among the nine browser journeys.

- Initial targeted command: node --import tsx --test --test-name-pattern="insurer timeout" tests/operations.test.ts. Expected red: two route404 failures reproduced the missing endpoint.
- First focused implementation run failed because the shared query still used the payment predicate; fixed to the internal selected predicate. Next run exposed a missing default time parameter; typecheck located it and the correction passed typecheck and both focused tests. No assertions were weakened.
- First full run: 64/66 tests passed; two later tests hit429 after the added tests exhausted the existing per-app demo-login limiter. Corrected fixture lifecycle to beforeEach/afterEach server isolation, shared pool closed only after the suite. Production limits unchanged. The subsequent full verifier passed on stable source.
- npm run db:migrate and its replay both exited0; no new database schema in S1. Only task-owned disposable PostgreSQL17.10 at127.0.0.1:25432, generated credentials and empty dotenv were used. Cluster stopped, PID file absent, source hashes stable.
- AP-01 bck002_security_review and AP-02 bck002_code_review independently reviewed the exact source. AP-02 identified the shared test rate-limit issue; its final delta review closed the finding. Both report no remaining actionable findings. These are AI engineering reviews, not hosted or accountable-owner acceptance.

Exact candidate is base7b5b3cfd2f6c85447da4a75b059a8b5ef5f43833 plus these SHA-256 pins:

| File                        | SHA-256                                                          |
| --------------------------- | ---------------------------------------------------------------- |
| server/operations.ts        | C382CB83351DAE36D659264561DEE9B21CBB0ED5C0FCD2A28D15B458C2B352C1 |
| server/app.ts               | 748344FDCCDB636AD963C25C17E41367A2AD232E7FF22901593036F6F645AA72 |
| scripts/generate-openapi.ts | 933D1546ABAB744EA12093ED19F31792BFF7955526FC34DD076BF733725ED90B |
| api/openapi.json            | 1F84D0F43BC2B8FF68BB99DEED5DDC9A190B382FEF66945B1E63C35E7FE8069D |
| tests/operations.test.ts    | C800379B9FFEE054F5C0AF2023BB5090D6BDF0B7C87703FF83EE37BD191BA381 |
| tests/contract.test.ts      | 12490021833810184F175ABD923FC24DC01965A55FAE3873C530C89C9C92F913 |

Ignored local receipt output/bck004-verification/summary-full.json SHA-256 E4314CFDB272F03218D26847A1256B5259E762C9BFF7883C4ED02B171F791270; six-source executable-pins.json SHA-256 F79E5DF895B4ADBBAB230E0E027A9EFD1D8000DBEB15AB327FDE9EF9793CAF48. Earlier failed focused/full receipts are retained with numbered filenames. After the full run, targeted Prettier identified generated OpenAPI formatting. One formatting repair changed only whitespace: parsed JSON deep-equality passed against the tested copy, and node --import tsx --test tests/contract.test.ts passed (one test). The full-run OpenAPI hash was 0744F863E1AD3C174693DB0A6DB77C81DEC9421B5AAB616D0456E665B95402CC; the table/manifest above pin the formatted equivalent. Other executable hashes remain unchanged. C1–C3 have local evidence; S2/C4 remains unimplemented and unverified.

Next authorized local unit: connect the existing Insurer timeouts metric to this exact response, reuse the CaseTable/detail and resource-state handling, prove focus/count/asOf/failure/empty/mobile/accessibility in the browser, then rerun affected/full checks and independent review. Preserve current payment drill-down. Parent goal and hosted integration/owner gates remain open. No publication, merge, provider action, deployment, Pages or schedule change occurred.

Lesson supported by the failed and passing full runs: isolated HTTP tests need isolated app-local rate-limit state; expanding the suite must not relax production limits. Search-first reused the two-consumer projection and existing schema/contract generator; no dependency was added. Eval-harness supplied criterion/evidence discipline only; its disabled candidate executor was not used or bypassed.

Use applicable existing skills first. Check their availability, read the selected SKILL.md, and choose one primary workflow with only the specialists needed for the task. Follow repository rules and the task's authorization.

## S3 — Reconciliation after PR 24 integration

**3 October 2026 · local only.** Prerequisite PR #24 is integrated at `f3f8900f0a6a897e45a515d1feae193ad851e9df`, sole parent dbb0f719de92b78bbda73d9f77ed1b9d97f35abb, tree677ccd504d7154b2247c4d1d435bfa0cfdeba438. Its [required main CI run37120043127/job111194222956](https://github.com/bstBizEra/biztrust_ib/actions/runs/37120043127/job/111194222956) succeeded. User authorized this merge/main CI and dependent BCK-004 local reconciliation; BCK-004 publication, App review and merge are separate.

Checkout C:/Users/ounkh/.codex/worktrees/bck004-main-reconciliation/biztrust_ib, branch codex/feature/bck004-main-reconciliation, base f3f8900f0a6a897e45a515d1feae193ad851e9df. The original BCK-004 checkout is absent; the two source commits bdcbedae12cc4e9800eff375e6174b10c9aa20b3 and 1f1ee69943ddfdff6fad71bb4f4c3f01e349e370 remain reachable. Reuse those exact commits rather than reimplement the feature. Primary ecc:git-workflow, existing branch/commit helpers and independent AP-01/AP-02 reconciliation review. Root owns this isolated candidate; Board owns the original/cumulative handoff. No overlapping writes. P3, BT-02/08/14 and G5 integration preparation; C1–C4 and external owner boundaries remain unchanged. Limit20minutes/two repairs per failure.

Applied the aggregate Git patch from original base7b5b3cf through1f1ee69 with `git apply --3way`. All executable files applied cleanly; the sole conflict was an append in docs/progress-updates.md. Both historical entries were kept, with a new dated summary. Regenerate progress.html from reconciled Markdown. Eight API/server/UI/test/browser files and every other non-documentation blob match1f1ee69; the recorded LF source hashes match. No executable or dependency adjustment is needed.

The 1 October S1/S2 isolated verification,44accessibility checks,ten journeys and source reviews remain historical evidence for unchanged executable content. Original ignored runner, receipts and screenshots are absent in this new checkout; their recorded hashes are provenance, not freshly inspected artifacts. No local full application suite, database, migration or browser checks ran in this reconciliation. Current BCK-004 hosted verification is unrun; separately authorized publication must obtain checks on its exact candidate. Documentation formatting, board freshness, staged diff and source-equivalence checks are the applicable local checks for this reconciliation. Independent reviewers must bind their findings to the final candidate.

Next action: prepare the exact local commit/draft, then obtain scoped BCK-004 push, draft PR and CI readback authorization. Manual screen-reader, Lao staff translation, visual-owner/user acceptance, insurer/product/wording/identity, recovery/release and production evidence remain unrun or pending as previously recorded. No live insurer action or coverage is introduced. Schedule PAUSED; no deployment, Pages update or branch deletion.
