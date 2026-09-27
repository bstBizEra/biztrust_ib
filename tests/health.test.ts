import test, { after, before, mock } from "node:test";
import assert from "node:assert/strict";
import { devNull } from "node:os";
import type { Server } from "node:http";
import metadata from "../package.json" with { type: "json" };

Object.assign(process.env, {
  DOTENV_CONFIG_PATH: devNull,
  DOTENV_KEY: "",
  DATABASE_URL: "postgresql://unused:unused@127.0.0.1:1/unused",
  DATABASE_ADMIN_URL: "",
  WEBHOOK_SECRET: "synthetic-health-test-placeholder-0000",
  DEMO_MODE: "true",
  APP_ORIGIN: "http://127.0.0.1:3000",
  HOST: "127.0.0.1",
  OIDC_ISSUER: "",
  OIDC_CLIENT_ID: "",
  OIDC_CLIENT_SECRET: "",
  STAFF_OIDC_ISSUER: "",
  STAFF_OIDC_CLIENT_ID: "",
  STAFF_OIDC_CLIENT_SECRET: "",
});
const { createApp } = await import("../server/app.ts");
const { pool } = await import("../server/db.ts");
mock.method(pool, "connect", () => {
  throw new Error("Real database connections are forbidden in health tests.");
});

let server: Server;
let origin: string;
before(async () => {
  server = createApp().listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  origin = `http://127.0.0.1:${address.port}`;
});
after(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  await pool.end();
  mock.restoreAll();
});

test("health reports package version after querying the database", async (t) => {
  const query = t.mock.method(pool, "query", async () => ({ rows: [] }));
  const response = await fetch(`${origin}/api/health`);
  assert.equal(response.status, 200);
  assert.equal(query.mock.callCount(), 1);
  assert.deepEqual(query.mock.calls[0].arguments, ["SELECT 1"]);
  assert.deepEqual(await response.json(), {
    status: "ok",
    mode: "demonstration",
    version: metadata.version,
  });
});

test("health rejects a failed database query without exposing its details", async (t) => {
  const query = t.mock.method(pool, "query", async () => {
    throw new Error("synthetic-private-database-detail");
  });
  const log = t.mock.method(console, "error", () => {});
  const response = await fetch(`${origin}/api/health`);
  assert.equal(response.status, 500);
  assert.equal(query.mock.callCount(), 1);
  assert.deepEqual(query.mock.calls[0].arguments, ["SELECT 1"]);
  const requestId = response.headers.get("x-request-id");
  assert.ok(requestId);
  assert.deepEqual(await response.json(), {
    error: {
      code: "INTERNAL_ERROR",
      message:
        "Something went wrong. Please try again or keep the support reference.",
      requestId,
    },
  });
  assert.equal(log.mock.callCount(), 1);
  assert.deepEqual(JSON.parse(String(log.mock.calls[0].arguments[0])), {
    level: "error",
    requestId,
    type: "Error",
  });
});
