// Explicit preload for pure checks; never loads local credentials or a DB driver.
import { registerHooks } from "node:module";

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "dotenv/config")
      return { url: "data:text/javascript,export {}", shortCircuit: true };
    if (specifier === "pg" || specifier === "pg-native")
      throw new Error(
        "Database imports are forbidden in credential-free checks.",
      );
    return nextResolve(specifier, context);
  },
});

for (const name of [
  "DATABASE_ADMIN_URL",
  "OIDC_ISSUER",
  "OIDC_CLIENT_ID",
  "OIDC_CLIENT_SECRET",
  "STAFF_OIDC_ISSUER",
  "STAFF_OIDC_CLIENT_ID",
  "STAFF_OIDC_CLIENT_SECRET",
])
  delete process.env[name];
Object.assign(process.env, {
  DATABASE_URL: "unused-for-pure-tests",
  WEBHOOK_SECRET: "synthetic-unit-test-placeholder-0000000000",
  DEMO_MODE: "true",
  APP_ORIGIN: "http://127.0.0.1:3000",
  HOST: "127.0.0.1",
});
