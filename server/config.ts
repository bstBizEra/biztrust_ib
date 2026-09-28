import "dotenv/config";

export type AppMode = "demo" | "development" | "staging" | "production";

export function resolveAppMode(
  requested: string | undefined,
  legacyDemo: string | undefined,
): AppMode {
  if (
    requested !== undefined &&
    !["demo", "development", "staging", "production"].includes(requested)
  )
    throw new Error(
      "APP_MODE must be demo, development, staging or production.",
    );
  if (legacyDemo !== undefined && !["true", "false"].includes(legacyDemo))
    throw new Error("DEMO_MODE must be true or false.");
  if (
    requested &&
    ((legacyDemo === "true" && requested !== "demo") ||
      (legacyDemo === "false" && requested === "demo"))
  )
    throw new Error("APP_MODE and DEMO_MODE conflict.");
  return (requested ||
    (legacyDemo === "true" ? "demo" : "production")) as AppMode;
}

const mode = resolveAppMode(process.env.APP_MODE, process.env.DEMO_MODE);
const databaseUrl = process.env.DATABASE_URL || "";

function validateDevelopmentDatabaseUrl(selectedMode: AppMode, value: string) {
  if (selectedMode !== "development" || !value) return;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Development database URL is invalid.");
  }
  if (
    !["postgres:", "postgresql:"].includes(url.protocol) ||
    !["127.0.0.1", "localhost"].includes(url.hostname) ||
    url.search ||
    url.hash
  )
    throw new Error(
      "Development mode requires a loopback database without URL parameters.",
    );
}

validateDevelopmentDatabaseUrl(mode, databaseUrl);

export const config = {
  mode,
  origin: process.env.APP_ORIGIN || "http://127.0.0.1:3000",
  host: process.env.HOST || "127.0.0.1",
  port: Number(process.env.PORT || 3000),
  demo: mode === "demo",
  databaseUrl,
  webhookSecret: process.env.WEBHOOK_SECRET || "",
  issuer: process.env.OIDC_ISSUER || "",
  clientId: process.env.OIDC_CLIENT_ID || "",
  clientSecret: process.env.OIDC_CLIENT_SECRET || "",
  staffIssuer: process.env.STAFF_OIDC_ISSUER || "",
  staffClientId: process.env.STAFF_OIDC_CLIENT_ID || "",
  staffClientSecret: process.env.STAFF_OIDC_CLIENT_SECRET || "",
  customerTenant: process.env.CUSTOMER_TENANT || "biztrust",
};

export function validateConfig() {
  validateIdentityConfiguration();
  if (!config.databaseUrl)
    throw new Error(
      "DATABASE_URL missing. Run npm run db:local and npm run db:migrate.",
    );
  if (config.webhookSecret.length < 32)
    throw new Error("WEBHOOK_SECRET must contain at least 32 characters.");
  if (
    (config.mode === "demo" || config.mode === "development") &&
    (!["127.0.0.1", "localhost"].includes(config.host) ||
      !["127.0.0.1", "localhost"].includes(new URL(config.origin).hostname))
  )
    throw new Error("Demo and development modes are restricted to loopback.");
  validateDevelopmentDatabaseUrl(config.mode, config.databaseUrl);
  if (config.demo !== (config.mode === "demo"))
    throw new Error(
      "Production activation is gated: mode configuration conflicts.",
    );
  if (config.mode === "staging" || config.mode === "production")
    throw new Error(
      "Production activation is gated: approved catalogue, payment/insurer adapters, identity acceptance and operational evidence are not configured. See docs/architecture.md.",
    );
}

export function validateIdentityConfiguration() {
  const canonicalIssuer = (issuer: string) =>
    issuer ? new URL(issuer).href.replace(/\/$/, "") : "";
  if (
    config.staffClientId &&
    config.clientId &&
    config.staffClientId === config.clientId &&
    canonicalIssuer(config.staffIssuer) === canonicalIssuer(config.issuer)
  )
    throw new Error(
      "Staff and customer identity must use separate OIDC clients.",
    );
  for (const issuer of [config.issuer, config.staffIssuer]) {
    if (issuer && new URL(issuer).protocol !== "https:")
      throw new Error("OIDC issuers must use HTTPS.");
  }
}

export function localDemoAvailable() {
  return (
    config.demo &&
    ["127.0.0.1", "localhost"].includes(config.host) &&
    ["127.0.0.1", "localhost"].includes(new URL(config.origin).hostname)
  );
}
