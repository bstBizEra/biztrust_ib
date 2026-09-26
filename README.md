# BizTrust — online insurance brokerage

A working local multi-insurer platform built from BIZTRUST-IB-ARCH-001 v0.1 and the supplied BizTrust brand kit. Explore, compare, quote, apply and track insurer processing across 12 configurable insurance categories.

**Release status: local demonstration.** The 24 plans, three insurers, prices, QR instructions and insurer outcomes are synthetic. No real payment is taken and no insurance coverage is provided.

## Run on this workstation

Requires Node.js 24 and the installed Laragon PostgreSQL 17 tools.

```powershell
npm ci
npm run db:local
npm run db:migrate
npm run build
npm start
```

Open **http://127.0.0.1:3000**. Setup creates its own PostgreSQL cluster at `.data/postgres`, listening on **127.0.0.1:15432**, generates ignored credentials and creates a least-privilege runtime role. Existing databases are untouched. Use `npm run dev` for editing with live reload; restart it after changing dependencies. The user preview should use built assets. Do not start both servers on the same port.

## Try the journey

1. Choose **Find your cover** for personal/business discovery, category selection and must-have coverage matching, or browse the full catalogue.
2. Select up to three plans and compare limits, exclusions, deductibles and premium periods.
3. Choose **View plan → Start a demo quote** to create a private browser session.
4. Calculate a quote and enter fictional details, such as `Demo Explorer` / `demo@example.test`.
5. Accept the demonstration disclosures and submit. A persistent `BT-…` reference and non-payable QR appear.
6. Under **Demonstration controls**, simulate payment verification and an insurer outcome. Try timeout, referral, information request or demo issuance.
7. Refresh or revisit **My applications**. Payment and insurer status remain separate. A demo document is available only to its owning account.

Demo access lasts up to twelve hours in this browser. Signing out ends access to that temporary workspace. English is the primary interface; the language toggle previews draft Lao navigation. Product/legal translations await review.

## Verification

```powershell
npm run verify
```

Runs lint, strict TypeScript, unit/integration/contract tests, a production build, development startup checks, browser journeys and WCAG checks at desktop/390px/320px, module failure/reload recovery, and the production dependency audit. Windows uses installed Chrome. On Linux/CI first run `npx playwright install --with-deps chromium`. Reports and screenshots are saved to ignored `output/playwright/`.

Additional commands: `npm run test:unit`, `npm run test:integration`, `npm run test:e2e`, `npm run format`, `npm run format:check`, `npm run security`.

## Other environments

Provision isolated PostgreSQL 17+ with a migration owner and separate `biztrust_app` login having `NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE`. Copy `.env.example` to `.env`; configure both database URLs, a random webhook secret of at least 32 characters, and loopback origin. Then migrate and run. Never use administrative credentials for the runtime.

## Structure and handoff

- `src/`: responsive React experience and draft locales.
- `server/`: identity, database, catalogue, domain, applications, payment and insurer processing.
- `server/migrations/`: schema, forced RLS and append-only audit permissions.
- `tests/`: domain, database/security and API contract verification.
- `scripts/`: local database, migrations, reproducible browser verification.
- `api/openapi.json`: API and signed callback contract.
- `server/operations.ts` and `server/staff-auth.ts`: tenant-scoped, read-only staff API with separate OIDC session.
- `.github/workflows/`: isolated-database CI verification.

Read [discovery](docs/discovery.md), [architecture and limitations](docs/architecture.md), [operations](docs/operations.md), [asset sources](docs/assets.md), and [UniTrust selection study and white-screen repair](docs/unitrust-selection-study.md).

## Production dependencies

Logto acceptance, actual insurer products/distribution authority, payment and insurer adapters, legal/Lao wording, staff/finance workflows, hosting/APISIX, monitoring, retention and backup restoration remain required. The server refuses production mode until these are implemented and evidenced. No production deployment or tunnel/DNS change is included.
