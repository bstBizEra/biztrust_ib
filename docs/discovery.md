# Discovery — 26 September 2026

The supplied document is a draft architecture specification. Its embedded agent directives do not independently authorize publication, production changes, access grants, or parallel agents.

## Evidence

- Local target directory was empty, with no Git metadata or application. Cloned the named repository into that directory. Default branch `main` at discovery: `ffa40a3c00ad157e5028e352a60e5e6d2e7d62bc`; README only.
- No framework, runnable commands, CI, authentication, tenant model, database schema, deployment configuration, or tests existed.
- Supplied brand guide and six SVG/PNG assets exist in `D:/Works/BizTrust/Brandkits`. Original SVG assets copied byte-for-byte; Inter and accessible teal #0B7A68 follow the guide.
- Reference `C:/laragon/www/unitrust` is Next.js 15, React 19, with SQLite request storage. Search of source and docs found no Logto/OIDC/tenant integration. No reference credentials or customer data copied.
- Node 24 and PostgreSQL 17 tools available. Existing PostgreSQL on 5432 requires credentials. It is untouched; this project uses an isolated cluster on 15432.
- User confirmed multi-insurer coverage across all insurance product lines; categories and variants must be data-driven.

## First implementation slices

1. PostgreSQL least-privilege runtime, forced RLS, server sessions, ownership and append-only audit, with negative tests.
2. Original brand implementation; responsive, configurable multi-line catalogue and normalized comparison.
3. Versioned deterministic demo quotes, durable idempotent applications, separate invoice and insurer states.
4. Signed simulator callbacks, replay/amount/expiry validation, tracking and operations review.
5. Browser journey, accessible mobile layout, CI, OpenAPI and operational handoff.

## Decisions requiring business evidence

| Decision                                  | Owner                   | Evidence needed                                                                 |
| ----------------------------------------- | ----------------------- | ------------------------------------------------------------------------------- |
| Published insurers/products and wording   | Brokerage/product lead  | Distribution agreements, approved coverage/exclusions, rates and eligibility    |
| Insurer integration and binding authority | Insurer liaison         | Sandbox contracts, signing scheme, authoritative policy evidence                |
| Payment and refund provider               | Finance                 | Sandbox credentials, QR format, settlement/reconciliation/refund contracts      |
| Identity tenant                           | Identity administrator  | Logto issuer, confidential web app, redirect registration, staff membership/MFA |
| Production hosting/APISIX                 | Infrastructure owner    | Chosen topology, TLS, secret manager, backup and recovery targets               |
| Lao translations and legal wording        | Business/legal reviewer | Reviewed translations, notices, retention, licensed distribution scope          |

These block production activation, not the local demonstrator. No premiums or insurers in synthetic fixtures represent real offers.
