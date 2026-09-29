# BT-17-S7: dependency SBOM

## R31 bounded contract — 29 September 2026

Outcome: produce a CycloneDX dependency inventory from the committed npm lockfile, retain it as a CI artifact, and prove clean generation plus rejection of an incomplete dependency graph. This implements the SBOM requirement in phase-closure objective section 25, supporting P5 security and P6/G5 release assurance; no phase or owner gate closes here.

Base: locally recorded main `b7a6af650ad75d55df8073fc70cda8dbc0d0391d`. Reuse the idle, clean `bt11-reconcile-main/biztrust_ib` checkout on `codex/ci/bt17-sbom`. The existing secret-scanner commit `12b6c0f` and the development/isolation candidates remain separate. Current remote main is not revalidated; publication requires authorized preflight and reconciliation.

Ownership: ADF owns `package.json`, `.github/workflows/verify.yml` and this contract. Progress Board owns milestone source and generated board. AP-01/AP-02 independently review the exact delta. Primary execution skill: `agent-skills:ci-cd-and-automation`; `ecc:git-workflow` for checkout isolation. No new library or scanner installation.

Must-pass criteria:

1. Native npm produces a CycloneDX application SBOM from package-lock only, explicitly including production, development, optional and peer dependencies, without network, credentials/private configuration reads, installation or lifecycle scripts in local verification.
2. Verify the root identity, every unique locked dependency name/version, dependency references, lockfile preservation and native rejection of a synthetic missing required dependency. Record actual counts and commands, not legal or vulnerability acceptance.
3. CI generation stays inside the existing required job with failure propagation, retains a commit-bound SBOM artifact and fails if it is absent. Existing application checks, permissions and deployment barriers stay unchanged. Hosted execution is unrun until separately authorized.

Budget: R31 began 07:45 UTC, stop by 08:05 UTC, at most two repairs per failure. Stop on credential/private-file access, unrelated source drift or exhausted budget; checkpoint partial results. No push, hosted change, deployment or scheduling.

The lockfile inventory does not inspect a built container, establish license compatibility, prove absence of vulnerabilities, or inventory operating-system packages. Owner-approved license policy, container/SAST/DAST evidence and release acceptance remain separate.

Reference: [npm sbom documentation](https://docs.npmjs.com/cli/v11/commands/npm-sbom/) inspected 29 September 2026. Package-lock-only reads locked metadata; explicitly including dependency types avoids environment-dependent omission. This is an inventory snapshot, not artifact provenance or a signed attestation.

## Execution checkpoint

The local candidate adds `security:sbom` to `package.json` and two steps after `npm ci` in the existing required Verify job. Native npm emits the CycloneDX inventory; CI records the lockfile SHA-256 and proposes a 14-day artifact named with `github.sha`. This artifact retention is an engineering evidence setting, not approval of customer-data or backup retention. Existing required job name, permissions and application verifier remain unchanged. No dependency, lockfile or runtime source changed.

Executed on Windows with Node **24.19.0** and npm **11.17.0** at **2026-09-29T07:53:10.664Z**:

- `node output/bt17-r31-sbom-20260929/verify.mjs` exited **0** after one execution repair. The harness invokes the known npm CLI directly with the exact argument vector asserted against `security:sbom`; this is not an executed `npm run` or hosted CI claim.
- Inventory validation passed: **326 locked paths, 324 unique dependency components and 325 dependency relation records**, including development/optional dependencies despite ambient `NODE_ENV=production`. Root package reference/PURL, version/type, complete locked name/version coverage and relationship reference validity passed. Exact dependency-edge completeness and full CycloneDX schema conformance were not separately validated.
- A synthetic missing required `express` dependency failed with `ESBOMPROBLEMS`/exit **1** as expected. A synthetic missing lockfile failed with the required-lockfile diagnostic/exit **1** as expected.
- Source manifest and lock hashes remained unchanged; the owned temporary fixture directory was removed. All npm operations used offline mode, disabled lifecycle scripts, controlled empty user/global config and an isolated cache; no database, application service or external account was used.
- First execution stopped on a root display-name assertion: npm used the fixture folder name `clean`. Inspection of installed npm's `lib/utils/sbom-cyclonedx.js` showed that `bom-ref` and PURL carry canonical package identity while `name` reflects the folder. The corrected assertion checks both canonical identifiers. The first failed receipt is retained.
- Pre-execution AP-01 review identified a nested npm subprocess timeout risk. The harness was corrected to invoke the fixed CLI directly under a 90-second timeout per call. Final independent result review is recorded with the artifact manifest.

SBOM SHA-256: `3DAAD514FE3FDB865358E33B5A6EF901214DC8569D80F1DC94E2BE120E1ABB92`.
Lockfile SHA-256: `5321BF894AFFEB9083402CE753230C3116C790E3FFCE38C723007EE28E10A56F`.
Local evidence lives in `output/bt17-r31-sbom-20260929/`; source hashes and review binding belong in its manifest. Generated SBOMs/logs remain ignored artifacts.

Remaining: reconcile with the separate scanner package and current main before authorized publication; prove the exact required hosted job and artifact upload. Full application checks were not repeated because runtime, dependencies and `verify` are unchanged. License acceptance, SAST/container/DAST gaps and G00/G1-G6/owner gates remain open. Schedule remains paused.
