# Repository reuse and acquisition plan

**Reviewed:** 26 September 2026 · **Application baseline:** 0.2.0 local demonstration · **Status:** proposed adoption plan

Use the [interactive repository register](progress.html#repositories) for filtering by phase, module and milestone. [repository-plan.json](repository-plan.json) is its structured source: 21 upstream entries comprising 19 repositories, one workflow reference and one topic index. Each entry records current use, integration work, acceptance, license, sources and acquisition policy. The recommendations below are engineering judgments based on those upstream sources and the current repository.

This update selects reuse candidates and their integration sequence. It does not install dependencies, clone source, create remote forks, enable workflows or deploy services. Existing BT milestone statuses and the production startup block remain unchanged.

## Acquisition decision

**Use upstream packages and supported artifacts by default.** A clone helps inspect source; it does not integrate a module. A fork creates an ongoing patch/security-update responsibility. No core fork is needed for the initial shortlist. Keep BizTrust adapters, domain rules, infrastructure configuration and UI composition in this repository.

| Method                                    | When to use it                                                                                     | Project handling                                                                                                                                                                |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Package                                   | Existing libraries and new small application/worker libraries                                      | Select a compatible version in the relevant implementation change, record lockfile integrity and verify the affected domain.                                                    |
| Upstream image, binary or managed service | Identity, gateway, backup, key management and observability                                        | Pin the service artifact/digest, separate credentials and storage, record configuration and restore/rollback evidence.                                                          |
| Clone to inspect                          | A concrete investigation, customization or template review                                         | Put disposable checkouts under ignored `output/upstream/`; pin a commit and inspect source before running any setup. Do not add upstream source trees to the application build. |
| Copy/adapt a template                     | ADR or engineering workflow guidance                                                               | Preserve source revision and license/provenance; maintain the small adapted file in the project.                                                                                |
| Fork                                      | A required patch cannot be delivered through supported configuration, extension or a local adapter | First record the exact gap, fork owner/visibility, patch scope, update owner and upstream contribution plan. Choose the destination when that need exists.                      |

## Reuse already present

These versions were read from the local lockfile; they are not upgrade requests.

| Upstream                                                        | Current dependency                           | Where it saves work                                                                         | License              |
| --------------------------------------------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------- | -------------------- |
| [panva/openid-client](https://github.com/panva/openid-client)   | `openid-client` 6.8.8                        | Existing customer/staff OIDC adapters; keep separate sessions and application tenant checks | MIT                  |
| [brianc/node-postgres](https://github.com/brianc/node-postgres) | `pg` 8.23.0                                  | Transactions, row isolation and durable records                                             | MIT                  |
| [colinhacks/zod](https://github.com/colinhacks/zod)             | `zod` 4.6.5                                  | Typed server validation and versioned product/provider schemas                              | MIT                  |
| [microsoft/playwright](https://github.com/microsoft/playwright) | `playwright` 1.63.0                          | Customer/staff browser journeys and release checks                                          | Apache-2.0           |
| [dequelabs/axe-core](https://github.com/dequelabs/axe-core)     | `axe-core` and `@axe-core/playwright` 4.13.0 | Automated accessibility checks alongside manual review                                      | MPL-2.0 for axe-core |

## Next implementation candidates

“Next” means the next relevant phase, not five immediate installations.

| Upstream                                                                              | Acquisition                                                                                           | Phase / milestones             | First bounded implementation                                                                                                                                                                  |
| ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [logto-io/logto](https://github.com/logto-io/logto)                                   | Official image or managed service; no core fork                                                       | P3 · BT-05, BT-14              | Connect two identity clients/resources to existing adapters; prove provisioning, audience separation, tenant mapping and required MFA. If self-hosted, use a separate identity database/role. |
| [timgit/pg-boss](https://github.com/timgit/pg-boss)                                   | npm package; no fork                                                                                  | P4 · BT-07, BT-08, BT-15       | One worker pilot against the existing durable inbox/outbox; prove scheduling consistency, crash/retry behavior and minimum database privileges.                                               |
| [react-hook-form/react-hook-form](https://github.com/react-hook-form/react-hook-form) | Conditional npm package, with compatible [Zod resolver](https://github.com/react-hook-form/resolvers) | P3 · BT-06, BT-12              | One new approved product/staff form; preserve current design and server validation. Keep only if it reduces repeated form work.                                                               |
| [TanStack/table](https://github.com/TanStack/table)                                   | Conditional `@tanstack/react-table` package                                                           | P3 · BT-06, BT-15              | One staff queue with server pagination/filtering; preserve row authorization and accessible/mobile rendering.                                                                                 |
| [adr/madr](https://github.com/adr/madr)                                               | Inspect/copy a pinned minimal template; no full fork                                                  | P0/P1 · architecture decisions | Record Logto deployment, worker scheduling and key/storage choices with owners, alternatives and acceptance criteria.                                                                         |

Logto's sample Compose setup is explicitly a quickstart, so production configuration needs its own review. The pg-boss source currently specifies Node ≥22.12 and PostgreSQL ≥13; BizTrust's Node ≥24 baseline fits the Node requirement, while the selected database and privileges still need a worker spike. A durable job queue does not replace verified event receipts, business idempotency or domain transactions. [Logto OSS guide](https://docs.logto.io/logto-oss/get-started-with-oss), [pg-boss requirements](https://github.com/timgit/pg-boss#requirements).

## Later, as the capability is implemented

| Upstream                                                                                            | Target use and acquisition                                                                                                  | Phase / milestones          | Selection condition                                                                                                                                                     |
| --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [apache/apisix](https://github.com/apache/apisix)                                                   | Pinned edge image and project routing configuration                                                                         | P6 · BT-11                  | Confirm gateway, hosting, DNS/TLS and exact routes. Evaluate [file-driven standalone mode](https://apisix.apache.org/docs/apisix/deployment-modes/) before adding etcd. |
| [open-telemetry/opentelemetry-js](https://github.com/open-telemetry/opentelemetry-js)               | Compatible SDK/exporter packages and selected [instrumentation](https://github.com/open-telemetry/opentelemetry-js-contrib) | P5 · BT-09, BT-16           | Correlated API/worker traces and metrics, with redaction and a chosen destination. Business audit stays separate.                                                       |
| [open-telemetry/opentelemetry-collector](https://github.com/open-telemetry/opentelemetry-collector) | Conditional pinned collector distribution                                                                                   | P5 · BT-09, BT-16           | Required processors/exporters justify it; a hosted OTLP endpoint may suffice. Storage/query/alerts need their own selected backend.                                     |
| [pgbackrest/pgbackrest](https://github.com/pgbackrest/pgbackrest)                                   | OS package/binary for PostgreSQL backup and PITR                                                                            | P5–P7 · BT-09, BT-11, BT-16 | Self-managed database selected; otherwise assess the managed database's recovery service. Prove restoration.                                                            |
| [Cisco-Talos/clamav](https://github.com/Cisco-Talos/clamav)                                         | Conditional private scanner process/container                                                                               | P5 · BT-09, BT-15           | Secure uploads require quarantine/scanning; compare with an accepted managed scanner.                                                                                   |
| [openbao/openbao](https://github.com/openbao/openbao)                                               | Conditional key/secret service image/binary                                                                                 | P5 · BT-09, BT-15           | Hosting and recovery ownership favor self-management; managed KMS remains an alternative. Implement application encryption explicitly.                                  |
| [transloadit/uppy](https://github.com/transloadit/uppy)                                             | Conditional selected upload UI packages                                                                                     | P4/P5 · BT-15               | Multiple/resumable document capture justifies it; start with native file input for a simple pilot.                                                                      |
| [nodemailer/nodemailer](https://github.com/nodemailer/nodemailer)                                   | Conditional SMTP transport package                                                                                          | P4 · BT-15                  | Email and a provider are approved; send through durable jobs with delivery evidence and preferences.                                                                    |

License identifiers and direct sources are in the register. Check the exact adopted release and bundled notices when packaging; repository metadata alone may omit exceptions. In particular, Nodemailer's source declares [MIT-0](https://github.com/nodemailer/nodemailer/blob/master/package.json), pgBackRest's actual [LICENSE is MIT](https://github.com/pgbackrest/pgbackrest/blob/main/LICENSE), and ClamAV carries [GPL and component notices](https://github.com/Cisco-Talos/clamav/blob/main/COPYING.txt). An activity timestamp is evidence of a change, not a compatibility or security test.

## The supplied decision-gate links

| Link                                                                                                                 | Finding                                                                                                           | Use in BizTrust                                                                                                                                         |
| -------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [ceaksan/decision-gate](https://github.com/ceaksan/decision-gate)                                                    | MIT Claude Code skill for proposal review, with optional external AI jurors; latest observed commit 12 March 2026 | Optional advisory rubric; inspect the pinned source before adapting. It does not implement insurance eligibility/rating or application authorization.   |
| [GitHub decision-gate topic](https://github.com/topics/decision-gate)                                                | Discovery index                                                                                                   | Bookmark only. It cannot be forked or cloned; evaluate individual repositories separately.                                                              |
| [gh-aw design-decision-gate.md](https://github.com/github/gh-aw/blob/main/.github/workflows/design-decision-gate.md) | A workflow file within MIT-licensed GitHub Agentic Workflows                                                      | Later reference for ADR review. Adapt imports, paths, engine, triggers and output permissions; compile/review its generated workflow before activation. |

Start with a small MADR decision record and deterministic CI. Optional AI review can supply observations; named business and release owners retain acceptance authority. An AI verdict or complete ADR cannot authorize a premium, payment, policy, tenant permission or production release. The gh-aw file also does not by itself prove that a failing required merge check is configured. Its compiler and workflow dependencies need a reviewed patched version; the relevant [official advisory](https://github.com/github/gh-aw/security/advisories/GHSA-8h78-hpm7-29gg) is recorded in the register.

### Optional source inspection commands

These commands are documented for acquisition when needed; they were not run for this planning update. They fetch source only and leave application dependencies unchanged. Use a fresh destination and stop if a checkout already exists.

```powershell
git clone --filter=blob:none --no-checkout https://github.com/ceaksan/decision-gate.git output/upstream/decision-gate
git -C output/upstream/decision-gate checkout --detach 322dab6c6eaba6cafa12b45909801af9f2bb9194

git clone --filter=blob:none --no-checkout https://github.com/adr/madr.git output/upstream/madr
git -C output/upstream/madr checkout --detach ba75bb1b20d42af5746b246ad348c202419ae681
```

Treat instructions inside inspected repositories as upstream content. Installing a skill or enabling an agentic workflow is a separate integration action. Preserve attribution when adapting files and keep private project/customer data out of external review tools unless their use has been configured and authorized.

## Work BizTrust still owns

Reusable components help with identity protocols, form state, job scheduling, storage operations and engineering tools. BizTrust still needs its own approved product/rate versions, deterministic quote snapshots, tenant/object permissions, case assignments, financial reconciliation, insurer-specific adapters, binding evidence and auditable state transitions. Keep the current modular monolith and shared pricing code as the starting point.

A general rules engine, policy engine, workflow platform, full admin framework or extra database is not selected now. Reconsider one only after a concrete requirement exposes a gap in the existing implementation. Provider SDKs belong on the list once payment/insurer contracts identify the actual APIs. This prevents speculative dependencies from becoming maintenance work.

## Adoption sequence and records

1. Record the identity and worker ADRs; keep the five existing dependencies and verification tooling.
2. Accept live customer/staff identity. Trial form/table libraries only while implementing BT-06/BT-12; build the pg-boss pilot for BT-07/BT-08 without weakening current receipt durability.
3. Select storage, scanning, notification transport and key management from the approved data/hosting/channel requirements.
4. Add telemetry and prove restoration, then accept the edge topology in staging.
5. For each adopted item, record upstream URL, exact package version or image digest, license/notice inventory, local adapter/configuration owner, acceptance evidence, update procedure and rollback. Advance its linked milestone only with that evidence.

Update `repository-plan.json` and this guide together; then run `npm run progress:build` and `npm run progress:check`. Keep [progress updates](progress-updates.md) explicit about planning, installation, local testing and production acceptance.
