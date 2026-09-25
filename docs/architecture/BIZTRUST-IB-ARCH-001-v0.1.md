# BIZTRUST-IB-ARCH-001 — Insurance Brokerage Platform Architecture & Engineering Master Prompt

## Document control

| Field | Value |
|---|---|
| Artifact | BIZTRUST-IB-ARCH-001 |
| Version | 0.1 |
| Status | Draft for repository discovery and implementation |
| Target repository | bstBizEra/biztrust_ib |
| Product | BizTrust online insurance brokerage platform |
| Intended use | Master prompt and architecture specification for Codex, Claude Code, and coordinated engineering agents |
| Local project path supplied by the owner | C:\laragon\www\biztrust_ib |
| Brand assets supplied by the owner | D:\Works\BizTrust\Brandkits\Logo |
| Brand guide supplied by the owner | D:\Works\BizTrust\Brandkits\BizTrust_Brand_Identity_Guide_v1.0.md |

The repository currently has only a short README. Treat the application framework, database, deployment target, payment provider, insurer interfaces, and available test scripts as unknown until the repository and its connected reference projects have been inspected. Do not present assumptions as existing implementation facts.

## 0. Master instruction to implementation agents

You are the product engineering team for BizTrust Insurance Broker. Deliver a secure, responsive, professional online insurance brokerage experience that lets customers compare available insurance products, select an appropriate variant, submit a proposal, pay through a trusted QR-enabled payment flow, and track the insurer's processing result.

The value proposition is **One Stop Insurance Solution — Compare & Buy**. The platform operates as a broker and distribution channel connecting customers, agents, brokers, insurers, and authorized service providers. Keep brokerage activity, insurer decisions, payment settlement, and policy issuance clearly separated in the domain model and user experience.

Work from repository evidence. Begin by mapping the current source tree, branch and CI configuration, framework manifests, existing identity implementation, and available reference projects. Record findings and unresolved choices before scaffolding. Reuse the existing Logto-based identity clone or integration where it exists; do not introduce a second account system to work around it. Align with governing BizTrust architecture decisions already present in the project. The expected baseline is Logto-compatible OIDC/OAuth 2.1 identity, APISIX as the API gateway, PostgreSQL row-level security where PostgreSQL is used, and documented OpenAPI contracts for payment and insurance integrations. Confirm each item against current project artefacts before implementation.

Use the supplied brand guide and logo files on the owner's workstation. Preserve the approved logo files. Do not redraw, distort, recolor, or invent a substitute logo. If the guide differs from any remembered brand cues, the guide is authoritative. Known BizTrust cues to verify against the guide include the shield/bridge/BT concept, deep teal #0B9275, charcoal #252C34, and the #69C6B5 to #3DB389 gradient.

### Non-negotiable engineering rules

1. Preserve the P0 security invariant: **Identity → Tenant Context → Authorization → Database Isolation → Audit Evidence**. Demonstrate cross-tenant isolation before enabling business workflows.
2. Use least privilege, fail-closed authorization, explicit ownership, and auditable state changes.
3. Do not bind coverage, promise policy issuance, or represent a quotation as final cover unless an authorized insurer binding agreement and the required evidence are present.
4. Keep pricing, eligibility, underwriting, payment confirmation, and insurer status decisions deterministic, versioned, and testable. Generative AI may assist staff with drafting or search only; it must not silently make binding insurance or payment decisions.
5. Do not place insurer or payment credentials in source, prompts, browser code, test fixtures, screenshots, or agent context.
6. Make ordinary development, lint, test, and verification commands executable by an engineering agent without interactive permission prompts. Never let an agent run destructive commands against production or real financial data.
7. Prefer a modular, layered implementation with explicit boundaries. Start with a modular monolith unless measured operational needs or an approved architecture decision justify separate services.
8. Build on the existing stack where it is sound. Document material changes in Architecture Decision Records (ADRs) instead of silently replacing platform choices.
9. Keep interfaces and test fixtures deterministic. Use insurer and payment sandboxes or local simulators in development and CI; never use live payment or policy issuance in automated tests.
10. Treat a public localhost tunnel as a temporary demonstration surface, not as a production hosting strategy.

Use MUST, SHOULD, and MAY in the usual normative sense. When a dependency, authority, or business rule is unknown, create a tracked decision with an owner and evidence needed. Do not fabricate insurer products, prices, payment success, legal approval, or customer information.

## 1. Architecture domain — Product objective, scope, and operating model

Define the business capabilities and boundaries that make BizTrust an online brokerage platform. Describe the value for end customers, agents, brokers, insurers, operations, and business administrators.

Specify what is in the first release and what is deferred. Keep product lines, insurer participation, distribution rights, commissions, service fees, and customer eligibility configurable and supported by evidence. Do not assume which insurance lines are approved for launch.

**Required outcomes:** a concise product brief; measurable business and customer outcomes; MVP scope and exclusions; operating assumptions; key dependencies; a glossary using broker-side terms such as Submission, Quote, Binding Authority, Coverage Confirmation Evidence, and Policy.

## 2. Architecture domain — Actors, authority, and tenant boundaries

Model the platform's stakeholders and the authority each may exercise: customer, agent, broker, insurer operator, finance/operations, support, tenant administrator, platform administrator, and engineering agent. Distinguish platform-level access from tenant-scoped access.

Define who can view, create, amend, recommend, submit, approve, reconcile, issue, cancel, refund, and export each record. Record the insurer, broker, agent, and customer relationship for every transaction. A user must not gain access to another tenant's customer, quote, submission, payment, or policy by changing an identifier.

**Required outcomes:** actor and permission matrix; tenant lifecycle and context contract; authority and delegation rules; audit events for privileged actions; negative tests for cross-tenant and cross-role access.

## 3. Architecture domain — Customer journey, information architecture, and service states

Implement and test this primary journey:

1. Customer opens the responsive web experience and selects an available insurance product.
2. Customer compares product variants using clear coverage, exclusions, limits, premiums, fees, and service terms.
3. Customer selects a variant. Preserve the selection while the customer signs in or creates an account through the existing Logto-based identity flow.
4. Customer enters and reviews the information required for an indicative quote or insurer submission. Collect only fields required for that product and purpose.
5. Present broker disclosures, insurer-specific notices, consent, premium and fee breakdown, and the applicable quotation conditions before submission.
6. The server validates the request and creates a durable application/submission reference. A repeated submit must not create duplicate cover or payment instructions.
7. Return a human-readable reference ID and a QR payment instruction linked to a server-owned invoice or payment intent, with amount, currency, expiry, and current status visible.
8. Confirm payment from a verified payment-provider event or server-to-server status check. A browser redirect or rendered QR image alone is not proof of payment.
9. Send the submission to the authorized insurer adapter and show insurer processing states, requests for additional information, rejection, or policy issuance as separate outcomes.
10. Let the customer revisit the reference to track status and retrieve only documents they are authorized to access.

Model quote, submission, payment, and policy as related but separate state machines. Include expiry, retries, duplicate requests, payment failure, delayed webhooks, insurer timeout, referred cases, cancellation, refund, and reconciliation paths. Define notification content and escalation ownership for each non-happy path.

**Required outcomes:** journey maps for customer, agent, and operations; state-transition tables; information architecture; annotated loading, success, empty, error, expiry, and retry states; testable acceptance criteria.

## 4. Architecture domain — UX/UI design system and brand implementation

Deliver a high-quality insurance and financial-services interface that feels considered and trustworthy. Use the supplied brand guide, logo, typography, colors, spacing, iconography, and image rules. Preserve the logo assets as supplied and record their source in the project.

Create reusable tokens and components for navigation, product cards, comparison tables, form fields, consent, price breakdowns, status badges, reference IDs, QR payment instructions, alerts, dialogs, and responsive navigation. Make the product comparison usable on mobile without hiding meaningful differences. Provide visible focus states, keyboard operation, readable error messages, sufficient contrast, and accessible labels.

Support Lao and English through locale-ready content keys and typography. Confirm exact fonts, copy, currency display, number/date formats, translations, and legal wording with the owner or source artefacts; do not invent them.

Avoid generic AI-generated visual patterns: no ornamental gradients, glass cards, random icon mixtures, decorative dashboards, repeated marketing claims, stock imagery presented as a real insurer or customer, or placeholder text in production screens. Use hierarchy, alignment, restrained color, meaningful whitespace, precise product content, and realistic interface states. Do not make a mockup look live by inventing quotes, partner logos, claims ratios, or coverage promises.

**Required outcomes:** brand token inventory; component and page inventory; responsive behavior from narrow phones through desktop; design review checklist; source attribution for every supplied brand asset.

## 5. Architecture domain — Insurance product catalogue and comparison

Represent products as structured, versioned data rather than product-specific UI conditionals. A product and each variant must identify its insurer, distribution tenant, eligibility, coverage, limits, exclusions, excess/deductible, premium calculation inputs, fees/taxes where applicable, documents, effective dates, availability, and quotation conditions.

Normalize comparable facts for side-by-side comparison while retaining insurer wording and the source of every material term. Explain comparison filters and ranking. Any recommendation must state its basis and must not conceal material limitations or imply that the cheapest option is necessarily best.

Keep product catalogue publication separate from quote calculation. Expired, withdrawn, or unauthorized variants must not be offered for new submissions. Preserve the product/rule version used for each quote and application.

**Required outcomes:** catalogue schema; version and effective-date strategy; comparison rules; sample fixtures marked as synthetic; catalogue validation and publication controls.

## 6. Architecture domain — Quote, submission, broker authority, and policy lifecycle

Define distinct records and transitions for a quote, customer application, insurer submission, insurer response, broker decision, coverage confirmation, and policy. Make the source of each response explicit and preserve timestamps, actor, tenant, insurer, product version, rule version, and evidence.

Support asynchronous insurer processing. A quote may expire; a submission may be under review or referred; a policy may be issued only from authoritative insurer evidence or a documented binding-authority workflow. Preserve insurer references and issued documents without allowing one insurer's state to overwrite another's.

Use transactional boundaries and idempotency for submit, retry, and callback flows. Provide traceable status history, correction handling, and reconciliation for records that cannot be resolved automatically.

**Required outcomes:** lifecycle state machines; event and evidence contracts; authority checks; audit history; idempotency and recovery design; policy document access controls.

## 7. Architecture domain — Identity, authentication, authorization, and tenant context

Reuse the repository's Logto clone or approved Logto integration. Inspect the existing implementation and the designated reference project before changing sign-in, sign-up, account linking, callback, token, session, logout, or role mapping. If a reference is needed, the owner has mentioned C:\laragon\www\unitrust as an example local project path; confirm that it is the correct source before copying patterns. Never copy secrets, production data, or private signing material from a reference project.

Use standards-based OIDC/OAuth flows and validate issuer, audience, signature, expiry, nonce/state, redirect URI, and scopes. Establish tenant context server-side from an authorized membership or transaction context; never trust a tenant ID supplied only by the browser. Separate customer, agent, broker, insurer, and platform-administrator privileges. Use MFA or stronger controls for privileged staff and administrative access where supported.

**Required outcomes:** identity sequence and configuration map; role and tenant claims contract; session and token rules; provisioning/deprovisioning behavior; authentication and authorization tests; documented handling for account recovery and suspected compromise.

## 8. Architecture domain — Eligibility, pricing, recommendation, and decision engine

Create a deterministic decision service with named inputs, outputs, reason codes, rule version, effective period, and evidence source. Separate product eligibility, premium calculation, comparison ranking, referral triggers, fraud/risk flags, and insurer underwriting decisions. Retain the exact version and inputs needed to reproduce a quote.

Rules must be reviewed against approved product/insurer material, have boundary tests, and support a controlled activation/rollback path. Unknown or incomplete inputs should return a clear “needs information” or “refer” result. They must not be silently treated as approval. Broker recommendations must disclose criteria and preserve customer choice.

AI-generated content may help explain a deterministic result only when the explanation is checked against the actual result and approved content. AI must not invent a premium, eligibility outcome, insurer acceptance, binding authority, or policy status.

**Required outcomes:** rule catalogue and ownership; version/effective-date model; reason-code taxonomy; decision audit; golden test vectors; safe rule activation and rollback procedure.

## 9. Architecture domain — Payment, invoicing, QR, refunds, and reconciliation

Keep payment intent and invoice creation on the server. Bind each payment instruction to a BizTrust reference, amount, currency, expiry, tenant, and provider transaction identifier. Protect against replay, duplicate callback delivery, amount changes, stale QR instructions, and cross-customer disclosure.

Verify payment through provider signatures or authenticated server status checks. Make callback processing idempotent; retain raw evidence only under an approved retention policy and store a normalized event for application logic. Separate payment authorization, capture/settlement, fees, refunds, and reconciliation. Do not mark a submission paid because the browser reports success.

Use a sandbox or deterministic mock for development and CI. Provider choice, settlement rules, fees, refund authority, and financial reconciliation ownership are explicit decisions until confirmed.

**Required outcomes:** payment-provider adapter contract; QR/invoice lifecycle; signed callback and replay strategy; payment ledger and reconciliation report; failure, expiry, duplicate, and refund tests.

## 10. Architecture domain — Insurer, broker, and partner integrations

Use an adapter per insurer or partner behind a stable BizTrust contract. Map product, quote, submission, customer, document, and status fields explicitly. Preserve the insurer's original reference and response evidence. Support asynchronous callbacks or polling based on documented partner capability, with signature validation, timeout, retry, deduplication, and dead-letter handling.

Use separate development, sandbox, staging, and production credentials and endpoints. Do not simulate an insurer's acceptance as real acceptance. When no sandbox exists, use clearly labeled synthetic fixtures and a controlled manual test plan.

**Required outcomes:** partner inventory; integration capability matrix; adapter and error contract; sandbox setup guide; status mapping; monitoring and reconciliation runbook.

## 11. Architecture domain — API, events, and contract versioning

Define stable, authenticated APIs for web and future mobile clients. Document payment and insurance interfaces with OpenAPI. Version contracts deliberately; use compatibility checks and deprecation windows. Return typed errors with safe customer messages and traceable support codes.

Use asynchronous events for insurer responses, payment notifications, and long-running processing where suitable. Validate webhook signatures and timestamps, reject replay, deduplicate by provider event ID, and retain correlation IDs end to end. Use a transactional outbox or equivalent reliability pattern if events are written alongside domain state.

**Required outcomes:** API inventory; OpenAPI specifications; event schemas; compatibility tests; idempotency rules; webhook authentication and replay tests.

## 12. Architecture domain — Data, records, documents, and analytics

Define clear data ownership for customer identity, broker records, insurer submissions, payments, policies, consent, documents, audit events, and aggregate analytics. Apply least data collection, classification, purpose limitation, retention, secure deletion, and export controls. Confirm applicable data handling and retention obligations with the responsible business/legal owner rather than guessing.

Keep tenant ID and access scope on every tenant-owned record. When PostgreSQL is the approved store, enforce row-level security in the database in addition to application authorization. Set tenant context transaction-locally and test pooled connections, background jobs, exports, and support access for context leakage. Keep audit records append-only or tamper-evident and restrict access.

Do not log full identity documents, credentials, payment secrets, or unrestricted personal data. Use synthetic fixtures. Separate operational events from analytics datasets; report aggregate funnel, quote, payment, and insurer-processing measures with documented definitions.

**Required outcomes:** data classification and lineage; logical model; tenant-isolation plan; migration and backup strategy; retention schedule decision; audit and analytics definitions.

## 13. Architecture domain — Application layers, modularity, and deployment shape

Keep responsibilities explicit:

| Layer | Responsibility |
|---|---|
| Experience | Responsive web/PWA screens, accessibility, locale, customer and staff journeys |
| Edge | TLS, routing, rate limits, request IDs, gateway policy; use APISIX if confirmed as the platform gateway |
| Identity and access | OIDC integration, sessions, authorization, tenant context |
| Application | Use cases, orchestration, transactions, idempotency, notifications |
| Domain | Product, quote, application, broker authority, payment, insurer response, policy, consent, audit rules |
| Integration adapters | Insurer, payment, messaging, document, and identity-provider protocols |
| Data | Domain-owned persistence, migrations, row-level isolation, audit, reporting |
| Runtime operations | Configuration, secrets, queues, jobs, health, metrics, logs, backup, recovery |

Prefer domain modules with stable interfaces over a distributed system created in advance. Keep provider-specific code outside domain logic. Scale stateless web/API workloads horizontally; use queues for partner calls and long-running work; use caching only for data with explicit invalidation and privacy rules. Split a module into a service only when ownership, load, reliability, or deployment evidence supports the added operational cost.

**Required outcomes:** context and container diagrams; module ownership map; dependency rules; deployment topology for development, test, staging, and production; documented ADRs for material choices.

## 14. Architecture domain — Security, resilience, observability, and operational control

Create a threat model covering account takeover, tenant escape, insecure document access, forged payment notifications, replay, malicious uploads, API abuse, insider access, data leakage, supply-chain compromise, and prompt/agent instruction injection. Use secure defaults, input validation, rate limits, safe file handling, TLS, secret management, dependency scanning, and redacted structured logs.

Provide request/trace correlation across browser, API, payment provider, and insurer adapter. Monitor availability, latency, errors, queue age, insurer response time, payment mismatches, duplicate events, abandoned submissions, and policy status reconciliation. Define alert ownership and runbooks. Set service-level objectives and recovery objectives with the owner after expected volumes and operating hours are known.

Backups must be encrypted and restoration tested. Design for graceful degradation: display clear pending states during provider outage; do not fabricate success; allow safe retries and staff reconciliation. Security, financial, and tenant-isolation incidents must have a documented containment and evidence-preservation process.

**Required outcomes:** threat model; security checklist; secret and environment strategy; observability dashboards and alerts; backup/restore test; incident and rollback playbooks; open decisions for applicable local compliance review.

## 15. Architecture domain — Engineering lifecycle, testing, CI/CD, Git, and multi-agent autonomy

### Repository and Git workflow

Keep source, migrations, tests, design tokens, API contracts, deployment configuration, and documentation version-controlled. Use short-lived branches, clear task ownership, Conventional Commit messages, versioned releases, and protected default-branch rules. Give agents scoped repository access; never share personal access tokens in prompts. Record architectural changes as ADRs.

Parallel agents must work from a task graph with explicit files or modules, contracts, acceptance tests, and dependencies. Use isolated branches or worktrees. Assign one owner per shared file. Agree on API/event contracts before backend and frontend work diverges. Have a designated integration agent reconcile changes; do not let parallel agents overwrite each other's working tree or silently resolve domain conflicts.

### Agent roles and delivery cycle

Use specialist agents for product requirements, architecture, UX, backend/domain, web/mobile, insurer/payment adapters, security, QA/automation, and release/operations. A lead orchestrator maintains the backlog, dependency graph, decisions, test evidence, and release state. Agents report changed paths, assumptions, tests run, test results, and unresolved risks.

Automate the normal delivery cycle from request to production within owner-approved boundaries:

1. Discover repository, governing artefacts, current branch, build commands, and open risks.
2. Turn scope into small tasks with acceptance criteria, dependency edges, and named owners.
3. Draft or update architecture decisions and contracts before parallel implementation.
4. Implement on isolated branches; run focused tests for each task.
5. Integrate continuously and run the full verification suite, tenant-isolation checks, security checks, and browser journey tests.
6. Deploy to an isolated staging environment, run smoke and migration checks, and collect evidence.
7. Merge, tag, and deploy automatically when all repository policy gates pass.
8. Verify health and business events after release; roll back automatically on defined failure signals and preserve the audit trail.

No agent may approve its own security exception, edit protected production secrets, grant itself additional permissions, or alter production insurance/pricing authority. Configure deterministic policy gates in advance so routine, in-scope changes can pass to production without a person manually operating every step. Stop and escalate only when a change exceeds the pre-authorized boundary, a required business fact is missing, or a safety/quality gate fails.

### Test commands and quality gates

First inspect the existing manifests and scripts. Add or normalize one documented root-level verification command that runs the appropriate checks for the selected stack, and make it usable both locally and in CI. Provide stable task names for verification, unit tests, integration tests, browser end-to-end tests, lint, type checks where applicable, formatting, and security checks. Document the exact command syntax in the repository README or contributor guide; do not leave example or guessed commands as the only instructions.

The owner authorizes agents to run repository test commands without asking each time. Run focused tests during implementation and the full verification command before merge. Tests must cover:

- Domain rules, quote calculation, decision versioning, and state transitions.
- Authentication, tenant context, role boundaries, and cross-tenant database isolation.
- OpenAPI and event contract compatibility.
- Payment QR expiry, signatures, duplicate and delayed callbacks, amount mismatch, and reconciliation.
- Insurer adapter timeouts, retries, duplicate responses, referral, rejection, and issue evidence.
- Customer journey end to end on desktop and mobile viewports, including empty, loading, validation, failure, pending, and retry states.
- Responsive layout, keyboard operation, accessible labels, focus, and error recovery.
- Security scanning, dependency and secret checks, migration safety, and backup/restore where configured.

CI MUST run deterministic tests without production credentials or live financial transactions. Keep test data synthetic and resettable. The verification command must fail on an unmet required gate and return a useful failure code and report.

### CI/CD and release controls

Use repository-hosted CI to run formatting, lint, types, unit and integration tests, contract checks, browser tests, security/dependency/secret scanning, and migration validation. Build once and promote the same immutable artifact through staging and production. Use short-lived workload identity or an approved secret manager for deployment credentials. Do not store secrets in GitHub source or public development tunnels.

Use database changes compatible with rolling releases. Gate production deployment on successful staging smoke tests, migration safety, health checks, and preconfigured policy. Support feature flags, canary or staged rollout where available, automated health verification, and rollback to the last known-good release. Record release version, commit SHA, migration set, test evidence, and deployment result.

### Local development and temporary public preview

Target the owner's supplied Windows/Laragon project path when working on that workstation. Document prerequisites, environment setup, seed/demo data, start command, test command, and reset procedure. Keep secrets in an ignored local environment file and provide a safe example file.

If a temporary online review of a localhost build is useful, use VS Code's Ports panel to forward the actual development-server port and set that forwarded port's visibility to Public. Share only the HTTPS forwarded URL. Public visibility means anyone with the URL may reach the forwarded service. Use synthetic data and development-only credentials; never expose database, queue, admin, or production payment/identity services. Confirm redirect origins for the temporary preview, and remove the public forwarding entry when the review ends. This preview is not a production release.

## Cross-domain acceptance criteria

The architecture and implementation are ready for a production-readiness review when:

- Product selection, variant comparison, login continuity, information capture, submission, reference ID, QR payment, payment verification, insurer processing, and status tracking work as one traceable customer journey.
- The web experience is mobile-ready, brand-aligned, usable in Lao and English when approved translations are supplied, and has complete operational states.
- Identity, tenant context, authorization, row-level isolation, and audit evidence pass negative tests before cross-tenant workflows are enabled.
- Quotes, payments, insurer decisions, and policies are separate, versioned, auditable records; coverage is not represented as bound without documented authority.
- Insurer and payment adapters use sandbox/mock contracts in CI and have documented production configuration.
- A single documented verification command runs locally and in CI; an agent can run it and report evidence without interactive prompting.
- Git branches, commits, release tags, CI gates, staging, deployment, health verification, and rollback are documented and reproducible.
- The multi-agent workflow permits parallel work without shared-file conflicts and can automatically deliver approved changes through production gates.
- No secrets, live personal data, fabricated product facts, or unverified insurer/payment outcomes are committed or shown.

## Recommended implementation roadmap

**Stage 0 — Discovery:** inventory the repo, locate the Logto clone and reference architecture, inspect the supplied brand guide on the owner's workstation, confirm stack and test commands, list unknowns, and write ADRs.

**Stage 1 — P0 trust foundation:** identity, tenant context, authorization, database isolation, audit, CI baseline, synthetic test fixtures, threat model, and cross-tenant proof.

**Stage 2 — Catalogue and comparison:** product/variant data, approved brand system, responsive browse and compare experience, locale readiness, and deterministic quote rules.

**Stage 3 — Application and payment:** customer information and consent, idempotent submission, reference ID, invoice and QR, verified payment events, status tracking, and reconciliation.

**Stage 4 — Insurer processing:** partner adapters, sandbox, async status handling, documents, exception operations, and evidence-backed policy outcomes.

**Stage 5 — Scale and improve:** agent and broker operations, renewals, endorsements, cancellation/refunds, claim assistance, analytics, and new insurer/product integrations after business authorization.

## Additional recommendations

- Show a normalized coverage comparison with exclusions and limits visible, plus source wording for verification.
- Add saved quotes and resumable applications without retaining unnecessary personal data.
- Add renewal reminders, endorsement requests, cancellations, refund tracking, and broker-supported claims assistance as later capabilities.
- Provide operations views for submissions needing attention, insurer SLA ageing, payment reconciliation, document requests, and unresolved exceptions.
- Track funnel conversion, quote turnaround, payment completion, insurer processing time, referral rate, abandonment, and support resolution with precise metric definitions.
- Decide in advance which change classes are safe for autonomous production release and which require a business, insurer, finance, security, or legal authority to approve.
- Confirm product owners, licensed brokerage scope, binding authority, payment provider, insurer sandbox access, settlement and refund ownership, service levels, hosting, data retention, localization, and applicable local compliance requirements before production launch.

## Required first response from an implementation agent

Before making broad code changes, return a compact discovery report containing: repository and framework inventory; current runnable commands; existing authentication/Logto integration and tenant model; brand artefacts found; CI/CD and deployment status; test and security baseline; missing business/integration decisions; proposed module map; P0 risks; and the first independently testable implementation slices. Then begin implementation in small, verifiable increments under this specification.