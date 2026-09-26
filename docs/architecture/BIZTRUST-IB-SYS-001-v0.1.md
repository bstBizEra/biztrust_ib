# BIZTRUST-IB-SYS-001 — Operations Console, Integration APIs & Encryption Architecture

## Document control

| Field | Value |
|---|---|
| Artifact | BIZTRUST-IB-SYS-001 |
| Version | 0.1 |
| Status | Proposed companion design |
| Parent specification | BIZTRUST-IB-ARCH-001 |
| Target repository | bstBizEra/biztrust_ib |
| Scope | Broker operations UX, system management, payment/insurer API contracts, encryption and key management |

This document makes the backend system-management experience and integration/security requirements concrete. It complements BIZTRUST-IB-ARCH-001; it does not replace the project’s governing architecture decisions. Provider names, credentials, insurance products, legal obligations, hosting/KMS, and local data-retention requirements remain owner-confirmed decisions.

## 1. Design objective and system boundary

BizTrust needs two coordinated experiences:

- **Customer and distribution experience:** product discovery, comparison, quote/application, payment, and tracking for customers, agents, and brokers.
- **Operations console:** controlled workbench for catalog administrators, broker operations, insurer liaison, payment reconciliation, customer support, security administrators, and auditors.

Keep the operations console on a separate application route or domain with a separate identity client/audience from the customer experience. A hostname such as an admin or operations subdomain is a candidate only; confirm DNS, hosting, and identity configuration before adopting it. The console must use the same authoritative domain services and tenant authorization as the customer experience. It must not connect directly to production tables or bypass APIs.

The target flow is:

| Flow | Design |
|---|---|
| Customer/agent request | Browser → APISIX or confirmed edge gateway → authenticated application API → domain modules |
| Staff operation | Operations console → separate staff API audience → role and tenant checks → authorized case/configuration use case |
| Payment event | Provider webhook ingress → signature/mTLS verification → durable event inbox → idempotent processing → payment state and audit |
| Insurer event | Insurer webhook or scheduled status poll → adapter validation and mapping → durable event inbox → submission/policy state and audit |
| Data protection | Authorization and tenant scope → row-level isolation → classified encrypted storage → restricted key service |

Payment and insurer calls originate from backend adapters. A customer browser must never call an insurer endpoint or create a trusted payment status directly.

## 2. Operations console UX/UI

### 2.1 Navigation and workspaces

Use a stable navigation model with tenant context always visible and a clear distinction between tenant and platform scope.

| Workspace | Main functions |
|---|---|
| Overview | Work queues, integration health, ageing, reconciliation exceptions, service alerts |
| Cases | Applications, quotes, submissions, document requests, insurer responses, policy outcomes |
| Product catalogue | Insurers, products, variants, terms, comparison attributes, effective dates, publication history |
| Decision rules | Rule versions, test vectors, simulation results, approval and activation history |
| Payments | Payment intents, QR expiry, provider callbacks, reconciliation, refunds and mismatches |
| Integrations | Insurer/payment adapter status, sandbox configuration status, schema versions, callback failures |
| Organizations and access | Tenants, brokers, agents, memberships, role assignments, service identities |
| Documents | Requested, received, scanned, classified and access-audited documents |
| Audit and reporting | Evidence trail, policy changes, exports and approved operational metrics |
| System health | Queues, job failures, retry/dead-letter queues, deployment and key-rotation health indicators |

The console may show key versions and rotation state, but MUST never display encryption keys, signing private keys, client secrets, provider secrets, or full payment credentials. Key administration belongs in the approved key-management service with separate privileged access.

### 2.2 Role and permission model

Use capability-based authorization with tenant scope, object scope, and action scope. Enforce permissions in backend use cases even when the UI hides or disables an action.

| Role | Typical access | Explicit restrictions |
|---|---|---|
| Broker/tenant administrator | Tenant users, products visible to that tenant, operational settings | Cannot inspect or edit another tenant’s records or platform secrets |
| Agent | Assigned customer cases and permitted submissions | Cannot publish products, change decision rules, reconcile money, or grant roles |
| Broker operations | Assigned submissions, insurer requests, document follow-up | Cannot mark a payment paid or change underwriting/rating authority |
| Finance/reconciliation | Payment ledger, provider evidence, reconciliation and refund workflow | Cannot change quote/rule/product terms or issue a policy |
| Customer support | Limited customer case status and approved contact details | Sensitive documents and full identifiers masked by default; no money or coverage decisions |
| Insurer liaison | Assigned insurer submissions and responses | Access limited to the authorized insurer and assigned tenant scope |
| Security administrator | Access policy and security event workflows | No access to customer financial decisions solely from security-admin status |
| Auditor | Read-only, scoped evidence and export under policy | No state-changing actions |
| Platform operator | Health, configuration status and incident response | No routine access to plaintext customer documents or insurer/payment secrets |

No role grants unrestricted access to all data by default. Support access should be time-bounded and justified. Do not implement a “login as customer” feature. If emergency break-glass access is required, use a separate, expiring, audited workflow with reason, notification, and post-event review.

### 2.3 Screen specifications

**Operations overview**

- Show counts with data timestamp and defined status meaning: submissions awaiting action, insurer responses past target, payment pending/expired, unreconciled items, failed integration events, and document requests.
- Link each indicator to a filtered queue. Use empty states that explain the next operational step.
- Display integration health separately from business-case status. A green service-health signal must not imply a successful payment or insurer decision.

**Case workbench**

- Search primarily by reference ID, insurer reference, or scoped account identifier. Mask personal identifiers and restrict exact PII search to roles with a defined need.
- Show a status header, tenant, product/version, owner, age, next action, and evidence timestamp.
- Present a chronological activity timeline of customer submission, rule result, payment intent, verified callback, insurer request/response, staff action, and document access.
- Keep source and authority visible for every consequential status: customer action, BizTrust rule result, payment provider, insurer, or staff action.
- Put allowed actions in a side panel; show why an unavailable action is blocked. Require reason and confirmation for corrections. Do not provide a generic force-status button.
- Include safe retry only when the underlying operation is idempotent. Show the previous attempt, correlation/reference IDs, and whether the next action can create an external financial or insurer side effect.

**Product and decision management**

- Edit draft product versions and rules outside production. Provide a diff, effective date, source evidence, validation results, and impact preview before publication.
- Run deterministic examples against approved test vectors. Display which quote outputs change and why.
- Activate an immutable, versioned release with a rollback target. Do not edit live rates, coverage terms, eligibility, or underwriting rules in place.
- Require the configured business authority for product/decision publication. Record the approver, evidence, version, and activation timestamp.

**Payment operations**

- Show payment-intent amount/currency, BizTrust reference, provider reference, expiry, verified event history, and reconciliation status. Mask provider identifiers that function as credentials.
- Separate pending, confirmed, failed, expired, refunded, and mismatch states. Status derives from verified provider evidence and internal ledger rules.
- Never expose “mark paid.” A correction workflow must reconcile provider evidence and the ledger; a manual adjustment requires a reason, evidence attachment/reference, authorized finance role, and a second approver where the owner’s policy requires it.
- Refund and settlement actions must be separate, permissioned, idempotent, and auditable.

**Integration operations**

- Display adapter name, environment, health, last successful call, queue age, failure category, and schema/version.
- Allow an operator to retry a failed event only when the adapter identifies it as safe; use the same idempotency key and event identity.
- Provide a redacted payload view and a controlled evidence view. Raw request/response bodies require explicit access, reason, time limit, and audit trail.
- Show credential status and next rotation due date, never the credential value. Secret changes happen through a separate approved secret-management workflow.

**Access and audit**

- Show user identity, tenant memberships, role, status, MFA/security posture when available, grantor, expiry, and last meaningful access.
- Require step-up authentication for privileged role grants, refunds, data exports, and high-impact configuration changes.
- Provide append-only audit records with actor, tenant, object, action, reason, timestamp, source, correlation ID, and before/after references. Store sensitive values as masked values or cryptographic digests where needed, not as plaintext copies in the audit event.
- Export only a scoped, minimal dataset. Log who requested and downloaded each export.

### 2.4 Interaction and visual quality

Use a clear enterprise workbench rather than a marketing dashboard: compact but readable tables, meaningful status labels, predictable filters, saved views, keyboard-accessible controls, visible focus, and useful error recovery. Make status understandable without color alone. Design desktop-first for dense operational work while keeping case status and safe actions usable on tablet and mobile.

Follow the supplied BizTrust brand guide and logo assets on the owner’s workstation. The guide is authoritative for font, colors, iconography, spacing, and logo placement. Keep customer PII out of screenshots and demo data. Prototype screens must label synthetic data and must not fabricate insurer responses, payment success, or customer metrics.

## 3. API architecture and contract rules

### 3.0 Identity provider: official Logto

Use the official upstream Logto project at https://github.com/logto-io/logto as BizTrust's identity provider. BizTrust applications are OIDC clients; they consume Logto's supported OIDC endpoints and SDK/integration guidance for the selected framework. Do not copy Logto's server source into the BizTrust application, query its internal database, or build a second password/token system.

Choose Logto Cloud or a separately operated self-hosted Logto service in a documented ADR. For self-hosting, pin a supported version and define its own upgrade, backup, monitoring, availability, incident, and recovery responsibilities. Register separate customer and staff clients with exact callback URLs and environment-specific settings. Keep the staff console audience and access policy separate from customer journeys.

Use Logto Organizations and organization roles/scopes when they fit the broker/insurer/agent organization model and are supported by the deployed release. Treat Logto as the identity and organization-membership source; BizTrust must resolve each user and organization to an active BizTrust tenant membership server-side and enforce all transaction/resource permissions in its own services and database isolation layer. A Logto organization claim or browser-supplied tenant ID is not sufficient by itself to establish database tenant context.

The official repository is licensed under MPL-2.0. If BizTrust later modifies and distributes Logto source, preserve notices and obtain a license review. See the upstream [README](https://github.com/logto-io/logto) and [LICENSE](https://github.com/logto-io/logto/blob/master/LICENSE); use [Logto documentation](https://docs.logto.io) for version-specific deployment and integration instructions.

### 3.1 API planes

Separate API audiences and trust models:

| Plane | Consumer | Authentication and control |
|---|---|---|
| Customer/distribution API | Web, future mobile app, authorized agent UI | Official Logto OIDC client; BizTrust resolves the active membership and enforces server-side scope |
| Operations API | Staff console | Separate staff client/audience, MFA/step-up for high-impact actions, role + tenant + object checks |
| Partner API | Insurer/payment adapters | Outbound credentials per partner and environment; prefer OAuth client credentials or mTLS where the partner supports it |
| Webhook ingress | Payment/insurer callback | Provider-specific signature verification and timestamp/replay checks, or mTLS if supported; do not treat an unauthenticated public URL as trusted |
| Internal service calls | Jobs and domain modules | Workload identity and least-privilege service scopes; no shared static admin key |

APISIX or the confirmed gateway should handle TLS policy, routing, request-size limits, coarse rate limits, request IDs, and edge authentication where appropriate. Business authorization and ownership checks remain in application/domain code. A valid gateway token does not authorize access to another tenant’s record.

Use versioned, documented contracts. The paths below are logical examples, not a decision to override routes already in the repository. The project must publish the selected paths in OpenAPI.

### 3.2 Core customer and operations API surface

| Method | Example path | Purpose | Key rule |
|---|---|---|---|
| GET | /api/v1/products | List published products available in the customer context | Return only currently available, authorized variants |
| GET | /api/v1/products/{product_id}/variants | List structured variants and comparison terms | Include version and effective dates |
| POST | /api/v1/quotes | Request an indicative quote | Record product/rule versions and reason codes |
| POST | /api/v1/submissions | Create a durable application/submission | Require idempotency; preserve consent and submitted snapshot |
| GET | /api/v1/submissions/{reference_id} | Retrieve scoped status and next steps | Authorize by owner, tenant, and assigned role |
| POST | /api/v1/submissions/{reference_id}/payment-intents | Create QR-enabled payment intent | Server derives amount/currency from approved quote/submission |
| GET | /api/v1/payment-intents/{payment_intent_id} | Read payment state | State changes only from verified provider evidence or controlled reconciliation |
| GET | /ops/v1/cases | Search operational work queues | Restrict filters and results to authorized tenant/role |
| POST | /ops/v1/cases/{case_id}/actions | Perform an allowed case action | Validate current state, capability, reason and idempotency |
| POST | /ops/v1/products/{product_id}/versions | Create a draft product version | Cannot modify a published version in place |
| POST | /ops/v1/decision-rules/{rule_set_id}/simulations | Run a rule simulation | Use synthetic or approved test vectors; no live decision mutation |
| POST | /ops/v1/decision-rules/{rule_set_id}/releases | Publish a reviewed rule version | Enforce configured authority and rollback evidence |

Do not put personal information, payment credentials, access tokens, or insurer payloads in URL paths or query parameters. Use opaque references in customer-facing URLs.

### 3.3 Payment gateway adapter

Expose a provider-neutral internal interface with operations for:

- Create a payment intent from a persisted quote/submission and its server-calculated amount.
- Read payment-intent status from a trusted provider endpoint.
- Verify an inbound callback against the provider’s signature/key/certificate and replay policy.
- Request a refund only from an authorized, state-valid workflow.
- Reconcile provider settlement/transaction reports against the BizTrust ledger.

The caller must not supply a trusted final amount. The service reads the approved amount, currency, expiry, customer reference, and tenant scope from stored records. Do not collect or store card security codes or full card data in BizTrust; use the provider’s hosted or tokenized flow where available.

A create-intent response should contain only the fields needed to complete and track payment:

| Field | Requirement |
|---|---|
| payment_intent_id | Opaque BizTrust identifier |
| reference_id | Customer-visible submission/reference |
| amount_minor and currency | Server-calculated amount and configured currency |
| expires_at | Provider or BizTrust expiry with explicit timezone |
| status | Initial state such as pending |
| qr_payload or qr_image_url | Provider-generated instruction, protected from public logs and expired after use |
| provider_reference | Optional masked partner reference for support/reconciliation |

The API MUST bind the QR/payment intent to the amount, currency, expiry, tenant, and submission reference. A changed amount creates a new versioned intent and invalidates or expires the old instruction. Never let a changed browser payload mutate an existing invoice.

Webhook processing must read the raw request body before any transformation required for signature verification. Validate provider signature, timestamp, event identifier, amount, currency, and provider reference against the stored intent. Persist a minimal verified event durably before acknowledging it. Deduplicate by provider event ID and process asynchronously. A valid callback means the provider authenticated an event; the ledger still checks that the event matches the expected intent.

### 3.4 Insurer adapter API

Define an internal adapter contract independent of each insurer’s field names and transport:

| Operation | Behavior |
|---|---|
| Quote/eligibility | Optional insurer capability; return quote reference, product/rule version, premium breakdown, expiry, reason or referral |
| Submit | Send only required application fields and consent/evidence references; preserve insurer request reference |
| Get status | Map insurer-native states to BizTrust normalized state while retaining original source state |
| Upload/request documents | Use scoped document references and approved secure transfer; record requested/received evidence |
| Callback verification | Verify insurer signature/certificate, event identity, replay window, payload schema and partner reference |
| Cancel/amend | Expose only when that insurer contract supports it and the actor has the required authority |

Use one adapter and contract test suite per partner. Map partner status without losing the insurer-native value. Treat unknown partner states as “unmapped/review required,” never as issued or paid. Include timeout, retry/backoff, rate limit, circuit-breaker, correlation ID, duplicate callback, and dead-letter behavior. Do not retry a non-idempotent submission unless the partner contract provides an idempotency facility or BizTrust can prove the first request was not accepted.

For asynchronous requests, return or retain an application reference and a pending status; update it only when validated evidence arrives. Preserve the product, decision, and submitted customer snapshot versions used for the insurer exchange. Avoid forwarding payment-provider secrets, unrelated tenant data, or unnecessary identity fields to insurers.

### 3.5 Shared request and event behavior

- Require an idempotency key for quote creation, submission, payment-intent creation, refund, and insurer submission where the operation can create an external or financial side effect.
- Scope idempotency by tenant, actor or service identity, operation, and request body. Reusing a key with the same request returns the prior result; reusing it with different content returns a conflict.
- Return a stable correlation ID across browser, API, queues, payment adapter, insurer adapter, and audit.
- Model long-running processing explicitly and return an accepted/pending result where completion is asynchronous.
- Validate request schema and size at the edge and again at the application boundary.
- Use a transactional outbox/inbox or equivalent so durable state changes and emitted events cannot silently diverge.
- Retry only transient failures with bounded backoff and jitter. Send exhausted events to a dead-letter queue with controlled, audited replay.
- Return safe error text to customers and a support reference; keep raw partner details and stack traces out of browser responses.
- Publish contract examples, sandbox credentials, and simulators separately from production credentials.

## 4. Encryption and key-management design

### 4.1 Data classification

Classify data before selecting encryption placement. Encryption complements authorization, tenant isolation, minimization, secure backups, and audit; it does not replace them.

| Class | Examples | Baseline controls |
|---|---|---|
| Public | Published product descriptions, public help content | Integrity controls and transport protection |
| Business confidential | Commission terms, partner configuration metadata, operational reports | Encrypted storage, role/tenant scope, export logging |
| Restricted personal | Identity details, contact data, application answers, policy documents | Encrypted storage and backups; application-level field/object encryption for high-risk fields; access audit and minimization |
| Financial | Payment intent and settlement references, refund evidence | Provider tokenization where available; encrypted storage; finance role scope; reconciliation audit |
| Secrets/key material | OAuth client secrets, webhook verification secrets, signing keys, DEKs/KEKs | Dedicated secret/key manager, non-exportable keys where supported, workload identity, rotation and access audit |

Keep the field-level inventory and decision owner in a data-classification register. Confirm country-specific retention, residency, and deletion obligations with the responsible owner before production.

### 4.2 Encryption profile

**In transit**

- Protect browser-to-edge, edge-to-service, and service-to-service traffic with correctly configured TLS. Prefer TLS 1.3 where supported and retain TLS 1.2 only with the RFC 9325 configuration requirements; disable obsolete protocol versions and weak cipher suites.
- Enforce HTTPS, secure cookies, strict redirect/origin allowlists, and appropriate HSTS policy on production web surfaces.
- Use partner-specific signature verification or mutual TLS in addition to transport encryption when the payment/insurer contract supports it. TLS alone does not authenticate an individual webhook event.

**At rest and in the application**

- Enable managed encryption for database volumes, object storage, queue storage, logs, snapshots, and backups. Keep backup/key access separate from normal application database roles.
- Apply application-level envelope encryption to the restricted fields and documents identified in the threat model, especially fields where database, backup, or support-role access should not expose plaintext.
- Use a vetted cryptographic library and an approved authenticated-encryption-with-associated-data (AEAD) profile. A candidate profile is AES-256-GCM with a 128-bit authentication tag and a unique nonce for every encryption under the same key. Never build cryptographic primitives yourself or reuse a nonce. Authenticate the ciphertext before returning plaintext.
- Bind ciphertext to its tenant, record ID, field name, and schema/key version as authenticated associated data so ciphertext copied across records or tenants fails validation.
- Store ciphertext, nonce, authentication tag, wrapped data-encryption key, key ID/version, and algorithm/profile version together as non-secret metadata. Never store an unwrapped key with the ciphertext.
- Keep the key-encryption key (KEK) in a managed KMS/HSM or the approved key service. Generate data-encryption keys (DEKs) through the approved key service, wrap them under the KEK, and decrypt only in the service authorized for that data class and tenant. Include tenant and purpose in the KMS encryption context where supported.
- Prefer tenant-scoped DEKs wrapped by environment/domain-scoped KEKs when that model is operationally supportable. If a single domain key hierarchy is chosen, document the threat-model trade-off and retain tenant binding, row-level isolation, application authorization, and audited key access.
- Separate development, test, staging, and production key hierarchies. Production keys must never be available to local development, test fixtures, or agents.

**Identity, tokens, payments, and logs**

- Use the official Logto identity service for sign-in, password verification, password hashing, and supported identity factors. Passwords must not be stored or reversibly encrypted by BizTrust.
- Store session identifiers and sensitive tokens with server-side/secure-cookie handling where the selected architecture permits. Do not persist bearer tokens in browser local storage by default. Follow the current OAuth security best practice for authorization code flows, PKCE, redirect validation, and token handling.
- Use provider-hosted payment pages or tokenization where available. Store provider references and status evidence instead of unnecessary raw payment credentials.
- Redact personal data, QR payloads, OAuth codes, access tokens, secret headers, and document contents from logs, traces, analytics, alerts, crash reports, and agent prompts.
- If exact-match search over a restricted identifier is required, assess a keyed HMAC/blind-index design with a separate key and explicit rotation/search migration. Do not use a plain unsalted hash as a substitute for encrypting predictable identifiers.
- Encrypt exports and temporary files, use short-lived download links after authorization, and record document access. Delete temporary plaintext and cache entries when processing ends.

### 4.3 Key lifecycle and recovery

Maintain a cryptographic inventory for keys, certificates, algorithms, owners, environments, dependent data, rotation schedule, and recovery path.

- Generate keys only through vetted libraries or KMS/HSM functions.
- Separate key administrator and application operator roles; use workload identity and narrow KMS permissions.
- Rotate key versions under an operational procedure. Re-wrap DEKs when rotating a KEK where possible, avoiding full data re-encryption unless the risk, algorithm, or exposure requires it.
- Support decryption of retained records by their key version during a controlled migration window. Revoke old keys only after dependency, backup, and restore checks pass.
- Define compromise response: revoke/disable, rotate, identify affected ciphertext, preserve evidence, notify owners, and re-encrypt where appropriate.
- Test restoration of encrypted database, object, and backup data using the recovery procedure. A backup that cannot be decrypted is a failed backup.
- Define crypto-erasure only after confirming key copies, wrapped DEKs, caches, backups, replicas, and deletion windows are covered.

### 4.4 Security verification

Add automated and operational checks for:

- Wrong-tenant access to ciphertext, key operation, document URL, and payment/insurer reference.
- Ciphertext or authenticated metadata tampering, missing tag, wrong associated data, and unsupported key version.
- DEK/KEK rotation, revoked-key behavior, key-service outage, compromise runbook, and encrypted backup restoration.
- No plaintext restricted data, tokens, QR payloads, or keys in logs, CI artefacts, screenshots, event payloads, or agent context.
- Webhook signature mismatch, stale timestamp, replay, duplicate event, altered amount/currency, and invalid partner reference.
- API token scope, audience, tenant boundary, rate limit, schema and request-size limit, and secret rotation.
- Staff-console role boundary, step-up authentication, time-bounded support access, export controls, and immutable action evidence.

## 5. Operational decision controls

Require a reviewed, auditable workflow for these high-impact changes:

| Change | Control |
|---|---|
| Publish new product or coverage terms | Draft, source evidence, comparison diff, rule tests, authorized business approval, immutable release |
| Change pricing/eligibility/underwriting rule | Version, golden tests, impact simulation, independent approver, effective time, rollback |
| Configure payment/insurer credentials | Secret manager workflow, per-environment access, dual control for production, masked verification |
| Refund, settlement correction, payment reconciliation override | Ledger evidence, finance permission, reason, idempotency, second approver under policy |
| Grant privileged role or expand tenant access | Step-up authentication, least privilege, expiry, audit and notification |
| Replay insurer/payment event | Verified source event, idempotent operation, preview of side effect, operator authority, audit |
| Decrypt or export restricted data | Purpose, scope, short-lived access, export watermark/expiry where supported, access audit |

Routine work should remain streamlined: the console should make the next safe action obvious and avoid unnecessary approvals. Use approval requirements only on the operations the owner classifies as financially, legally, or security consequential.

## 6. Additional recommendations

1. **Partner sandbox and simulator:** give each adapter a deterministic simulator with valid, delayed, duplicate, failed, and malformed responses.
2. **API developer portal:** publish versioned OpenAPI, integration onboarding, webhook verification examples, sandbox configuration, status mappings, and change notices for approved partners.
3. **Reconciliation workbench:** compare BizTrust payment intents and ledger entries to provider events/settlements; show unmatched items and controlled resolution evidence.
4. **Event inbox and replay console:** inspect redacted events, retry safe failures, preserve idempotency, and block duplicate financial side effects.
5. **Policy servicing:** plan renewals, endorsements, cancellation, document retrieval, refund tracking, and broker-supported claims assistance after initial purchase flow.
6. **Notification preferences and delivery:** track consent and delivery state for email/SMS/approved messaging channels; templates must not reveal sensitive policy details on lock screens.
7. **Operational scorecards:** define quote turnaround, submission ageing, insurer response SLA, payment success/reconciliation, referral, cancellation, and support resolution metrics with source and calculation notes.
8. **Privacy by default:** use synthetic records in previews and staging, restrict exports, minimize free-text fields, and keep direct identifiers out of agent task context.
9. **Resilience:** define queue recovery, idempotent replay, provider outage behavior, restore testing, and agreed service/recovery objectives before launch.
10. **Cryptographic agility:** maintain a reviewed crypto profile and revisit it as NIST and IETF guidance evolves; keep algorithms, key IDs, ciphertext versions, and migration code explicit.

## 7. Decisions required before implementation

| Decision | Owner input or evidence required |
|---|---|
| Operations URL, hosting and network access | DNS, hosting, staff access, and environment model |
| Logto deployment and client configuration | Cloud/self-hosted mode, supported release, customer/staff clients, organization mapping, MFA and callback/origin configuration |
| Payment providers and QR formats | Provider API documentation, sandbox credentials, callback authentication, settlement/refund terms |
| Insurers and integration capabilities | Partner contracts, quote/submit/status/document/cancel support, sandbox or test process |
| KMS/secret manager | Hosting provider, key tenancy model, recovery operator, access and rotation policy |
| Data classification and retention | Product-specific data inventory and responsible local compliance/business owner |
| Role names and segregation | Broker, insurer, finance, support, security and audit authorities |
| Searchable restricted identifiers | Business need, masking rules, lawful purpose, and keyed-index decision |
| Availability and recovery goals | Expected load, business operating hours, support model and recovery priorities |

## 8. Acceptance criteria

This companion design is ready to guide implementation when:

- Customer and staff sign-in use registered clients of the official Logto identity provider; BizTrust validates OIDC responses and independently enforces membership, resource authorization, and tenant isolation.

- Customer, staff, partner, and webhook API planes have separate audiences and documented trust checks.
- Payment API responses are server-calculated, QR instructions expire, and provider callbacks cannot directly bypass BizTrust state and reconciliation.
- Insurer adapters map provider-native states to normalized BizTrust states while preserving source evidence and rejecting unknown states as review-required.
- Staff can resolve routine work through role-scoped queues and case timelines without a database console or generic force-status control.
- Product, rule, credential, refund, role, and event-replay changes have explicit capability, approval, audit, and rollback paths.
- Data classes are inventoried; ciphertext uses an approved authenticated-encryption profile; keys are separated from data; rotation and restore procedures have meaningful tests.
- Sensitive material is absent from client storage, logs, CI artefacts, demo data, and agent context.
- OpenAPI contract tests, sandbox simulators, webhook replay tests, tenant-isolation tests, and encryption lifecycle tests run through the documented repository verification command.

## 9. Primary technical references

Use these as implementation references and verify their current status during security review:

- IETF RFC 9700, Best Current Practice for OAuth 2.0 Security: https://www.rfc-editor.org/rfc/rfc9700.html
- IETF RFC 9325, Recommendations for Secure Use of TLS and DTLS: https://www.rfc-editor.org/rfc/rfc9325.html
- OWASP Cryptographic Storage Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html
- OWASP Key Management Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Key_Management_Cheat_Sheet.html
- OWASP REST Security Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html
- NIST SP 800-38D, GCM and GMAC: https://csrc.nist.gov/pubs/sp/800/38/d/final
- NIST SP 800-38D Rev. 1 status page: https://csrc.nist.gov/pubs/sp/800/38/d/r1/2prd

NIST’s SP 800-38D final publication is under revision; its June 2026 page describes a second pre-draft feedback stage rather than a final replacement standard. Keep the algorithm profile versioned and revisit it when NIST publishes the revised final guidance.
