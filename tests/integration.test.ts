import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID, randomBytes } from "node:crypto";
import type { Server } from "node:http";
import pg from "pg";
import { createApp } from "../server/app.ts";
import {
  pool,
  transaction,
  assertRuntimeRole,
  type Actor,
} from "../server/db.ts";
import { config } from "../server/config.ts";
import {
  createQuote,
  createApplication,
  applicationDetail,
  processPayment,
  simulatorInsurer,
} from "../server/services.ts";
import { hash, signEvent } from "../server/domain.ts";

const run = randomUUID();
const alice: Actor = {
  tenant: `test-a-${run}`,
  user: `alice-${run}`,
  role: "customer",
};
const bob: Actor = {
  tenant: `test-a-${run}`,
  user: `bob-${run}`,
  role: "customer",
};
const eve: Actor = {
  tenant: `test-b-${run}`,
  user: `eve-${run}`,
  role: "customer",
};
let server: Server;
let origin: string;
before(async () => {
  assert.equal(
    config.demo,
    true,
    "Integration tests require demonstration mode",
  );
  await assertRuntimeRole();
  server = createApp().listen(0, "127.0.0.1");
  await new Promise<void>((r) => server.once("listening", r));
  const address = server.address();
  origin = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
});
after(async () => {
  await new Promise<void>((r, j) => server.close((e) => (e ? j(e) : r())));
  await pool.end();
});
async function fixture(actor = alice) {
  const quote = await createQuote(actor, {
    productId: "travel-essential",
    age: 30,
    days: 7,
  });
  const body = {
    quoteId: quote.id,
    fullName: "Synthetic Tester",
    email: "synthetic@example.test",
    consent: true,
    disclosure: true,
  };
  const key = randomUUID();
  const application = await createApplication(actor, body, key);
  return {
    body,
    key,
    reference: application.reference,
    ...(await applicationDetail(actor, application.reference)),
  };
}
function eventFor(f: Awaited<ReturnType<typeof fixture>>, actor = alice) {
  return {
    eventId: `test-${randomUUID()}`,
    tenant: actor.tenant,
    owner: actor.user,
    invoiceId: f.invoice.id,
    providerReference: f.invoice.provider_reference,
    amount: Number(f.invoice.amount),
    currency: "LAK" as const,
    status: "settled" as const,
  };
}
async function session(actor: Actor) {
  const token = randomBytes(32).toString("hex");
  const csrf = randomBytes(32).toString("hex");
  await pool.query(
    "INSERT INTO auth_sessions(token_hash,data,expires_at) VALUES($1,$2,now()+interval '1 hour')",
    [
      hash(token),
      JSON.stringify({ actor, csrf, mode: "demo", name: "Synthetic Test" }),
    ],
  );
  return {
    Cookie: `bt_session=${token}`,
    "X-CSRF-Token": csrf,
    Origin: config.origin,
  };
}
async function staffSession(tenant: string) {
  const user = `ops-${randomUUID()}`;
  const admin = new pg.Client({
    connectionString: process.env.DATABASE_ADMIN_URL,
  });
  await admin.connect();
  try {
    await admin.query(
      "INSERT INTO memberships(subject,tenant_id,owner_id,role) VALUES($1,$2,$3,'operations')",
      [`staff-test-${randomUUID()}`, tenant, user],
    );
  } finally {
    await admin.end();
  }
  const token = randomBytes(32).toString("hex");
  await pool.query(
    "INSERT INTO auth_sessions(token_hash,data,expires_at) VALUES($1,$2,now()+interval '1 hour')",
    [
      hash(token),
      JSON.stringify({
        audience: "operations",
        actor: { tenant, user, role: "operations" },
        csrf: randomBytes(32).toString("hex"),
      }),
    ],
  );
  return { Cookie: `bt_ops_session=${token}` };
}

test("runtime uses a non-superuser, non-bypass role and all business tables force RLS", async () => {
  const role = (
    await pool.query(
      "SELECT rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user",
    )
  ).rows[0];
  assert.equal(role.rolsuper, false);
  assert.equal(role.rolbypassrls, false);
  const tables = (
    await pool.query(
      "SELECT relrowsecurity,relforcerowsecurity FROM pg_class WHERE relname IN ('quotes','applications','invoices','outbox','provider_events','audit_events')",
    )
  ).rows;
  assert.equal(tables.length, 6);
  assert.ok(tables.every((t) => t.relrowsecurity && t.relforcerowsecurity));
});
test("RLS blocks another customer, another tenant, missing context, and context leakage through pooled connections", async () => {
  const f = await fixture();
  for (const actor of [bob, eve, { ...eve, role: "operations" as const }])
    await assert.rejects(
      applicationDetail(actor, f.reference),
      /could not be found/,
    );
  assert.equal(
    (
      await pool.query("SELECT * FROM applications WHERE reference=$1", [
        f.reference,
      ])
    ).rowCount,
    0,
  );
  for (let i = 0; i < 12; i++)
    await transaction(i % 2 ? eve : alice, async (db) =>
      assert.equal(
        (
          await db.query("SELECT id FROM applications WHERE reference=$1", [
            f.reference,
          ])
        ).rowCount,
        i % 2 ? 0 : 1,
      ),
    );
  await assert.rejects(
    transaction(eve, async (db) =>
      db.query(
        "INSERT INTO audit_events(tenant_id,owner_id,action,resource_id) VALUES($1,$2,$3,$4)",
        [alice.tenant, alice.user, "invalid", "test"],
      ),
    ),
    /row-level security/,
  );
});
test("application submission is durable and exactly-once under concurrent retries; changed requests conflict", async () => {
  const quote = await createQuote(alice, {
    productId: "motor-essential",
    age: 30,
    days: 7,
  });
  const key = randomUUID();
  const body = {
    quoteId: quote.id,
    fullName: "Synthetic Tester",
    email: "synthetic@example.test",
    consent: true,
    disclosure: true,
  };
  const results = await Promise.all(
    Array.from({ length: 5 }, () => createApplication(alice, body, key)),
  );
  assert.equal(new Set(results.map((r) => r.reference)).size, 1);
  assert.equal(results.filter((r) => !r.duplicate).length, 1);
  await assert.rejects(
    createApplication(alice, { ...body, fullName: "Changed Tester" }, key),
    /different information/,
  );
  await assert.rejects(
    createApplication(alice, body, randomUUID()),
    /already has an application/,
  );
});
test("another tenant cannot submit a stolen quote or view documents; customer cannot read operations", async () => {
  const f = await fixture();
  await assert.rejects(
    createApplication(eve, f.body, randomUUID()),
    /could not be found/,
  );
  const headers = await session(eve);
  const response = await fetch(
    `${origin}/api/applications/${f.reference}/document`,
    { headers },
  );
  assert.equal(response.status, 404);
  const forbidden = await fetch(`${origin}/ops/v1/overview`, {
    headers: await session(alice),
  });
  assert.equal(forbidden.status, 401);
});
test("anonymous requests and cross-origin mutations fail closed", async () => {
  const unauth = await fetch(`${origin}/api/applications`);
  assert.equal(unauth.status, 401);
  const headers = await session(alice);
  const response = await fetch(`${origin}/api/quotes`, {
    method: "POST",
    headers: {
      ...headers,
      Origin: "https://untrusted.example",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ productId: "motor-essential", age: 30, days: 7 }),
  });
  assert.equal(response.status, 403);
  const invalid = await fetch(`${origin}/api/quotes`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({
      productId: "motor-essential",
      age: 30,
      days: 7,
      tenant: eve.tenant,
    }),
  });
  assert.equal(invalid.status, 400);
});
test("browser cannot forge payment; a valid signed callback settles once and creates one insurer outbox item", async () => {
  const f = await fixture();
  const event = eventFor(f);
  const body = JSON.stringify(event);
  const timestamp = String(Date.now());
  const forged = await fetch(`${origin}/api/webhooks/payment`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Provider-Timestamp": timestamp,
      "X-Provider-Signature": "0".repeat(64),
    },
    body,
  });
  assert.equal(forged.status, 401);
  assert.equal(
    (await applicationDetail(alice, f.reference)).invoice.status,
    "pending",
  );
  const headers = {
    "Content-Type": "application/json",
    "X-Provider-Timestamp": timestamp,
    "X-Provider-Signature": signEvent(body, timestamp, config.webhookSecret),
  };
  const response = await fetch(`${origin}/api/webhooks/payment`, {
    method: "POST",
    headers,
    body,
  });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).outcome, "settled");
  assert.equal((await processPayment(event)).duplicate, true);
  await assert.rejects(
    processPayment({ ...event, amount: 1 }),
    /different payload/,
  );
  const detail = await applicationDetail(alice, f.reference);
  assert.equal(detail.invoice.status, "settled");
  assert.equal(detail.application.insurer_status, "queued");
  assert.equal(detail.application.evidence, null);
  await transaction(alice, async (db) =>
    assert.equal(
      (
        await db.query("SELECT * FROM outbox WHERE application_id=$1", [
          detail.application.id,
        ])
      ).rowCount,
      1,
    ),
  );
});
test("amount mismatch and late payment enter reconciliation without marking insurer accepted", async () => {
  const f = await fixture();
  assert.equal(
    (await processPayment({ ...eventFor(f), amount: 1 })).outcome,
    "reconciliation_required",
  );
  assert.equal(
    (await processPayment(eventFor(f))).outcome,
    "reconciliation_required",
    "Subsequent callbacks must not clear a finance review hold automatically",
  );
  assert.equal(
    (await applicationDetail(alice, f.reference)).application.insurer_status,
    "awaiting_payment",
  );
  const late = await fixture();
  await transaction(alice, (db) =>
    db.query(
      "UPDATE invoices SET expires_at=now()-interval '1 minute' WHERE id=$1",
      [late.invoice.id],
    ),
  );
  const headers = await session(alice);
  const qr = await fetch(`${origin}/api/applications/${late.reference}/qr`, {
    headers,
  });
  assert.equal(qr.status, 409);
  assert.equal(
    (await processPayment(eventFor(late))).outcome,
    "late_payment_review",
  );
  assert.equal(
    (await applicationDetail(alice, late.reference)).invoice.status,
    "reconciliation_required",
  );
});
test("expired quotes cannot create applications and malformed JSON returns a safe client error", async () => {
  const f = await fixture();
  const expiredId = randomUUID();
  await transaction(alice, (db) =>
    db.query(
      "INSERT INTO quotes(id,tenant_id,owner_id,product_id,product_version,rule_version,input,premium,fee,total,currency,expires_at) SELECT $1,tenant_id,owner_id,product_id,product_version,rule_version,input,premium,fee,total,currency,now()-interval '1 minute' FROM quotes WHERE id=$2",
      [expiredId, f.body.quoteId],
    ),
  );
  await assert.rejects(
    createApplication(alice, { ...f.body, quoteId: expiredId }, randomUUID()),
    /quote has expired/,
  );
  const response = await fetch(`${origin}/api/quotes`, {
    method: "POST",
    headers: { ...(await session(alice)), "Content-Type": "application/json" },
    body: "{broken",
  });
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error.code, "INVALID_JSON");
});
test("failed and delayed duplicate events cannot reverse settlement", async () => {
  const f = await fixture();
  const event = eventFor(f);
  await processPayment({ ...event, status: "failed" });
  assert.equal(
    (await applicationDetail(alice, f.reference)).invoice.status,
    "failed",
  );
  await processPayment({ ...event, eventId: `retry-${randomUUID()}` });
  const delayed = await processPayment({
    ...event,
    eventId: `late-${randomUUID()}`,
    status: "failed",
  });
  assert.equal(delayed.outcome, "already_settled");
  assert.equal(
    (await applicationDetail(alice, f.reference)).invoice.status,
    "settled",
  );
});
test("insurer timeout, referral, information request and synthetic issuance retain separate evidence", async () => {
  const f = await fixture();
  await assert.rejects(
    simulatorInsurer(alice, f.reference, "issued"),
    /not available/,
  );
  await processPayment(eventFor(f));
  for (const state of [
    "timeout",
    "processing",
    "referred",
    "additional_information",
    "processing",
    "issued",
  ])
    await simulatorInsurer(alice, f.reference, state);
  const detail = await applicationDetail(alice, f.reference);
  assert.equal(detail.application.evidence.synthetic, true);
  assert.equal(detail.application.evidence.noCoverage, true);
  assert.equal(
    (await simulatorInsurer(alice, f.reference, "issued")).duplicate,
    true,
  );
  const doc = await fetch(
    `${origin}/api/applications/${f.reference}/document`,
    { headers: await session(alice) },
  );
  assert.equal(doc.status, 200);
  assert.match(await doc.text(), /NOT AN INSURANCE POLICY/);
  await assert.rejects(
    simulatorInsurer(alice, f.reference, "rejected"),
    /not available/,
  );
});
test("audit records cannot be updated or deleted by the application role", async () => {
  await assert.rejects(
    transaction(alice, (db) =>
      db.query("UPDATE audit_events SET action='tampered' WHERE owner_id=$1", [
        alice.user,
      ]),
    ),
    /permission denied/,
  );
  await assert.rejects(
    transaction(alice, (db) =>
      db.query("DELETE FROM audit_events WHERE owner_id=$1", [alice.user]),
    ),
    /permission denied/,
  );
});
test("staff API uses its own audience and only returns tenant-scoped, masked case evidence", async () => {
  const f = await fixture();
  await processPayment({ ...eventFor(f), amount: 1 });
  const allowed = await fetch(
    `${origin}/ops/v1/cases?payment=reconciliation_required`,
    {
      headers: await staffSession(alice.tenant),
    },
  );
  assert.equal(allowed.status, 200);
  const matching = (await allowed.json()).find(
    (r: { reference: string }) => r.reference === f.reference,
  );
  assert.ok(matching);
  assert.equal(matching.paymentStatus, "reconciliation_required");
  assert.equal(JSON.stringify(matching).includes("Synthetic Tester"), false);
  const detail = await fetch(`${origin}/ops/v1/cases/${matching.caseId}`, {
    headers: await staffSession(alice.tenant),
  });
  assert.equal(detail.status, 200);
  assert.equal(
    JSON.stringify(await detail.json()).includes("synthetic@example.test"),
    false,
  );
  const denied = await fetch(`${origin}/ops/v1/cases`, {
    headers: await staffSession(eve.tenant),
  });
  assert.equal(denied.status, 200);
  assert.ok(
    !(await denied.json()).some(
      (r: { reference: string }) => r.reference === f.reference,
    ),
  );
  const otherDetail = await fetch(`${origin}/ops/v1/cases/${matching.caseId}`, {
    headers: await staffSession(eve.tenant),
  });
  assert.equal(otherDetail.status, 404);
  const customerCookie = await session({ ...alice, role: "operations" });
  const wrongAudience = await fetch(`${origin}/ops/v1/cases`, {
    headers: customerCookie,
  });
  assert.equal(wrongAudience.status, 401);
  const staffCookie = await staffSession(alice.tenant);
  const reusedAtCustomerApi = await fetch(`${origin}/api/applications`, {
    headers: {
      Cookie: staffCookie.Cookie.replace("bt_ops_session=", "bt_session="),
    },
  });
  assert.equal(reusedAtCustomerApi.status, 401);
  const originalStaffStillValid = await fetch(`${origin}/ops/v1/cases`, {
    headers: staffCookie,
  });
  assert.equal(originalStaffStillValid.status, 200);
  const originalCustomer = await session(alice);
  await fetch(`${origin}/ops/v1/session`, {
    headers: {
      Cookie: originalCustomer.Cookie.replace("bt_session=", "bt_ops_session="),
    },
  });
  assert.equal(
    (await fetch(`${origin}/api/applications`, { headers: originalCustomer }))
      .status,
    200,
  );
  const legacyOperations = await fetch(
    `${origin}/api/operations/reconciliation`,
    {
      headers: customerCookie,
    },
  );
  assert.equal(legacyOperations.status, 404);
});
