# BT-05 R34: reject malformed customer CSRF sessions

## Bounded contract — 29 September 2026

Outcome: customer mutation requests must fail closed when the stored session has no nonempty CSRF token, even if the request token is also missing or empty. This supports the master objective's negative-first authentication/security criteria (sections 12 and 25), BT-05 local identity hardening, P2/P5 and G2 evidence. Live identity activation and all owner/production gates remain open.

Base: locally recorded main `b7a6af650ad75d55df8073fc70cda8dbc0d0391d`. Reuse the idle, clean `bt17-enforcement-proof/biztrust_ib` checkout on new branch `codex/fix/bt05-csrf-session`; its previous proof branch and artifacts are retained. No current GitHub inspection is performed. Published PR #16 and the other frozen candidates are separate.

Finding: customer `csrfMiddleware` compares the request token with `req.session.csrf` without first requiring a stored token. Matching Origin and two undefined or empty values can pass. Ordinary session creation generates random tokens; this is a malformed-session defense-in-depth gap, not evidence of a remotely exploitable session forgery. Staff CSRF already rejects an absent/empty token.

Scope/ownership: ADF owns `server/auth.ts`, `tests/customer-csrf.test.ts` and this record. AP-01 security and AP-02 code agents independently review final hashes. Progress Board owns human board sources and generated HTML. Primary skill: `agent-skills:security-and-hardening`; existing test/Git procedures provide execution. No new dependencies or service integration. Preserve configured model and all synthetic-development/production barriers.

Must-pass criteria:

1. Reproduce the missing/empty token acceptance with a credential-free regression before editing the guard.
2. Reject malformed/missing session tokens for unsafe methods with the existing 403 `INVALID_REQUEST_ORIGIN`; retain valid-token handling, origin/token mismatch rejection and unchanged safe-method behavior.
3. Pure middleware checks use synthetic request data, disabled dotenv loading and forbidden database methods. Run affected lint/types and the existing full verifier only in the previously authorized owned isolated environment if its runner accepts this checkout; record any unrun gate explicitly.
4. Independent final-candidate reviews have no unresolved actionable findings; update both human boards with actual results. No hosted publication or identity/provider/production acceptance is inferred.

No schema/API-field migration, financial rule or permission grant is involved. Rollback is the reviewed topic diff; do not change other checkouts. R34 began 08:24:41 UTC, stops by 08:44:41 UTC, and allows at most two repairs per failure. Stop on unrelated changes, credentials outside the approved isolated verifier, exhausted limits or unexpected service ownership. Fresh hosted verification, publication and integration need their applicable authorization. Schedule remains paused.

## Execution checkpoint

The pre-fix regression exited 1 at the first missing-token assertion (two other tests passed). This directly reproduced missing-token acceptance; empty-token acceptance was established by source inspection, not a separate pre-fix execution. Adding `!req.session?.csrf` before the origin/token comparison made all three tests pass. Coverage includes four unsafe methods with absent/empty/null/missing-session inputs, valid tokens, incorrect/missing request tokens, wrong origin and unchanged GET/HEAD/OPTIONS behavior. No test database method was called.

- `server/auth.ts` SHA-256: `7B4B7629EBA82F8723ABEF4977ED5A753F5F8BDF66E4795C210DDA32E92EFE9F`.
- `tests/customer-csrf.test.ts` SHA-256: `76D4D396726C7A8AB207CAA5152FEE084B965D3DD61822EE3838937E213E66A0`.
- Commands: `node --import tsx --test tests/customer-csrf.test.ts` (expected exit 1 before fix; exit 0 afterward, 3/3); targeted ESLint and `tsc --noEmit` (both exit 0); formatting and diff checks passed.
- AP-01 security and AP-02 independent code reviews found no actionable source issue at those hashes. Both inspected saved evidence without executing the tests.

Under the existing isolated-environment authorization, the reviewed runner executed `npm run db:migrate` and `npm run verify` against only the owned PostgreSQL instance at `127.0.0.1:25432`, with generated test-only configuration, dotenv disabled and redacted logs. Both commands exited **0**. Full verification passed **50 tests, 34 accessibility checks and eight browser journeys**, with no page errors and zero reported dependency-audit vulnerabilities.

Execution runner SHA-256: `5C0C5DB294C68A113A3E6E9ED30266437CAC47659645EA990EB8F61DAE3E8BDF`. AP-01 required one pre-execution safety repair: successful cleanup must prove removal of `postmaster.pid` as well as no listening database port. The reviewed runner's only subsequent change was its coordinator clearance marker. The run started at **08:34:11 UTC**, completed in **285.522 seconds**, and recorded no failure. Owned child cleanup, database shutdown, PID-file absence, source stability and historical acceptance evidence preservation all passed.

Evidence is under `output/bt05-r34-csrf-20260929/`: focused logs/receipt, independent reviews, and `full-verification/summary.json`, pinned runner and redacted command logs. Final evidence/board edits followed cleanup; runtime/test hashes remain unchanged and only documentation checks are repeated. No new credential store, identity service, hosted CI, publication, merge, deployment, Pages update or schedule restart occurred. This is a locally verified, uncommitted hardening candidate; BT-05 live identity acceptance and G00/G1-G6/production gates remain open. Next is coherent local packaging and later separately authorized publication/review.
