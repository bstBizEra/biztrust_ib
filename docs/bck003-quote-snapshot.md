# BCK-003 — Preserve quoted product snapshots

**Date:** 1 October 2026. **State:** locally verified and independently AI-reviewed; hosted integration pending.

## Assignment and criteria

Parent BIZTRUST-BE-GOAL-001 BE-O3/O4/O12/O20 requires version-bound transactions. Inspection of createApplication found that it recalculates the product snapshot from today's catalogue while billing the saved quote total. Same-version catalogue edits can silently change terms/coverage. Preserve the quoted product/configuration snapshot in PostgreSQL and use it for submission; retain the current published/version/rule/effective-date restrictions. Historical submitted applications remain unchanged. Legacy quotes lacking a snapshot must request a new quote rather than fabricate old terms.

- Repository BizTrust_IB; checkout C:/Users/ounkh/.codex/worktrees/bck003-quote-snapshot/biztrust_ib; branch codex/fix/bck003-quote-snapshot; base bc46877b6d2bd4361e15eb1d92e25211e361c9d0. Dependent on locally verified BCK-001+BCK-002; remote freshness and publication unverified. Preserve the combined publication candidate and original dirty checkout.
- Primary ECC backend-patterns; complementary Agent Skills test-driven-development, existing PostgreSQL migration procedure, independent AP-01/AP-02. No new dependency or provider. Preserve model. Search-first: reuse existing jsonb snapshots, insert-only quote permissions, transaction and migration runner.
- Owned application files: server/services.ts, additive server/migrations/003-quote-snapshot.sql, tests/quote-snapshot.test.ts. ADF owns this package/operations note; board owner owns milestone/plan/history/generated HTML. No concurrent writers.
- Repository P2/P3; product/rating governance BT-04/BT-12 and assurance BT-14; G1/G2 and insurer/wording approvals remain separate. Medium risk: historical integrity and upgrade compatibility.
- C1 must-pass: quoted product, selected coverage/addons and price remain identical through submission despite same-version catalogue changes; no re-rating.
- C2 must-pass: unavailable, version/rule changed and ineffective products still reject; expired quotes, ownership, idempotency and production rejection remain effective.
- C3 must-pass: additive migration preserves old rows, keeps runtime quote update/delete forbidden, and rejects mismatched non-null snapshot identities. Legacy quotes without snapshots reject safely before writes; existing application replay still works.
- C4 must-pass: focused red/green tests and full isolated verifier plus independent security/code review bind to exact source; migration replay is idempotent through the runner. Original databases and source branches untouched.
- Only the approved disposable PostgreSQL 25432 with generated test credentials and empty dotenv may be migrated/tested. No existing .env/provider credentials, local15432/sharedDB, publication, deployment, hosted merge or schedule restart. Schema change is for this identified requirement, not arbitrary database access.
- Stop on permission/candidate drift, 20-minute unit or two repair attempts per failure. Return actual code/evidence, open criteria and next action. Local proof cannot close the parent backend goal or production gates.

## Evidence and checkpoint

### Executed evidence

The implementation saves the calculated product snapshot with each new quote and copies it into the application without recalculating. Invoice total remains the saved quote total. Migration `003` adds a nullable snapshot and an identity constraint; legacy rows are preserved without invented historical terms.

All execution used the approved disposable PostgreSQL 17.10 environment at `127.0.0.1:25432`, database `biztrust_bck003_test`, generated test credentials and empty dotenv. The ignored reviewed runner is `output/bck003-verification/run.ps1`.

| Check                                                                                                       | Observed result                                                                                                                                                                                                                  |
| ----------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `node --import tsx --test --test-name-pattern="quote snapshot" tests/quote-snapshot.test.ts` before the fix | Expected exit 1: snapshot drift and legacy submission reproduced; availability checks passed.                                                                                                                                    |
| Same focused command after the fix                                                                          | Exit 0; four focused tests passed before adding the upgrade test.                                                                                                                                                                |
| `npm run db:migrate`, then the same command again                                                           | Both exit 0; fresh migration and idempotent replay verified.                                                                                                                                                                     |
| `npm run verify`                                                                                            | Exit 0 at 2026-10-01T14:02:52Z; lint, types, full tests including five snapshot checks, build, startup, 39 accessibility checks, nine browser journeys and production dependency audit passed. Audit found zero vulnerabilities. |
| Source/environment cleanup                                                                                  | Executable hashes unchanged during verification; owned cluster stopped and PID file absent.                                                                                                                                      |

The fifth test executes the actual migration against session-local pre-upgrade tables and verifies that a populated legacy row is preserved with a null snapshot. Other tests cover same-version catalogue edits, invoice price, existing application replay, unavailable/version/rule/date restrictions, legacy rejection before writes, runtime quote update denial, tenant isolation and non-null snapshot identity constraints. Existing regression tests retain expiry, ownership and production boundaries. C1–C4 have local engineering evidence; no hosted or owner acceptance is inferred.

### Exact executable candidate and independent review

Base `bc46877b6d2bd4361e15eb1d92e25211e361c9d0` plus these SHA-256 pins defines the tested executable candidate; later changes are documentation only:

| File                                       | SHA-256                                                            |
| ------------------------------------------ | ------------------------------------------------------------------ |
| `server/services.ts`                       | `B6137DE09AE36A577ED574461501E18165AF95994BA4CD1BFD7208084D5596D2` |
| `server/migrations/003-quote-snapshot.sql` | `AEE4B845B2B451255850B88AC13F567818ACFD3C59892DCCD082B06C21675563` |
| `tests/quote-snapshot.test.ts`             | `76F998A5EEA33A1516D8653E18C7C35DDA16E7A16EEA4EA3B4D230191E9ADE8E` |

AP-01 (`bck002_security_review`, independent AI security reviewer) and AP-02 (`bck002_code_review`, independent AI code reviewer) checked these exact files and pins: no actionable findings. Both were read-only reviews; execution evidence comes from the runner. Re-review executable drift. AI reviews do not supply accountable owner or GitHub approval.

The local full receipt `output/bck003-verification/summary-full.json` has SHA-256 `45CF86F956612F8ECFEBAFC2F605C83E42AFB3C3262B8B9623C761358C25666F`; browser receipt `output/playwright/results.json` has SHA-256 `1969B16FD2A9C1EC110D69D03A27C8C9F324B707875AF9247EB78FC67E86078D`. Red/focused receipts remain beside the full receipt. These ignored local artifacts contain no secret values and are not hosted evidence.

### Integration and acceptance limits

Apply migration `003` before starting this backend in any separately authorized target. Pre-migration quotes cannot reconstruct historical terms: fresh submission returns `409 QUOTE_SNAPSHOT_REQUIRED` and requires a new quote. Existing submitted application snapshots and idempotent replays remain valid. Only the disposable test database was migrated; local port 15432, shared databases and production were untouched.

This dependent candidate stays separate from the pending publication authorization for the combined BCK-001/BCK-002 base. Package locally, then reconcile against its eventual integrated base before separately authorized publication and hosted checks. No push, review submission, merge, deployment, Pages update or schedule restart occurred. Parent BE-O3/O4 and BIZTRUST-BE-GOAL-001 remain incomplete; approved product/rates/wording, identity, recovery, release and production decisions remain external requirements.

Reusable lesson: store the product terms used to calculate a quote at quote creation; a saved price plus a later catalogue lookup is insufficient historical evidence. This finding is supported by the red/green regression above. `ecc:search-first` reused existing JSONB, permissions and migration patterns; no external search, dependency or install was needed. `ecc:eval-harness` supplied criterion/evidence discipline only; its disabled candidate executor was neither used nor bypassed, and no repeated-run reliability metric is claimed.

Use applicable existing skills first. Check their availability, read the selected SKILL.md, and choose one primary workflow with only the specialists needed for the task. Follow repository rules and the task's authorization.

## S1 — Reconciliation after PR 20 integration

**3 October 2026 · local only.** PR #20 was squash-merged as `dbb0f719de92b78bbda73d9f77ed1b9d97f35abb`; [main CI](https://github.com/bstBizEra/biztrust_ib/actions/runs/37100588676) and required job 111139169449 passed on that exact commit. Its sole parent is `8c5b5451f69eb89aa8e64038be6519011a6ecb9e`; its tree `6590fb0e272f878674e213798fac778fc3dff781` equals the reviewed BCK-001/002 head. Protections and the source branch were preserved. This closes the PR20 synthetic integration prerequisite only.

Reconciliation checkout: C:/Users/ounkh/.codex/worktrees/bck003-main-reconciliation/biztrust_ib; branch `codex/fix/bck003-main-reconciliation`; base `dbb0f719de92b78bbda73d9f77ed1b9d97f35abb`. The original dirty checkout and original BCK-003 source commit remain preserved. Primary skill: `ecc:git-workflow`; helpers: conventional-branch and git-commit.

Executed `git cherry-pick --no-commit 7b5b3cfd2f6c85447da4a75b059a8b5ef5f43833` without conflicts. Before this documentation refresh, `git write-tree` returned `0461fa09993cb63dd887b549dde3fef3d726a84d`, exactly the original BCK-003 tree. All code, tests, migrations, dependency declarations and lockfiles therefore match the previously verified candidate. The three recorded executable SHA-256 pins match Git blob bytes and LF-normalized checkout bytes; Windows checked them out as CRLF. Raw working-file hashes differ only by line endings. Subsequent changes in this unit are documentation only.

The 1 October full verifier and AP-01/AP-02 findings above are reused historical evidence, not fresh executions. The original ignored runtime receipts and runner are not present in this new checkout; their hashes are retained as historical records, not claimed as freshly inspected files. No database, migration, browser or full application suite ran during this reconciliation. Hosted CI for a future BCK-003 PR remains unrun.

Next: inspect the final scoped candidate, then obtain authorization for existing GitHub login, main/protection preflight, branch push, draft PR and CI readback. App review and merge remain separate. No BCK-003 publication, deployment, Pages update or schedule restart is authorized; schedule PAUSED. Migration 003 remains required before startup in a separately authorized target. Product/wording/identity, recovery, release and G00/G1–G6 decisions remain open.
