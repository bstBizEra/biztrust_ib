import "dotenv/config";

export const config = {
  origin: process.env.APP_ORIGIN || "http://127.0.0.1:3000",
  host: process.env.HOST || "127.0.0.1",
  port: Number(process.env.PORT || 3000),
  demo: process.env.DEMO_MODE === "true",
  databaseUrl: process.env.DATABASE_URL || "",
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
    config.demo &&
    (!["127.0.0.1", "localhost"].includes(config.host) ||
      !["127.0.0.1", "localhost"].includes(new URL(config.origin).hostname))
  )
    throw new Error("Demonstration mode is restricted to loopback.");
  if (!config.demo)
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
