import test, { after, mock } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { devNull } from "node:os";
import type { Request, Response } from "express";

Object.assign(process.env, {
  DOTENV_CONFIG_PATH: devNull,
  DOTENV_KEY: "",
  DATABASE_URL: "postgresql://unused:unused@127.0.0.1:1/unused",
  DATABASE_ADMIN_URL: "",
  WEBHOOK_SECRET: randomBytes(32).toString("hex"),
  APP_MODE: "demo",
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
const { csrfMiddleware } = await import("../server/auth.ts");
const { DomainError } = await import("../server/domain.ts");
const { config } = await import("../server/config.ts");
const { pool } = await import("../server/db.ts");
const forbiddenDatabase = () => {
  throw new Error("Database access is forbidden in CSRF middleware tests.");
};
const query = mock.method(pool, "query", forbiddenDatabase);
const connect = mock.method(pool, "connect", forbiddenDatabase);
after(async () => {
  assert.equal(query.mock.callCount(), 0);
  assert.equal(connect.mock.callCount(), 0);
  await pool.end();
  mock.restoreAll();
});

function check(
  method: string,
  session: unknown,
  token?: string,
  origin = config.origin,
) {
  const request = {
    method,
    session,
    get: (name: string) => (name === "origin" ? origin : token),
  } as unknown as Request;
  let calls = 0;
  let result: unknown;
  csrfMiddleware(request, {} as Response, (error?: unknown) => {
    calls++;
    result = error;
  });
  assert.equal(calls, 1);
  return result;
}

function denied(result: unknown) {
  assert.ok(result instanceof DomainError);
  assert.equal(result.status, 403);
  assert.equal(result.code, "INVALID_REQUEST_ORIGIN");
}

test("customer mutations reject absent or empty stored CSRF tokens", () => {
  for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
    denied(check(method, {}, undefined));
    denied(check(method, { csrf: "" }, ""));
    denied(check(method, undefined, undefined));
    denied(check(method, { csrf: null }, undefined));
  }
});

test("customer CSRF still requires matching token and trusted origin", () => {
  const token = randomBytes(32).toString("hex");
  assert.equal(check("POST", { csrf: token }, token), undefined);
  denied(check("POST", { csrf: token }, undefined));
  denied(check("POST", { csrf: token }, "different"));
  denied(check("POST", { csrf: token }, token, "https://untrusted.example"));
});

test("customer safe methods retain their existing CSRF behavior", () => {
  for (const method of ["GET", "HEAD", "OPTIONS"]) {
    assert.equal(check(method, undefined), undefined);
  }
});
