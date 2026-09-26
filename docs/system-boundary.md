# BizTrust system boundary

This implementation follows the two-experience boundary in BIZTRUST-IB-SYS-001. The customer application and staff console share authoritative backend services and the same tenant isolation. `/ops` is the selected local console route. No operations hostname or DNS configuration has been adopted.

| Flow                  | Current local implementation                                                                                                                                     | Remaining production work                                                                                      |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Customer/distribution | Customer UI → `/api` → customer session/membership → domain services → forced RLS                                                                                | Confirm gateway/TLS deployment, agent/broker permissions and real identity acceptance                          |
| Staff                 | `/ops` console → `/ops/v1` → separate cookie/OIDC client → operations capability and tenant checks → scoped services                                             | Specialized roles/object assignments, MFA/step-up, reviewed configuration and financial actions                |
| Payment               | Raw-body HMAC and timestamp verification → committed immutable `payment_inbox` receipt → idempotent domain transaction → payment state, insurer outbox and audit | Per-provider adapters/keys, asynchronous worker/backoff/dead-letter policy, settlement/refund authority        |
| Insurer               | Explicit local simulator → validated transition → submission state, outbox and synthetic evidence                                                                | Authenticated partner callback/poll adapter, durable insurer inbox, native state mapping, unknown-state review |
| Data protection       | Tenant authorization, forced RLS, masked staff responses, secrets confined to server configuration, no raw-body logging                                          | Data-class encryption, restricted KMS/HSM adapter, managed storage/backups, retention and restore evidence     |

The UI never receives database credentials or key material. Read-only staff use cases enforce the operations capability independently of HTTP routing. The runtime database role cannot create operations memberships, modify audit records, bypass RLS, or change an existing inbox event payload. Each demo workspace is a fresh server-generated tenant populated through domain services. Demo sessions are accepted only in the local loopback environment and the generated namespace.

## Current data inventory

| Data                                                               | Classification        | Current handling / required decision                                                                                                                                                                                        |
| ------------------------------------------------------------------ | --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Synthetic catalogue and descriptions                               | Public                | Versioned code fixtures with provenance and explicit synthetic labels                                                                                                                                                       |
| Application names, email and answers                               | Restricted personal   | Stored in JSONB in this local demonstrator; application-level encryption is **not implemented**. Real customer data remains outside the release boundary. Confirm KMS and classified fields before implementing encryption. |
| Payment references, expected amount and verified normalized events | Financial             | Tenant isolation, schema minimization, immutable intake fields and append-only outcome evidence; encrypted storage and retention need deployment evidence                                                                   |
| Session identifiers and OIDC credentials                           | Secrets               | Opaque cookie tokens hashed in server session storage; OIDC credentials held in ignored server environment configuration. A managed secret service is pending.                                                              |
| Audit                                                              | Business confidential | Scoped append-only records without duplicated contact fields; centralized immutable retention and export authority are pending                                                                                              |

## Payment recovery semantics

1. Reject an invalid signature, timestamp or schema before storing an event.
2. Commit the normalized receipt and digest before business processing.
3. A matching repeated event returns the prior outcome or retries pending/failed processing. Different content for the same event ID conflicts.
4. The existing domain transaction locks the invoice, checks tenant/owner/reference/amount/currency/expiry, and atomically writes state, outcome audit and outbox.
5. If the process stops after receipt commit or after domain commit, redelivery safely completes the remaining work. If processing fails, return a safe `503 PAYMENT_PROCESSING_PENDING` and keep the receipt. There is no unattended worker yet.

`npm test` covers both crash windows, concurrent duplicates, changed-payload conflicts, isolation, client/audience separation and demo CSRF. The local console has no force-paid, force-issued, credential editor or generic status override.

Production activation remains blocked in configuration until the pending components have implementation and acceptance evidence. This document records the present boundary; it does not claim the complete target architecture has been delivered.
