import test, { beforeEach, afterEach, after } from "node:test";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { createQuote, createApplication } from "../server/services.ts";
import type { Server } from "node:http";
import { createApp } from "../server/app.ts";
import { config, validateIdentityConfiguration } from "../server/config.ts";
import { pool, transaction } from "../server/db.ts";
import { products } from "../server/catalog.ts";
import { hash } from "../server/domain.ts";
import {
  overview,
  cases,
  caseEvidence,
  integrationStatus,
  paymentExceptions,
  insurerTimeouts,
} from "../server/operations.ts";

let server: Server;

for (const [kind, endpointName] of [
  ["payment exception", "payment-exceptions"],
  ["insurer timeout", "insurer-timeouts"],
]) {
  test(`${kind} projection rejects anonymous requests and invalid scope`, async () => {
    const endpoint = `${origin}/ops/v1/${endpointName}`;
    assert.equal((await fetch(endpoint)).status, 401);
    const staff = await openDemo();
    for (const query of [
      "limit=0",
      "limit=101",
      "limit=1.5",
      "limit=1&limit=2",
      "tenant=other",
      "role=operations",
      "payment=settled",
      "limit=%27%20OR%201%3D1",
    ]) {
      const response = await fetch(`${endpoint}?${query}`, {
        headers: { Cookie: staff.cookie },
      });
      assert.equal(response.status, 400, query);
    }
  });

  test(`${kind} projection has bounded ordered snapshot, isolated rows and unchanged evidence`, async () => {
    const staff = await openDemo();
    const other = await openDemo();
    const actor = {
      tenant: staff.tenant,
      user: "exception-read-test",
      role: "operations" as const,
    };
    const headers = { Cookie: staff.cookie };
    const read = async (limit = 50) => {
      const response = await fetch(
        `${origin}/ops/v1/${endpointName}?limit=${limit}`,
        { headers },
      );
      assert.equal(response.status, 200);
      assert.match(response.headers.get("cache-control") || "", /no-store/);
      return response.json();
    };
    const initial = await read();
    assert.equal(initial.count, 1);
    assert.equal(
      initial.cases[0][
        kind === "payment exception" ? "paymentStatus" : "insurerStatus"
      ],
      kind === "payment exception" ? "reconciliation_required" : "timeout",
    );
    assert.equal(initial.synthetic, true);
    assert.equal(initial.tenant, staff.tenant);
    assert.equal(initial.truncated, false);
    assert.ok(Number.isFinite(Date.parse(initial.asOf)));
    assert.match(initial.asOf, /Z$/);

    // Domain-created synthetic cases; fixed times deliberately exercise the ID tie-breaker.
    const customer = {
      tenant: staff.tenant,
      user: randomUUID(),
      role: "customer" as const,
    };
    for (let n = 0; n < 101; n++) {
      const quote = await createQuote(customer, {
        productId: "travel-essential",
        age: 30,
        days: 7,
      });
      await createApplication(
        customer,
        {
          quoteId: quote.id,
          fullName: "Synthetic Exception",
          email: "exception@example.test",
          consent: true,
          disclosure: true,
        },
        randomUUID(),
      );
    }
    await transaction(actor, async (db) => {
      await db.query(
        kind === "payment exception"
          ? "UPDATE invoices SET status='failed' WHERE owner_id=$1"
          : "UPDATE applications SET insurer_status='timeout' WHERE owner_id=$1",
        [customer.user],
      );
      await db.query(
        "UPDATE applications SET created_at='2026-01-01T00:00:00Z' WHERE owner_id=$1",
        [customer.user],
      );
    });
    const snapshot = () =>
      transaction(actor, async (db) => {
        const result = await db.query(`SELECT
      (SELECT jsonb_agg(to_jsonb(a) ORDER BY id) FROM applications a) AS applications,
      (SELECT jsonb_agg(to_jsonb(i) ORDER BY id) FROM invoices i) AS invoices,
      (SELECT count(*) FROM audit_events) AS audit,
      (SELECT count(*) FROM provider_events) AS events,
      (SELECT count(*) FROM outbox) AS outbox`);
        return result.rows[0];
      });
    const beforeReads = await snapshot();
    const full = await read(100);
    assert.equal(full.count, 102);
    assert.equal(full.cases.length, 100);
    assert.equal(full.limit, 100);
    assert.equal(full.truncated, true);
    const prefix = await read(1);
    assert.equal(prefix.count, 102);
    assert.equal(prefix.cases.length, 1);
    assert.equal(prefix.truncated, true);
    assert.deepEqual(prefix.cases, full.cases.slice(0, 1));
    assert.deepEqual((await read(100)).cases, full.cases);
    const summary = await (
      await fetch(`${origin}/ops/v1/overview`, { headers })
    ).json();
    assert.equal(
      summary.summary[
        kind === "payment exception" ? "paymentExceptions" : "insurerTimeouts"
      ],
      full.count,
    );
    for (let n = 0; n < full.cases.length; n++) {
      const row = full.cases[n];
      assert.ok(
        kind === "payment exception"
          ? ["failed", "reconciliation_required"].includes(row.paymentStatus)
          : row.insurerStatus === "timeout",
      );
      assert.deepEqual(
        Object.keys(row).sort(),
        [
          "caseId",
          "reference",
          "productId",
          "productVersion",
          "insurerStatus",
          "paymentStatus",
          "amountMinor",
          "currency",
          "createdAt",
          "updatedAt",
        ].sort(),
      );
      if (n) {
        const previous = full.cases[n - 1];
        assert.ok(
          Date.parse(previous.createdAt) > Date.parse(row.createdAt) ||
            (previous.createdAt === row.createdAt &&
              previous.caseId > row.caseId),
        );
      }
    }
    assert.equal(
      JSON.stringify(full).includes("exception@example.test"),
      false,
    );
    assert.equal(JSON.stringify(full).includes("coverage"), false);
    const otherResponse = await fetch(`${origin}/ops/v1/${endpointName}`, {
      headers: { Cookie: other.cookie },
    });
    const foreign = await otherResponse.json();
    assert.equal(foreign.count, 1);
    assert.ok(
      foreign.cases.every(
        (row: { caseId: string }) =>
          !full.cases.some(
            (own: { caseId: string }) => own.caseId === row.caseId,
          ),
      ),
    );
    const detailResponse = await fetch(
      `${origin}/ops/v1/cases/${full.cases[1].caseId}`,
      { headers },
    );
    const detail = await detailResponse.json();
    assert.deepEqual(detail.allowedActions, []);
    assert.equal(detail.payment.status, full.cases[1].paymentStatus);
    assert.equal(detail.insurerStatus, full.cases[1].insurerStatus);
    assert.equal(
      (
        await fetch(`${origin}/ops/v1/cases/${full.cases[1].caseId}`, {
          headers: { Cookie: other.cookie },
        })
      ).status,
      404,
    );
    assert.deepEqual(await snapshot(), beforeReads);
    await transaction(actor, (db) =>
      db.query(
        kind === "payment exception"
          ? "UPDATE invoices SET status='pending' WHERE status IN ('failed','reconciliation_required')"
          : "UPDATE applications SET insurer_status='processing' WHERE insurer_status='timeout'",
      ),
    );
    const empty = await read();
    assert.equal(empty.count, 0);
    assert.deepEqual(empty.cases, []);
    assert.equal(empty.truncated, false);
  });
}

let origin: string;
beforeEach(async () => {
  assert.equal(config.demo, true);
  server = createApp().listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  origin = `http://127.0.0.1:${address.port}`;
});
afterEach(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
});
after(() => pool.end());

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
    () => paymentExceptions(customer, {}),
    () => insurerTimeouts(customer, {}),
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

// Database-backed acceptance cases: run only in an authorized isolated demo DB.
test("product inspection rejects anonymous and customer sessions before preview CSRF", async () => {
  assert.equal((await fetch(`${origin}/ops/v1/products`)).status, 401);
  const anonymous = await fetch(
    `${origin}/ops/v1/products/travel-essential/preview`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    },
  );
  assert.equal(anonymous.status, 401);
  assert.equal((await anonymous.json()).error.code, "STAFF_SIGN_IN_REQUIRED");

  const initial = await fetch(`${origin}/api/session`);
  const initialCookie = initial.headers.getSetCookie()[0].split(";")[0];
  const initialSession = await initial.json();
  const login = await fetch(`${origin}/api/auth/demo`, {
    method: "POST",
    headers: {
      Cookie: initialCookie,
      "Content-Type": "application/json",
      Origin: config.origin,
      "X-CSRF-Token": initialSession.csrf,
    },
    body: "{}",
  });
  assert.equal(login.status, 200);
  const customerCookie = login.headers.getSetCookie()[0].split(";")[0];
  for (const cookie of [
    customerCookie,
    customerCookie.replace("bt_session=", "bt_ops_session="),
  ]) {
    assert.equal(
      (
        await fetch(`${origin}/ops/v1/products`, {
          headers: { Cookie: cookie },
        })
      ).status,
      401,
    );
    assert.equal(
      (
        await fetch(`${origin}/ops/v1/products/travel-essential/preview`, {
          method: "POST",
          headers: { Cookie: cookie, "Content-Type": "application/json" },
          body: "{}",
        })
      ).status,
      401,
    );
  }
});

test("staff product previews validate boundaries and leave all seven business tables unchanged", async () => {
  const staff = await openDemo();
  const other = await openDemo();
  const headers = {
    Cookie: staff.cookie,
    "Content-Type": "application/json",
    Origin: config.origin,
    "X-CSRF-Token": staff.csrf,
  };
  const snapshot = () =>
    transaction(
      { tenant: staff.tenant, user: "inspection-test", role: "operations" },
      async (db) => {
        const records: Record<string, unknown[]> = {};
        for (const table of [
          "quotes",
          "applications",
          "invoices",
          "provider_events",
          "payment_inbox",
          "outbox",
          "audit_events",
        ])
          records[table] = (
            await db.query(
              `SELECT to_jsonb(record) AS record FROM ${table} AS record ORDER BY id`,
            )
          ).rows;
        return records;
      },
    );
  const beforePreview = await snapshot();
  const response = await fetch(`${origin}/ops/v1/products`, { headers });
  assert.equal(response.status, 200);
  assert.match(response.headers.get("cache-control") || "", /no-store/);
  const inspection = await response.json();
  assert.equal(inspection.mode, "inspection");
  assert.equal(inspection.synthetic, true);
  assert.equal(inspection.products.length, products.length);
  const input = {
    productVersion: products[0].version,
    ruleVersion: products[0].ruleVersion,
    age: 30,
    days: 7,
  };
  const previewUrl = `${origin}/ops/v1/products/travel-essential/preview`;
  const preview = (body: unknown, requestHeaders = headers, url = previewUrl) =>
    fetch(url, {
      method: "POST",
      headers: requestHeaders,
      body: JSON.stringify(body),
    });
  for (let attempt = 0; attempt < 2; attempt++) {
    const result = await preview(input);
    assert.equal(result.status, 200);
    const body = await result.json();
    assert.equal(body.total, 168000);
    assert.equal(body.previewOnly, true);
    assert.equal(body.productVersion, input.productVersion);
    assert.equal(body.ruleVersion, input.ruleVersion);
    assert.equal("id" in body, false);
    assert.equal("expiresAt" in body, false);
  }
  for (const invalidHeaders of [
    { ...headers, "X-CSRF-Token": "" },
    { ...headers, "X-CSRF-Token": other.csrf },
    { ...headers, Origin: "https://foreign.example.test" },
    { ...headers, Origin: "" },
  ])
    assert.equal((await preview(input, invalidHeaders)).status, 403);
  assert.equal(
    (
      await fetch(`${origin}/ops/v1/products?tenant=${other.tenant}`, {
        headers,
      })
    ).status,
    400,
  );
  for (const field of ["tenant", "role", "actor", "premium", "productId"])
    assert.equal(
      (await preview({ ...input, [field]: "injected" })).status,
      400,
    );
  for (const field of ["productVersion", "ruleVersion"]) {
    const result = await preview({ ...input, [field]: "stale" });
    assert.equal(result.status, 409);
    assert.equal((await result.json()).error.code, "PRODUCT_VERSION_MISMATCH");
  }
  assert.equal(
    (await preview(input, headers, `${origin}/ops/v1/products/unknown/preview`))
      .status,
    404,
  );
  assert.equal((await preview({ ...input, age: 17 })).status, 400);
  const invalidCoverage = await preview({
    ...input,
    coverageAmount: 160000000,
  });
  assert.equal(invalidCoverage.status, 400);
  assert.equal((await invalidCoverage.json()).error.code, "INVALID_COVERAGE");
  assert.deepEqual(await snapshot(), beforePreview);

  assert.equal(
    (await fetch(`${origin}/ops/auth/logout`, { method: "POST", headers }))
      .status,
    200,
  );
  assert.equal(
    (await fetch(`${origin}/ops/v1/products`, { headers })).status,
    401,
  );
  assert.equal((await preview(input)).status, 401);
});

test("elapsed staff sessions cannot inspect products or preview pricing", async () => {
  const staff = await openDemo();
  const product = products.find((item) => item.id === "travel-essential")!;
  const requests = (cookie: string) => [
    fetch(`${origin}/ops/v1/products`, { headers: { Cookie: cookie } }),
    fetch(`${origin}/ops/v1/products/${product.id}/preview`, {
      method: "POST",
      headers: {
        Cookie: cookie,
        "Content-Type": "application/json",
        Origin: config.origin,
        "X-CSRF-Token": staff.csrf,
      },
      body: JSON.stringify({
        productVersion: product.version,
        ruleVersion: product.ruleVersion,
        age: 30,
        days: 7,
      }),
    }),
  ];
  for (const response of await Promise.all(requests(staff.cookie)))
    assert.equal(response.status, 200);

  const expiredToken = randomBytes(32).toString("hex");
  const tokenHash = hash(expiredToken);
  try {
    // Copy valid session data with an elapsed DB timestamp; runtime cannot UPDATE sessions.
    const expired = await pool.query(
      `INSERT INTO auth_sessions(token_hash,data,expires_at)
       SELECT $1,data,now()-interval '1 second' FROM auth_sessions WHERE token_hash=$2
       RETURNING expires_at<=now() AS expired`,
      [tokenHash, hash(staff.cookie.split("=")[1])],
    );
    assert.equal(expired.rowCount, 1);
    assert.equal(expired.rows[0].expired, true);
    for (const response of await Promise.all(
      requests(`bt_ops_session=${expiredToken}`),
    )) {
      assert.equal(response.status, 401);
      assert.equal(
        (await response.json()).error.code,
        "STAFF_SIGN_IN_REQUIRED",
      );
    }
  } finally {
    await pool.query("DELETE FROM auth_sessions WHERE token_hash=$1", [
      tokenHash,
    ]);
  }
});
