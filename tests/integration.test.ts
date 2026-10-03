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

test("audit correlation binds concurrent quotes to generated HTTP request IDs without caller influence", async () => {
  const headers = await Promise.all([session(alice), session(eve)]);
  const results = await Promise.all(
    Array.from({ length: 8 }, async (_, index) => {
      const actor = index % 2 ? eve : alice;
      const response = await fetch(`${origin}/api/quotes`, {
        method: "POST",
        headers: {
          ...headers[index % 2],
          "Content-Type": "application/json",
          "X-Request-Id": "caller-controlled-id",
        },
        body: JSON.stringify({
          productId: "travel-essential",
          age: 30,
          days: 7,
        }),
      });
      assert.equal(response.status, 201);
      const requestId = response.headers.get("x-request-id");
      assert.match(
        requestId || "",
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      );
      return { actor, requestId, quote: await response.json() };
    }),
  );
  assert.equal(new Set(results.map((r) => r.requestId)).size, 8);
  for (const { actor, requestId, quote } of results) {
    const events = await transaction(actor, (db) =>
      db.query(
        "SELECT tenant_id,owner_id,detail FROM audit_events WHERE resource_id=$1",
        [quote.id],
      ),
    );
    assert.equal(events.rows.length, 1);
    assert.equal(events.rows[0].tenant_id, actor.tenant);
    assert.equal(events.rows[0].owner_id, actor.user);
    assert.deepEqual(events.rows[0].detail, {
      ruleVersion: quote.ruleVersion,
      synthetic: true,
      requestId,
    });
    const other = actor === alice ? eve : alice;
    assert.equal(
      (
        await transaction(other, (db) =>
          db.query("SELECT id FROM audit_events WHERE resource_id=$1", [
            quote.id,
          ]),
        )
      ).rowCount,
      0,
    );
  }
  const direct = await createQuote(alice, {
    productId: "travel-essential",
    age: 30,
    days: 7,
  });
  const row = await transaction(alice, (db) =>
    db.query("SELECT detail FROM audit_events WHERE resource_id=$1", [
      direct.id,
    ]),
  );
  assert.deepEqual(row.rows[0].detail, {
    ruleVersion: direct.ruleVersion,
    synthetic: true,
  });
});

test("audit correlation links submission and verified payment attempts while preserving original replay evidence", async () => {
  const quote = await createQuote(alice, {
    productId: "travel-essential",
    age: 30,
    days: 7,
  });
  const headers = {
    ...(await session(alice)),
    "Content-Type": "application/json",
    "Idempotency-Key": randomUUID(),
  };
  const body = JSON.stringify({
    quoteId: quote.id,
    fullName: "Synthetic Correlation",
    email: "correlation@example.test",
    consent: true,
    disclosure: true,
  });
  const submit = () =>
    fetch(`${origin}/api/applications`, { method: "POST", headers, body });
  const response = await submit();
  assert.equal(response.status, 201);
  const submissionId = response.headers.get("x-request-id");
  const { reference } = await response.json();
  const detail = await applicationDetail(alice, reference);
  assert.equal(detail.history.length, 2);
  assert.ok(detail.history.every((e) => e.detail.requestId === submissionId));
  const replay = await submit();
  assert.equal(replay.status, 200);
  assert.notEqual(replay.headers.get("x-request-id"), submissionId);
  assert.deepEqual(
    (await applicationDetail(alice, reference)).history,
    detail.history,
  );

  const event = {
    eventId: `correlation-${randomUUID()}`,
    tenant: alice.tenant,
    owner: alice.user,
    invoiceId: detail.invoice.id,
    providerReference: detail.invoice.provider_reference,
    amount: Number(detail.invoice.amount),
    currency: "LAK",
    status: "settled",
  };
  const raw = JSON.stringify(event);
  const timestamp = String(Date.now());
  const callback = () =>
    fetch(`${origin}/api/webhooks/payment`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Provider-Timestamp": timestamp,
        "X-Provider-Signature": signEvent(raw, timestamp, config.webhookSecret),
        "X-Request-Id": "provider-chosen-id",
      },
      body: raw,
    });
  const accepted = await callback();
  assert.equal(accepted.status, 200);
  const paymentId = accepted.headers.get("x-request-id");
  assert.notEqual(paymentId, submissionId);
  assert.notEqual(paymentId, "provider-chosen-id");
  const paid = await applicationDetail(alice, reference);
  const paymentAudit = paid.history.find((e) => e.action === "payment.settled");
  assert.equal(paymentAudit?.detail.requestId, paymentId);
  assert.equal(paid.invoice.status, "settled");
  assert.equal(paid.application.insurer_status, "queued");
  assert.equal(paid.application.evidence, null);
  const repeated = await callback();
  assert.equal(repeated.status, 200);
  assert.equal((await repeated.json()).duplicate, true);
  assert.deepEqual(
    (await applicationDetail(alice, reference)).history,
    paid.history,
  );
  assert.doesNotMatch(
    JSON.stringify(paid.history),
    /correlation@example|Synthetic Correlation|provider-chosen-id|X-Provider-Signature/,
  );
});

test("audit state records persisted payment and insurer transitions without duplicate or rejected writes", async () => {
  const f = await fixture();
  const failed = { ...eventFor(f), status: "failed" };
  const settled = eventFor(f);
  await processPayment(failed);
  await processPayment(settled);
  const afterSettlement = await applicationDetail(alice, f.reference);
  assert.equal(afterSettlement.invoice.status, "settled");
  assert.equal(afterSettlement.application.insurer_status, "queued");
  assert.equal(afterSettlement.application.evidence, null);
  const unchanged = { ...eventFor(f), status: "failed" };
  await processPayment(unchanged);
  await simulatorInsurer(alice, f.reference, "processing");
  await simulatorInsurer(alice, f.reference, "issued");
  const completed = await applicationDetail(alice, f.reference);
  assert.deepEqual(
    completed.history
      .slice(2)
      .map(({ action, detail }) => [
        action,
        detail.previousState,
        detail.resultingState,
      ]),
    [
      ["payment.failed", "pending", "failed"],
      ["insurer.queued", "awaiting_payment", "queued"],
      ["payment.settled", "failed", "settled"],
      ["payment.already_settled", "settled", "settled"],
      ["insurer.processing", "queued", "processing"],
      ["insurer.issued", "processing", "issued"],
    ],
  );
  assert.equal(
    completed.history.find((e) => e.action === "insurer.queued")?.detail
      .eventId,
    settled.eventId,
  );
  assert.equal(completed.application.evidence.synthetic, true);
  assert.equal(completed.application.evidence.noCoverage, true);
  for (const event of [failed, settled, unchanged])
    assert.equal((await processPayment(event)).duplicate, true);
  assert.equal(
    (await simulatorInsurer(alice, f.reference, "issued")).duplicate,
    true,
  );
  await assert.rejects(simulatorInsurer(alice, f.reference, "rejected"));
  await assert.rejects(
    processPayment({ ...settled, amount: settled.amount + 1 }),
  );
  assert.deepEqual(await applicationDetail(alice, f.reference), completed);

  for (const late of [false, true]) {
    const review = await fixture();
    if (late)
      await transaction(alice, (db) =>
        db.query(
          "UPDATE invoices SET expires_at=now()-interval '1 minute' WHERE id=$1",
          [review.invoice.id],
        ),
      );
    const event = eventFor(review);
    if (!late) event.amount += 1;
    await processPayment(event);
    const result = await applicationDetail(alice, review.reference);
    assert.equal(result.invoice.status, "reconciliation_required");
    assert.equal(result.application.insurer_status, "awaiting_payment");
    assert.deepEqual(result.history.at(-1)?.detail, {
      eventId: event.eventId,
      synthetic: true,
      previousState: "pending",
      resultingState: "reconciliation_required",
    });
    assert.equal(
      result.history.at(-1)?.action,
      late ? "payment.late_payment_review" : "payment.reconciliation_required",
    );
  }
});

test("audit state failures roll back payment, insurer, provider event and outbox writes", async (t) => {
  for (const failedAction of [
    "insurer.queued",
    "payment.settled",
    "insurer.issued",
  ]) {
    const f = await fixture();
    const event = eventFor(f);
    const insurer = failedAction === "insurer.issued";
    if (insurer) await processPayment(event);
    const snapshot = async () => ({
      detail: await applicationDetail(alice, f.reference),
      related: await transaction(alice, async (db) => ({
        events: (
          await db.query(
            "SELECT * FROM provider_events WHERE invoice_id=$1 ORDER BY id",
            [f.invoice.id],
          )
        ).rows,
        outbox: (
          await db.query(
            "SELECT * FROM outbox WHERE application_id=$1 ORDER BY id",
            [f.application.id],
          )
        ).rows,
      })),
    });
    const beforeFailure = await snapshot();
    // Intercept only the failing write; all other queries and rollback use PostgreSQL.
    const fault = t.mock.method(
      pg.Client.prototype,
      "query",
      new Proxy(pg.Client.prototype.query, {
        apply(target, receiver, args) {
          if (
            typeof args[0] === "string" &&
            args[0].startsWith("INSERT INTO audit_events") &&
            args[1]?.[2] === failedAction
          )
            throw new Error("Synthetic audit write failure");
          return Reflect.apply(target, receiver, args);
        },
      }),
    );
    try {
      await assert.rejects(
        insurer
          ? simulatorInsurer(alice, f.reference, "issued")
          : processPayment(event),
        /Synthetic audit write failure/,
      );
    } finally {
      fault.mock.restore();
    }
    assert.deepEqual(await snapshot(), beforeFailure);
    const recovered = insurer
      ? await simulatorInsurer(alice, f.reference, "issued")
      : await processPayment(event);
    assert.equal(recovered.duplicate, false);
    const afterRecovery = await snapshot();
    assert.equal(afterRecovery.detail.invoice.status, "settled");
    assert.equal(
      afterRecovery.detail.application.insurer_status,
      insurer ? "issued" : "queued",
    );
    assert.equal(afterRecovery.related.events.length, 1);
    assert.equal(afterRecovery.related.outbox.length, 1);
    assert.equal(
      afterRecovery.detail.history.filter((e) => e.action === failedAction)
        .length,
      1,
    );
  }
});

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
test("tenant isolation allows own resources and denies reciprocal, unknown and caller-selected tenant contexts", async () => {
  const sameOwnerInB = { ...eve, user: alice.user };
  const a = await fixture(alice);
  const b = await fixture(sameOwnerInB);
  for (const [owner, own, other, otherOwner] of [
    [alice, a, b, sameOwnerInB],
    [sameOwnerInB, b, a, alice],
  ] as const) {
    assert.equal(
      (await applicationDetail(owner, own.reference)).application.reference,
      own.reference,
    );
    await assert.rejects(
      applicationDetail(owner, other.reference),
      /could not be found/,
    );
    await assert.rejects(
      applicationDetail({ ...owner, tenant: `unknown-${run}` }, own.reference),
      /could not be found/,
    );
    const headers = await session(owner);
    const ownResponse = await fetch(
      `${origin}/api/applications/${own.reference}`,
      { headers },
    );
    assert.equal(ownResponse.status, 200);
    assert.equal(
      (await ownResponse.json()).application.reference,
      own.reference,
    );
    const manipulated = await fetch(
      `${origin}/api/applications/${other.reference}?tenant=${otherOwner.tenant}`,
      { headers: { ...headers, "X-Tenant-ID": otherOwner.tenant } },
    );
    assert.equal(manipulated.status, 404);
    assert.equal(
      (await manipulated.json()).error.code,
      "APPLICATION_NOT_FOUND",
    );
  }
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
