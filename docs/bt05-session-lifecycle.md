# BT-05 R39: customer session lifecycle evidence

**Snapshot:** 29 September 2026. R47 combined verification and independent reviews passed. R48 packaging and hosted PR #18 checks/review/integration are pending under the approved batch. Earlier sections preserve dated package history; live identity and production acceptance remain open.

## Bounded scope

Add missing HTTP/PostgreSQL negative evidence for expired customer sessions and replay of a logged-out customer cookie. Staff expiry already has coverage. This package changes tests, not runtime authentication policy. It supports P2/P5 identity assurance and G2; live identity and accountable-owner decisions remain open.

- Checkout: `C:/Users/ounkh/.codex/worktrees/bt05-session-lifecycle/biztrust_ib`.
- Branch: `codex/test/bt05-session-lifecycle`.
- Base: `b7a6af650ad75d55df8073fc70cda8dbc0d0391d`, last observed main during R38 at 09:41:04 UTC. No fresh remote action in this unit.
- Owned code: `tests/customer-session.test.ts`; root owns this contract; Progress Board owner owns board updates.
- Primary skill: `agent-skills:security-and-hardening`; reuse existing test and isolated verification patterns. Keep the configured model.
- Unit: 09:49:38–10:09:38 UTC, at most two repairs per failure; checkpoint unfinished work at the deadline.

## Acceptance and evidence

| Criterion                | Type           | Target and measurement                                                                                                                           | Decision owner        |
| ------------------------ | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------- |
| Expired customer session | Must-pass      | Valid-session positive control, real past PostgreSQL expiry, then protected reads denied and session anonymous over HTTP                         | Engineering reviewers |
| Logout replay            | Must-pass      | Correct Origin/CSRF logout rotates session and deletes prior token; old cookie and new anonymous cookie cannot read protected customer resources | Engineering reviewers |
| Candidate verification   | Must-pass      | Relevant checks and full verifier on exact source hashes; record failures, unrun checks, and service cleanup                                     | Git / ADF             |
| Scope preservation       | Must-pass      | Runtime, production barriers and all existing candidates unchanged; tests use only synthetic data                                                | Security reviewer     |
| Identity acceptance      | Owner judgment | Approved identity environment, access matrix and owner acceptance remain outstanding                                                             | Identity owner        |

Reuse only the approved task-owned isolated PostgreSQL environment on `127.0.0.1:25432` through the reviewed runner, with its generated test credentials and migrations. Disable dotenv, exclude credentials from logs, stop owned services afterward. Existing credentials, `.env`, shared databases and production remain out of scope. No new dependency, external setup, publication, merge, hosted settings, deployment, Pages change or schedule restart. PR #17 remains separate at `22ae7ead`; its merge authorization is pending.

## Execution checkpoint

Contract recorded before test implementation. Two tests now exercise real HTTP demo login, positive protected-read controls, past PostgreSQL expiry, logout token deletion/rotation, and denial when old or anonymous replacement cookies are replayed. Runtime code and dependency files match the base. PR #17's separate CSRF repair is not included.

- Exact tested source: `tests/customer-session.test.ts`, SHA-256 `34E34964D2A9B14961ADDBC74439F186CF1085BF56A00FBADF0FE904BC9E4D27`.
- AP-01 security and AP-02 independent source reviews found no actionable findings. Their source reviews did not execute tests or establish owner/hosted approval. CSRF token format and full identity-provider assurance are outside this package.
- Actual command: `pwsh -NoProfile -File output/bt05-r39-session-lifecycle-20260929/full-verification/run.ps1`; executed runner SHA-256 `47E13B1B21CDF6114FD4623D8560365260F87DC5C030A156CC8E56A74FDA9AD5`.
- Execution began 10:01:56 UTC and completed 10:06:32 UTC. `npm run db:migrate` and `npm run verify` exited 0. All 49 tests passed, including both new cases; 34 accessibility checks, eight browser journeys, startup checks, build, lint, types and dependency audit passed; audit reported zero vulnerabilities. This is the 47-test main baseline plus two new tests, not PR #17's separate 50-test candidate.
- Runner summary SHA-256 `A89DBD600E9B3AB6307F71FFF773B1C7C0D7549B7EE44148157860535B0C5DD8`; redacted full log SHA-256 `7871ACE1EF043FFF503D0A2AE4C77B6A08345F48C4D27182CA3A7C580667E809`, under this checkout's `output/bt05-r39-session-lifecycle-20260929/full-verification/`.
- Cleanup proved no listener on port 25432, no PostgreSQL PID file, owned-child cleanup, unchanged tested sources and preserved historical acceptance evidence. Root also observed the absent listener and PID file. No repairs or reruns were required.
- This checkpoint and board documentation were updated after application verification; final documentation checks are recorded by the board owner. The tested source hash remains unchanged.

## R40 local integration package

**Scope recorded before packaging, 29 September 2026:** Preserve the exact R39 test, review the six-file test/documentation diff and create one local Conventional Commit on the existing branch. Prepare a PR body and candidate manifest in ignored local evidence, without publishing. Root owns this contract; Progress Board owns its four source/generated board files; Git owns explicit staging, staged-diff inspection, local commit and package evidence after all writers release ownership.

- Bounded unit: 10:10:25–10:30:25 UTC, at most two repairs per failure; checkpoint unfinished work at the deadline.
- Primary workflow: `ecc:git-workflow`, with `git-commit` for the actual staged change. Keep the configured model.
- Allowed paths: this contract, `tests/customer-session.test.ts`, `docs/progress.md`, `docs/progress-updates.md`, `docs/next-stage-action-plan.md` and generated `docs/progress.html`.
- Must-pass: the test hash remains `34E34964D2A9B14961ADDBC74439F186CF1085BF56A00FBADF0FE904BC9E4D27`; runtime and dependencies match base `b7a6af650ad75d55df8073fc70cda8dbc0d0391d`; no unrelated paths enter the index; staged whitespace, formatting and board freshness checks pass; commit parent/tree/files and a clean candidate checkout are recorded. Git/ADF own the engineering disposition.
- Reuse the R39 application verification and AP-01/AP-02 source reviews; changed documentation receives proportionate checks. Do not rerun database/browser checks unless relevant code or dependency evidence changes.
- Inspect local hooks/signing before committing; stop if the commit would require credential use or an unreviewed external action. No GitHub calls, credentials, `.env`, services, publication, review submission, merge, settings, release, deployment, Pages or schedule change.
- Record the resulting commit and PR draft outside the commit to avoid self-referential hashes; update the original and release local boards with the observed result afterward. Integration base freshness must be checked again before any separately authorized publication.

**R40 next (historical):** complete this local package, then obtain scoped publication authorization. No hosted verification had run at that checkpoint. The current authorized sequence is recorded below.

## R47 reconciliation with integrated PR #17

The Project Owner authorized the two-PR synthetic-development integration batch on 29 September 2026. PR #17 merged as `c8c059e6bcac8f7ca701eae04efeaa9fe16bfe0f`, parent `b7a6af650ad75d55df8073fc70cda8dbc0d0391d`, reviewed tree `c71a0c47fd597d215186305ab66e331c17019025`. [Main CI](https://github.com/bstBizEra/biztrust_ib/actions/runs/36590274275/job/109481245752) passed with 50 tests, 34 accessibility checks, eight journeys and audit zero. The source branch and protections were retained.

Reconcile PR #18 head `0c178f70a9634e66097a414e75880c8953ea8325` by merging that exact main commit into its published branch. Git owns the index/commit, Progress Board owns the three conflicted Markdown sources and regenerated HTML, ADF owns this record, and separate AP-01/AP-02 agents review the resulting candidate. Primary skill: `ecc:git-workflow`; configured model unchanged. The four expected conflicts are documentation only. Preserve the exact CSRF fix and both test files, with no new runtime, dependency or schema behavior.

The direct remote main ref and fetched commit identify `c8c059e`; the PR record still exposed the prior base `b7a6af6`, which also equals the local merge-base. The reason for that API field is not established. Local reconciliation binds the independent main ref and exact commit. Subsequent hosted approval and merge require fresh candidate/base, CI, review, threads and full policy guards.

Must-pass: record the resolved source/tree; use the reviewed isolated runner on task-owned PostgreSQL `127.0.0.1:25432` for migrations and `npm run verify`, with dotenv disabled, synthetic credentials redacted and owned services stopped; preserve historical evidence; complete separate security/code reviews and board checks. Combined execution is pending at this contract checkpoint. Deadline 15:51 UTC; at most two local repairs per failure. Stop on unexpected drift/conflicts, failed gates or unexplained code changes.

The same approval covers the verified derived commit's push/CI, one exact App approval with token revocation, guarded squash merge and main CI. It expires at completion, revocation or 2026-09-30T15:20:59Z. Other PRs, hosted settings, tags/releases, branch deletion, deployment, Pages and schedule restart are excluded. Identity environment/access decisions, recovery and accountable-owner acceptance, G00/G1–G6 and production gates remain open.

### R47 verified reconciliation checkpoint

The resolved pending merge was frozen at tree `117edd6af7aff12dc9bc7a4c79f6fdb060dc23ba` (HEAD `0c178f70`, MERGE_HEAD `c8c059e6`). AP-01 and AP-02 independently cleared the candidate. AP-02 found one stale “Current R15” documentation heading, which was restored to “Historical” before verification. Runtime and both test files remain the exact authorized union; dependencies and schema are unchanged.

Actual command: `pwsh -NoProfile -File output/bt05-r47-reconciliation-20260929/full-verification/run.ps1`, executed runner SHA-256 `AF52384853398B107F4745557CB8F7999B6A88AB9D645030CCDD31090206ECBD`. Execution started 15:45:36 UTC. Both `npm run db:migrate` and `npm run verify` exited 0: **52 tests, 34 accessibility checks, eight browser journeys, no page errors and zero reported dependency-audit vulnerabilities**. Build, lint, types, board freshness and startup checks passed. No application repair or rerun was required.

The suite completed before the 15:51 UTC deadline; final cleanup and evidence capture finished about 15:51:05 UTC. Owned-child cleanup, stopped cluster, absent PID file, source stability and historical-evidence preservation all passed. ADF independently observed no listener on 25432 and no PID file. Summary SHA-256 `A0A4A2BE7B980244191D8A0F2EC9800A6562C7BC6A67C823D9ECD5BE074CD8F8`; redacted log `4075A7D151AF71FA877A708AD2E1DFC1F9EB23FB4ED98EC2B05C65980D0559C0`; ten-artifact verification manifest `83DC70A4990D1F7D000693F90B515E833459182858F2152CF77EB7BE6CBE861D`. Evidence is under `output/bt05-r47-reconciliation-20260929/`; safe receipts were mirrored to both human boards.

### R48 package and publication unit

Under the same approved batch, from 15:51:32 to 16:11:32 UTC, synchronize these evidence notes and board sources, inspect the explicit staged diff and preserve both parents in a local Conventional Commit. Then freshly verify actual main `c8c059e6`, the still-published PR #18 head `0c178f70`, source branch and full protections; push the derived commit without force and inspect its exact-head hosted CI and review history. Only documented evidence wording changes after R47 verification are permitted before packaging. Recheck formatting/board freshness and the resulting source pins; repeat application verification only if relevant code or dependencies change.

Git owns staging, packaging and authorized publication; Progress Board owns its four board files; ADF owns this note. No App review is submitted until the adapter binds the resulting revision/history and its offline checks and independent review pass. The batch already authorizes that subsequent one-review/revocation and guarded squash merge/main-CI sequence; no extra approval round is introduced. Stop on unexpected drift or failed gates, at most two local repairs. The previously stated expiry, production/owner boundaries and exclusions remain effective; scheduling stays paused.
