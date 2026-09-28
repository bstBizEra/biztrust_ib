import test from "node:test";
import assert from "node:assert/strict";
import { inspect } from "node:util";
import { createApp } from "../server/app.ts";
import { config, resolveAppMode, validateConfig } from "../server/config.ts";
import { pool } from "../server/db.ts";

test("mode selection preserves the legacy demo and rejects ambiguous or live modes", () => {
  assert.equal(resolveAppMode(undefined, "true"), "demo");
  assert.equal(resolveAppMode("development", "false"), "development");
  assert.equal(resolveAppMode(undefined, "false"), "production");
  assert.equal(resolveAppMode("development", undefined), "development");
  assert.throws(() => resolveAppMode("development", "true"), /conflict/);
  assert.throws(() => resolveAppMode("demo", "false"), /conflict/);
  assert.throws(() => resolveAppMode("unknown", undefined), /APP_MODE/);
  assert.throws(() => resolveAppMode("", undefined), /APP_MODE/);

  const previous = {
    mode: config.mode,
    demo: config.demo,
    databaseUrl: config.databaseUrl,
    webhookSecret: config.webhookSecret,
    host: config.host,
    origin: config.origin,
    issuer: config.issuer,
    clientId: config.clientId,
    staffIssuer: config.staffIssuer,
    staffClientId: config.staffClientId,
  };
  try {
    config.databaseUrl = "postgresql://test:test@127.0.0.1:15432/dev_test";
    config.webhookSecret = "synthetic-secret-for-mode-checks-only";
    config.host = "127.0.0.1";
    config.origin = "http://127.0.0.1:3000";
    config.issuer = "";
    config.clientId = "";
    config.staffIssuer = "";
    config.staffClientId = "";
    config.mode = "production";
    config.demo = false;
    assert.throws(() => validateConfig(), /Production activation is gated/);
    config.mode = "staging";
    assert.throws(() => validateConfig(), /Production activation is gated/);
    config.mode = "development";
    assert.doesNotThrow(() => validateConfig());
    config.host = "0.0.0.0";
    assert.throws(() => validateConfig(), /restricted to loopback/);
    config.host = "127.0.0.1";
    config.origin = "http://dev.example.test:3000";
    assert.throws(() => validateConfig(), /restricted to loopback/);
    config.origin = "http://127.0.0.1:3000";
    config.databaseUrl = "postgresql://user:pass@db.example.test/dev";
    assert.throws(() => validateConfig(), /loopback database/);
    config.databaseUrl =
      "postgresql://user:pass@127.0.0.1:15432/dev?host=db.example.test";
    assert.throws(() => validateConfig(), /loopback database/);
    config.databaseUrl =
      "postgresql://user:pass@127.0.0.1:15432/dev?%68ost=db.example.test";
    assert.throws(() => validateConfig(), /loopback database/);
    config.databaseUrl = "postgresql://user:synthetic-secret@[invalid/dev";
    assert.throws(
      () => validateConfig(),
      (error: unknown) =>
        error instanceof Error &&
        error.message === "Development database URL is invalid." &&
        !("cause" in error) &&
        !("input" in error) &&
        !inspect(error).includes("synthetic-secret"),
    );
  } finally {
    config.mode = previous.mode;
    config.demo = previous.demo;
    config.databaseUrl = previous.databaseUrl;
    config.webhookSecret = previous.webhookSecret;
    config.host = previous.host;
    config.origin = previous.origin;
    config.issuer = previous.issuer;
    config.clientId = previous.clientId;
    config.staffIssuer = previous.staffIssuer;
    config.staffClientId = previous.staffClientId;
  }
});

test("development serves the synthetic catalogue but rejects transaction and sign-in routes", async () => {
  const previous = { mode: config.mode, demo: config.demo };
  const originalQuery = pool.query;
  const originalConnect = pool.connect;
  let databaseCalls = 0;
  Object.assign(pool, {
    query: async () => {
      databaseCalls++;
      throw new Error("Unexpected database query");
    },
    connect: async () => {
      databaseCalls++;
      throw new Error("Unexpected database connection");
    },
  });
  config.mode = "development";
  config.demo = false;
  const server = createApp().listen(0, "127.0.0.1");
  try {
    await new Promise<void>((resolve) => server.once("listening", resolve));
    const address = server.address();
    const origin = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
    const catalogue = await fetch(`${origin}/api/catalog`);
    assert.equal(catalogue.status, 200);
    const body = (await catalogue.json()) as {
      synthetic: boolean;
      mode: string;
    };
    assert.equal(body.synthetic, true);
    assert.equal(body.mode, "development");
    for (const [path, method] of [
      ["/api", "GET"],
      ["/ops", "GET"],
      ["/API/session", "GET"],
      ["/API/QUOTES", "POST"],
      ["/OPS/v1/session", "GET"],
      ["/api/catalog", "POST"],
      ["/api/catalog", "HEAD"],
      ["/api/catalog/", "GET"],
      ["/api/auth/demo", "POST"],
      ["/api/auth/login", "GET"],
      ["/api/quotes", "POST"],
      ["/api/webhooks/payment", "POST"],
      ["/api/demo/applications/test/insurer", "POST"],
      ["/ops/auth/demo", "POST"],
      ["/ops/v1/cases", "GET"],
    ] as const) {
      const response = await fetch(`${origin}${path}`, { method });
      assert.equal(response.status, 503, `${method} ${path}`);
      if (method !== "HEAD")
        assert.equal(
          ((await response.json()) as { error: { code: string } }).error.code,
          "DEVELOPMENT_READ_ONLY",
        );
    }
    assert.equal(databaseCalls, 0);
    Object.assign(pool, {
      query: async (statement: string) => {
        assert.equal(statement, "SELECT 1");
        databaseCalls++;
        return { rows: [] };
      },
    });
    const health = await fetch(`${origin}/api/health`);
    assert.equal(health.status, 200);
    assert.equal(
      ((await health.json()) as { mode: string }).mode,
      "development",
    );
    assert.equal(databaseCalls, 1);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
    config.mode = previous.mode;
    config.demo = previous.demo;
    pool.query = originalQuery;
    pool.connect = originalConnect;
  }
});
