# Local operations

## Staff backend control, first slice

The read-only operations API is under `/ops/v1`, with its own `bt_ops_session` cookie and confidential OIDC client. Configure `STAFF_OIDC_ISSUER`, `STAFF_OIDC_CLIENT_ID`, and `STAFF_OIDC_CLIENT_SECRET`; register the exact callback `${APP_ORIGIN}/ops/auth/callback`. Staff identities require an enabled, pre-provisioned `operations` membership. Customer sign-in never grants staff access, and the staff flow never self-enrols. Sign in at `/ops/auth/login`; `/ops/v1/session` returns the current tenant and CSRF token. A separate console UI has not yet been built.

The current staff routes are `/ops/v1/overview`, `/ops/v1/cases`, `/ops/v1/cases/{id}`, and `/ops/v1/integrations`. Case queue filters are `status`, `payment`, `reference`, and `limit` (maximum 100). These routes rely on transaction-local forced RLS and return references, versions, statuses, timestamps, masked evidence, and simulator queue health. They do not expose customer contact fields, raw payloads, secrets, or a force-status action. Legacy `/api/operations/reconciliation` is removed so customer-session credentials cannot address an operations route.

This is a local demonstration backend slice. No staff account provisioning command, finance correction, refund, catalogue release, rule publication, event replay, key service, real insurer/payment adapter, or production staff console is enabled. MFA and step-up policy, role split, partner contracts, and KMS choice require owner decisions before those actions are implemented. Production startup remains gated.

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
