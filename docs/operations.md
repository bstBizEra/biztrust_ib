# Local operations

## Operations console

Open `/ops` for the separate staff console: overview, cases, payment exceptions, integration status and system health. The console calls `/ops/v1` APIs with its own `bt_ops_session` cookie. It uses no database credentials and no customer bearer token. The staff and customer applications load separate interface bundles and styles.

For staff identity, configure `STAFF_OIDC_ISSUER`, `STAFF_OIDC_CLIENT_ID`, and `STAFF_OIDC_CLIENT_SECRET`; register the exact callback `${APP_ORIGIN}/ops/auth/callback`. Startup rejects a staff configuration that reuses the customer issuer/client pair. Staff identities require an enabled, pre-provisioned `operations` membership, rechecked on each request. The OIDC flow never self-enrols. Sign in at `/ops/auth/login`; `/ops/v1/session` returns anonymous sign-in availability or the authorized tenant, along with the staff CSRF token. No real identity-provider configuration has been validated locally.

In loopback demonstration mode, **Open isolated staff demo** creates a new `ops-demo-…` tenant with five persisted synthetic cases using the same quote, application, verified payment and insurer services. The browser cannot choose a tenant or role. This separate staff session lasts eight hours; entry requires same-origin CSRF verification and is rate limited. Another demo session has a different tenant. Reloading preserves the workspace; signing out revokes the session. Synthetic records remain in the local database after logout.

The current staff routes are `/ops/v1/overview`, `/ops/v1/cases`, `/ops/v1/cases/{id}`, and `/ops/v1/integrations`. Case queue filters are `status`, `payment`, `reference`, and `limit` (maximum 100). These routes rely on transaction-local forced RLS and return references, versions, statuses, timestamps, masked evidence, and simulator queue health. They do not expose customer contact fields, raw payloads, secrets, or a force-status action. Legacy `/api/operations/reconciliation` is removed so customer-session credentials cannot address an operations route.

The console currently provides scoped read access. Staff account provisioning, finance corrections, refunds, catalogue/rule releases, event replay, specialized staff roles, MFA/step-up, real insurer/payment adapters and the restricted key service remain implementation milestones. Production startup remains gated. See [the system boundary](system-boundary.md) for the implemented and pending flow components.

Verified payment ingress now commits a minimal event to `payment_inbox` before invoking the domain handler. The receipt payload is immutable to the runtime role; only processing metadata can change. Failed processing retains the receipt and returns `503 PAYMENT_PROCESSING_PENDING`; the provider can redeliver the same event, with a fresh signature timestamp, to recover. Event identity and body digest prevent changed-payload replay. Processing is inline after the durable commit; no autonomous retry worker is configured. Console health reports pending, failed and processed receipts separately from insurer outbox retries. Apply migration `002` using `npm run db:migrate` before starting the new backend.

`npm run db:local` manages only `.data/postgres` at `127.0.0.1:15432`, creates `biztrust_dev` and a least-privilege `biztrust_app` role, and generates ignored secrets without printing them. PostgreSQL on 5432 is untouched. Run `npm run db:migrate` before the application.

Use `npm run dev` or `npm run build` then `npm start`. Stop the app with Ctrl+C. Database data persists. Stop only this cluster with:

```powershell
& 'C:\laragon\bin\postgresql\postgresql-17.10\bin\pg_ctl.exe' -D 'C:\laragon\www\biztrust_ib\.data\postgres' -m fast -w stop
```

Do not remove data, shared PostgreSQL services, Windows reservations, hosts or Laragon routes for routine troubleshooting.

`GET /api/health` returns 200 after a real database query. API responses have `X-Request-Id`, safe errors and `Cache-Control: no-store`. If a submit response is lost, retry the same idempotency key/payload or open My applications. Expired quotes need recalculation; expired QR instructions cannot be retrieved. Late/mismatched payments stay in reconciliation. Insurer timeouts retain payment and outbox state for an explicit retry.

## Verification

- `npm run verify`: lint, types, domain/integration/contract tests, build, browser journeys/accessibility, production dependency audit.
- `npm run test:e2e`: isolated built web server and clean browser context; screenshots and JSON under `output/playwright/`. Windows uses Chrome; CI installs Playwright Chromium.
- `npm run format:check`: source formatting.
- `npm run security`: official npm advisory endpoint (the workstation mirror has no advisory API).

Tests use unique synthetic tenants and an isolated CI database. They never make real financial transactions. Development test records may accumulate. Never run against customer data.

## Recovery and incidents

Preserve local data using an access-controlled, encrypted PostgreSQL custom-format dump with securely supplied administrative credentials. Rehearse restoration only into a separate database with matching roles; apply migrations and rerun RLS tests before any cutover. No destructive restore or down migration is supplied.

Production backup/restore, RPO/RTO targets, monitoring dashboards, alert ownership, central retention, gateway, certificates and real provider sandboxes have not been validated. They remain release prerequisites.

For suspected tenant/payment integrity failure: stop business mutations, preserve request/provider event IDs and audit, have the authorized owner revoke affected membership/session/key, isolate the environment and reconcile before resuming. Do not delete evidence to clear errors.
