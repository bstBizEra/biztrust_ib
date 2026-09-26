import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import type { Server } from "node:http";
import { createApp } from "../server/app.ts";
import { config, validateIdentityConfiguration } from "../server/config.ts";
import { pool } from "../server/db.ts";
import {
  overview,
  cases,
  caseEvidence,
  integrationStatus,
} from "../server/operations.ts";

let server: Server;
let origin: string;
before(async () => {
  assert.equal(config.demo, true);
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
});

async function anonymousStaff() {
  const response = await fetch(`${origin}/ops/v1/session`);
  assert.equal(response.status, 200);
  assert.match(response.headers.get("cache-control") || "", /no-store/);
  const cookie = response.headers.getSetCookie()[0].split(";")[0];
  const session = await response.json();
  assert.equal(session.authenticated, false);
  return { cookie, csrf: session.csrf as string };
}

async function openDemo() {
  const anon = await anonymousStaff();
  const response = await fetch(`${origin}/ops/auth/demo`, {
    method: "POST",
    headers: {
      Cookie: anon.cookie,
      "Content-Type": "application/json",
      Origin: config.origin,
      "X-CSRF-Token": anon.csrf,
    },
    body: "{}",
  });
  assert.equal(response.status, 200);
  const cookie = response.headers.getSetCookie()[0].split(";")[0];
  const session = await response.json();
  assert.equal(session.authenticated, true);
  assert.match(session.tenant, /^ops-demo-/);
  assert.notEqual(anon.cookie, cookie);
  return {
    cookie,
    csrf: session.csrf as string,
    tenant: session.tenant as string,
  };
}

test("operations use cases require staff capabilities even when called without HTTP", async () => {
  const customer = {
    tenant: "example",
    user: "example",
    role: "customer" as const,
  };
  for (const call of [
    () => overview(customer),
    () => cases(customer, {}),
    () => caseEvidence(customer, "unused"),
    () => integrationStatus(customer),
  ])
    await assert.rejects(call, /requires staff access/);
});

test("staff and customer clients cannot share the same issuer/client identity", () => {
  const previous = {
    issuer: config.issuer,
    staffIssuer: config.staffIssuer,
    clientId: config.clientId,
    staffClientId: config.staffClientId,
  };
  try {
    Object.assign(config, {
      issuer: "https://identity.example",
      staffIssuer: "https://identity.example/",
      clientId: "same-client",
      staffClientId: "same-client",
    });
    assert.throws(validateIdentityConfiguration, /separate OIDC clients/);
    config.staffIssuer = "https://IDENTITY.example:443/";
    assert.throws(validateIdentityConfiguration, /separate OIDC clients/);
    config.staffClientId = "staff-client";
    assert.doesNotThrow(validateIdentityConfiguration);
  } finally {
    Object.assign(config, previous);
  }
});

test("local staff demo requires CSRF and cannot accept browser-selected tenant or role", async () => {
  const anon = await anonymousStaff();
  const response = await fetch(`${origin}/ops/auth/demo`, {
    method: "POST",
    headers: { Cookie: anon.cookie, "Content-Type": "application/json" },
    body: "{}",
  });
  assert.equal(response.status, 403);
  const injected = await fetch(`${origin}/ops/auth/demo`, {
    method: "POST",
    headers: {
      Cookie: anon.cookie,
      "Content-Type": "application/json",
      Origin: config.origin,
      "X-CSRF-Token": anon.csrf,
    },
    body: JSON.stringify({ tenant: "biztrust-demo", role: "operations" }),
  });
  assert.equal(injected.status, 400);
});

test("staff demo workspace is isolated, serves real domain evidence, and logout revokes it", async () => {
  const first = await openDemo();
  const second = await openDemo();
  assert.notEqual(first.tenant, second.tenant);
  const headers = { Cookie: first.cookie };
  const list = await (
    await fetch(`${origin}/ops/v1/cases`, { headers })
  ).json();
  assert.equal(list.length, 5);
  const summary = await (
    await fetch(`${origin}/ops/v1/overview`, { headers })
  ).json();
  assert.equal(summary.summary.paymentPending, 1);
  assert.equal(summary.summary.paymentExceptions, 1);
  assert.equal(summary.summary.insurerTimeouts, 1);
  const detail = await (
    await fetch(`${origin}/ops/v1/cases/${list[0].caseId}`, { headers })
  ).json();
  assert.ok(detail.timeline.length > 0);
  assert.equal(
    JSON.stringify(detail).includes("operations-example@example.test"),
    false,
  );
  assert.equal(
    (
      await fetch(`${origin}/ops/v1/cases/${list[0].caseId}`, {
        headers: { Cookie: second.cookie },
      })
    ).status,
    404,
  );
  try {
    config.demo = false;
    assert.equal(
      (await fetch(`${origin}/ops/v1/cases`, { headers })).status,
      401,
    );
  } finally {
    config.demo = true;
  }
  const logout = await fetch(`${origin}/ops/auth/logout`, {
    method: "POST",
    headers: { ...headers, Origin: config.origin, "X-CSRF-Token": first.csrf },
  });
  assert.equal(logout.status, 200);
  assert.equal(
    (await fetch(`${origin}/ops/v1/cases`, { headers })).status,
    401,
  );
});
