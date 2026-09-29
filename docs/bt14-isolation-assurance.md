# BT-14-S2 — synthetic tenant-isolation assurance

**Snapshot:** 29 September 2026. **Owner:** ADF / Backend engineering; AP-01 security and AP-02 source review. **State:** local implementation and focused verification passed; integration and phase acceptance remain open.

## Scope and basis

The updated Enterprise Phase Closure objective requires explicit tenant A to B, B to A, unknown, missing and manipulated tenant-context evidence. The existing integration test directly exercises an A-owned application, but does not explicitly demonstrate the reciprocal B-owned resource or unknown tenant. This is a test-coverage gap, not an observed vulnerability.

Repository: BizTrust_IB (`bstBizEra/biztrust_ib`). Checkout: `C:/Users/ounkh/.codex/worktrees/bt14-isolation-checks/biztrust_ib`. Branch: `codex/test/bt14-tenant-isolation`. Local recorded main base: `b7a6af650ad75d55df8073fc70cda8dbc0d0391d`; remote freshness is unverified. This independent test-only increment does not modify the pending BT-11 candidate `163681b85a28110e47e0a0d79fa3af3d75d04cfe`.

## Ownership and acceptance

- Backend owns only `tests/integration.test.ts`: retain existing assertions and add reciprocal authorized/denied resource access, unknown-tenant denial with the same owner identity, and explicit manipulated request-context checks if existing coverage does not establish them.
- ADF owns this record and the ignored exact-candidate verification handoff. Security owns only the scoped adaptation of the existing isolated runner. Progress Board owns Markdown milestones, history and generated HTML.
- Must-pass: own resources remain accessible; cross-tenant access in both directions, unknown/missing tenant context and caller-selected tenant context cannot disclose another tenant's application. Existing RLS and pooled-context assertions remain.
- Verification: focused integration suite, targeted formatting, lint/type checking and board checks. Record actual commands and exact source hashes. Existing full application evidence remains historical; no claim that a focused run is full verification.
- Environment: only the previously authorized isolated PostgreSQL cluster at `127.0.0.1:25432`, generated test credentials through the reviewed runner, synthetic fixtures. No `.env`, shared credentials, shared DB, provider or production access.
- Stop on source/environment drift, unexpected authorization behavior, cleanup failure, two repair attempts per failure, or the R26 deadline of 2026-09-29 06:36 UTC. Checkpoint unfinished work.
- No push, hosted review, merge, release, deployment, Pages publication or schedule restart. Production/staging startup barriers and all owner decisions remain effective.

## Evidence

Primary workflow: `ecc:agentic-engineering`; specialists: `agent-skills:test-driven-development`, `ecc:security-review` and `agent-skills:code-review-and-quality`. No dependency or production behavior changed.

At 2026-09-29T06:29:28Z the reviewed isolated runner executed `npm run test:integration` (**13 passed, zero failed**), `npm run lint` and `npm run typecheck` (both exit 0). The run took 55.6008352 seconds. Cleanup, absent database PID, stopped cluster, stable source and preserved historical acceptance/browser evidence all passed. No migration ran. Full `npm run verify`, browser checks, dependency audit and hosted CI were not rerun in this unit.

Exact integration-test SHA-256: `71711D54BA26398C313AEC364A2E2489DE3AAFE89F9CE261B5176655CEA025CA`. The ignored local receipt is `output/bt14-r26-isolation-20260929/summary.json`, SHA-256 `E303B23259ABD8F84110655F97CAF9AC40B0AC10802911B5F152AF48AB009942`. Runner SHA-256 after coordinator clearance: `375E294BB58AB117AC47DA318BDAE9CAE35686CC79FF4D88CAFF090BB608D85B`; candidate pin manifest: `E8DEFCF93CA0D8CE6D09EFF9B892057DA2A33A7CB6F30181C5AF7C9248E5F981`. The receipt pins the pre-run contract; subsequent changes to this record and the board add results only.

| Requirement                                    | Work package / implementation                            | Check / observed evidence                                                                                                | Status                                                  |
| ---------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------- |
| Authorized own-tenant resource access          | BT-14-S2; existing RLS/service/session paths             | A and B domain reads and HTTP 200 with exact application reference                                                       | Passed locally                                          |
| A to B and B to A denial                       | BT-14-S2; new reciprocal integration case                | Same owner identity in two known tenants, both cross-resource reads denied                                               | Passed locally                                          |
| Unknown tenant denies access                   | BT-14-S2; same case                                      | Valid owner identity with unknown tenant denied in both fixtures                                                         | Passed locally                                          |
| Missing tenant and pooled-context isolation    | BT-14-S2; retained existing integration case             | No-context query returns zero rows; twelve alternating pooled reads retain correct scope                                 | Passed locally                                          |
| Caller-selected tenant cannot override context | BT-14-S2; new case plus retained request-body validation | Cross-resource query/header injection returns 404 `APPLICATION_NOT_FOUND` both ways; existing body injection returns 400 | Passed locally                                          |
| Production identity/access acceptance          | BT-05 / owner inputs                                     | Real identity environment and approved role/access matrix absent                                                         | Blocked; local synthetic checks do not supply authority |

AP-02 identified one test-design issue before execution: different owner IDs could hide a tenant-boundary regression. One repair uses the same owner ID in both tenant fixtures. AP-01 and AP-02 then independently reviewed the final test hash with no actionable findings. AP-02 and ADF reviewed the adapted runner before execution; the runner author did not supply independent approval of their own runner. No application defect was observed or repaired.

R26 board synchronization completed in the original, release-workflow and test checkouts. Targeted formatting, board generation/freshness, content assertions and whitespace checks passed. The five-file uncommitted candidate is recorded in `output/bt14-r26-isolation-20260929/final-candidate.json`, SHA-256 `9239CBD40C2F1116D48720BBF973F40906BE931E8CCA1EC51E54A9A48A5FECEE`.

## R27 full-verification and packaging checkpoint

Started 2026-09-29 06:36 UTC; deadline 06:56 UTC, at most two repairs per failure. ADF owns this record and local packaging; the runner specialist owns only `output/bt14-r27-package-20260929/` preparation before review, and the Progress Board owner owns board updates after execution. Current base, branch and source scope remain unchanged.

Run the full repository `npm run verify` gate in the same approved isolated environment before calling this candidate fully verified. Use the reviewed full-verification runner with exact source pins and cleanup; preserve the R26 evidence. Do not weaken checks to pass. AP-01/AP-02 test reviews remain applicable while their source hash is unchanged; independently review the adapted runner. When verification succeeds, record results, synchronize boards and prepare one coherent local Conventional Commit and PR description. Hosted publication still requires its own applicable authorization. Stop and checkpoint on drift, cleanup failure, unmet mandatory checks or time/retry exhaustion.

**R27 result:** for the run started at 2026-09-29T06:40:34.5162871Z, full local verification passed: `npm run verify` exited 0, covering board freshness, lint, types, **48 tests**, build, development startup on three routes plus reload, **34 accessibility checks and eight browser journeys**, and production-dependency audit with **zero reported vulnerabilities**. Browser console and asset errors were zero. The test source remains `71711D54BA26398C313AEC364A2E2489DE3AAFE89F9CE261B5176655CEA025CA`. No migration ran; schema sources are unchanged.

The full command took 176.2191206 seconds; the complete guarded runner including cleanup took 273.0659799 seconds. Its receipt reports failure null and successful cluster stop, PID-file absence, child cleanup, source stability across all 109 pinned files, preservation of R26 evidence and preservation of historical acceptance evidence. AP-02 independently reviewed the adapted runner; ADF cleared execution. Earlier AP-01/AP-02 reviews apply to the unchanged test source. No runtime repair was needed. A later evidence review corrected the run-start timestamp label.

Local artifacts under `output/bt14-r27-package-20260929/`:

| Artifact                          | SHA-256                                                            |
| --------------------------------- | ------------------------------------------------------------------ |
| `summary.json`                    | `BDEC92C6C28F2FEBAA4B9AC97FADDA00C19D26176460D70CF6D66AA9F2790F54` |
| `full-verify.log`                 | `6E543DB8C4A1EAF5318F1B039B8C84063539A738D45D907A0E54968346B150F5` |
| `run.ps1` after clearance         | `E96DE89D48A2DFBC43E017CC57909AFF88322C83E2AEDEC465086CD62D8F7C46` |
| `candidate-pins.json`             | `534BDC2D9E6C73DD806E1BB6D45A63DE35DA77E6AE4541FC123EA52B63FFB096` |
| `current-playwright/results.json` | `3E2D9322C6399BCE62C0D70095C8AAEA6959FADB04FE9EC401A14130EF56E161` |

The full verifier binds the pre-result documents. Only this record and the three board files are updated afterward; package preparation must confirm every other verified source hash is unchanged. Final commit/tree and PR text will be recorded in the local `HANDOFF.md` and manifest in that same directory. Hosted CI/review, publication and integration remain pending separately. No phase acceptance follows, and the frozen BT-11 candidate remains separate.

## R26 phase-closure baseline

The actual roadmap remains P0–P7. This repository supplies the public BizTrust_IB portal and bounded read-only staff console; it does not establish completion of the broader Brokerage Platform.

| Phase                      | Current evidence                                                                                                                                               | Closure state / remaining dependency                                                                                                    |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| P0 discovery and authority | Owner register and synthetic scope                                                                                                                             | BLOCKED: insurer/distribution authority, approved products, rates and wording                                                           |
| P1 architecture and UX     | Local architecture, contracts and journey baseline                                                                                                             | OPEN: identity/access and accountable design decisions                                                                                  |
| P2 local foundation        | Isolated synthetic integration and full verification; R24 records 48 tests, 34 accessibility checks and eight browser journeys on the separate BT-11 candidate | OPEN: this package strengthens tenant evidence; full phase acceptance is not inferred                                                   |
| P3 staff workflows         | Read-only inspection and non-persistent preview                                                                                                                | BLOCKED for governed writes: approved identity/role/product authority                                                                   |
| P4 partner integrations    | Signed synthetic payment intake and simulator                                                                                                                  | BLOCKED: partner contracts and real provider acceptance                                                                                 |
| P5 security and operations | Restricted database role, RLS, negative tests, local recovery evidence                                                                                         | OPEN: CI secret scanning missing; SAST/license/container/SBOM evidence unverified; recovery targets/custody and owner decisions pending |
| P6 staging and acceptance  | Historical exact-revision hosted integration evidence                                                                                                          | BLOCKED: staging environment, acceptance targets and release-owner decisions                                                            |
| P7 production and service  | Startup remains rejected                                                                                                                                       | BLOCKED: prerequisite phase gates and explicit promotion authority                                                                      |

Read-only inspection of `.github/workflows/verify.yml`, `.github/workflows/release.yml` and `package.json` at `163681b85a28110e47e0a0d79fa3af3d75d04cfe` found that the security command is only `npm audit --omit=dev --audit-level=high`. No secret-scanner invocation was found. Existing dependency-audit evidence is not secret, SAST or license-scan evidence. The required secret-scanning improvement is a separate bounded security task; this test increment neither installs a scanner nor closes that gap.

Priority decision: strengthen the demonstrated isolation coverage gap using existing tests and the authorized isolated environment now. Evaluate a standard secret-scanning capability separately, with explicit source scope, redacted output, version provenance and positive/negative evidence before claiming enforcement. Do not introduce a home-grown detector as comprehensive security assurance.
