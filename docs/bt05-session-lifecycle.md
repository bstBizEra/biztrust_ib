# BT-05 R39: customer session lifecycle evidence

**Snapshot:** 29 September 2026. Local test-only package implemented and verified; integration and live identity acceptance remain pending.

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

**Next:** complete this local package, then obtain scoped publication authorization. No hosted verification has run for this package. PR #17 merge authorization, approved identity environment/access matrix, recovery and accountable-owner acceptance remain pending. G00/G1–G6 and production gates stay open; scheduling remains paused.
