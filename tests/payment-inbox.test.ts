import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  pool,
  transaction,
  assertRuntimeRole,
  type Actor,
} from "../server/db.ts";
import { config } from "../server/config.ts";
import { DomainError, hash, paymentEvent } from "../server/domain.ts";
import { acceptVerifiedPayment } from "../server/payment-inbox.ts";
import {
  createQuote,
  createApplication,
  applicationDetail,
  processPayment,
} from "../server/services.ts";

const run = randomUUID();
const alice: Actor = {
  tenant: `inbox-a-${run}`,
  user: `alice-${run}`,
  role: "customer",
};
const bob: Actor = { ...alice, user: `bob-${run}` };
const eve: Actor = {
  tenant: `inbox-b-${run}`,
  user: `eve-${run}`,
  role: "customer",
};
before(async () => {
  assert.equal(config.demo, true, "Inbox tests require demonstration mode");
  await assertRuntimeRole();
});
after(() => pool.end());

async function fixture() {
  const quote = await createQuote(alice, {
    productId: "travel-essential",
    age: 30,
    days: 7,
  });
  const application = await createApplication(
    alice,
    {
      quoteId: quote.id,
      fullName: "Synthetic Inbox Tester",
      email: "inbox@example.test",
      consent: true,
      disclosure: true,
    },
    randomUUID(),
  );
  const detail = await applicationDetail(alice, application.reference);
  return {
    reference: application.reference,
    event: {
      eventId: `inbox-${randomUUID()}`,
      tenant: alice.tenant,
      owner: alice.user,
      invoiceId: detail.invoice.id as string,
      providerReference: detail.invoice.provider_reference as string,
      amount: Number(detail.invoice.amount),
      currency: "LAK" as const,
      status: "settled" as const,
    },
  };
}
async function receipt(id: string, actor = alice) {
  return transaction(
    actor,
    async (db) =>
      (await db.query("SELECT * FROM payment_inbox WHERE id=$1", [id])).rows[0],
  );
}
async function seedReceived(
  event: Awaited<ReturnType<typeof fixture>>["event"],
) {
  const normalized = paymentEvent.parse(event);
  await transaction(alice, (db) =>
    db.query(
      "INSERT INTO payment_inbox(id,tenant_id,owner_id,event,digest) VALUES($1,$2,$3,$4,$5)",
      [
        event.eventId,
        alice.tenant,
        alice.user,
        normalized,
        hash(JSON.stringify(normalized)),
      ],
    ),
  );
}
function hasCode(code: string) {
  return (error: unknown) =>
    error instanceof DomainError && error.code === code;
}

test("durable inbox settles concurrent duplicates once and normalizes property order", async () => {
  const f = await fixture();
  const results = await Promise.all(
    Array.from({ length: 5 }, () => acceptVerifiedPayment(f.event)),
  );
  assert.equal(results.filter((r) => !r.duplicate).length, 1);
  assert.ok(results.every((r) => r.outcome === "settled"));
  const reversed = Object.fromEntries(Object.entries(f.event).reverse());
  assert.deepEqual(await acceptVerifiedPayment(reversed), {
    outcome: "settled",
    duplicate: true,
  });
  const row = await receipt(f.event.eventId);
  assert.equal(row.status, "processed");
  assert.equal(row.outcome, "settled");
  assert.equal(row.failure_code, null);
  assert.deepEqual(row.event, f.event);
  await transaction(alice, async (db) => {
    assert.equal(
      (
        await db.query("SELECT id FROM provider_events WHERE id=$1", [
          f.event.eventId,
        ])
      ).rowCount,
      1,
    );
    const detail = await applicationDetail(alice, f.reference);
    assert.equal(
      (
        await db.query("SELECT id FROM outbox WHERE application_id=$1", [
          detail.application.id,
        ])
      ).rowCount,
      1,
    );
    assert.equal(
      (
        await db.query(
          "SELECT id FROM audit_events WHERE action='payment.settled' AND resource_id=$1",
          [f.event.invoiceId],
        )
      ).rowCount,
      1,
    );
  });
});

test("concurrent changed event content conflicts without replacing its durable receipt", async () => {
  const f = await fixture();
  const results = await Promise.allSettled([
    acceptVerifiedPayment(f.event),
    acceptVerifiedPayment({ ...f.event, amount: f.event.amount + 1 }),
  ]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  const rejected = results.find((r) => r.status === "rejected");
  assert.ok(
    rejected?.status === "rejected" &&
      hasCode("EVENT_CONFLICT")(rejected.reason),
  );
  const row = await receipt(f.event.eventId);
  const changed = {
    ...row.event,
    providerReference: "changed-provider-reference",
  };
  await assert.rejects(
    acceptVerifiedPayment(changed),
    hasCode("EVENT_CONFLICT"),
  );
  assert.deepEqual((await receipt(f.event.eventId)).event, row.event);
});

test("processing failure retains receipt and a safe code; same verified event can recover", async () => {
  const f = await fixture();
  const originalInvoiceId = f.event.invoiceId;
  f.event.invoiceId = randomUUID();
  await assert.rejects(
    acceptVerifiedPayment(f.event),
    hasCode("PAYMENT_PROCESSING_PENDING"),
  );
  let row = await receipt(f.event.eventId);
  assert.equal(row.status, "failed");
  assert.equal(row.failure_code, "INVOICE_NOT_FOUND");
  assert.equal(row.attempts, 1);
  assert.equal(row.outcome, null);
  await assert.rejects(
    acceptVerifiedPayment(f.event),
    hasCode("PAYMENT_PROCESSING_PENDING"),
  );
  assert.equal((await receipt(f.event.eventId)).attempts, 2);
  // Repair only this synthetic fixture, as if the referenced invoice became available.
  await transaction(alice, (db) =>
    db.query("UPDATE invoices SET id=$1 WHERE id=$2", [
      f.event.invoiceId,
      originalInvoiceId,
    ]),
  );
  assert.deepEqual(await acceptVerifiedPayment(f.event), {
    outcome: "settled",
    duplicate: false,
  });
  row = await receipt(f.event.eventId);
  assert.equal(row.status, "processed");
  assert.equal(row.failure_code, null);
  assert.equal(row.attempts, 3);
});

test("redelivery recovers receipt-only and domain-committed crash windows", async () => {
  for (const committed of [false, true]) {
    const f = await fixture();
    await seedReceived(f.event);
    if (committed) await processPayment(f.event);
    const result = await acceptVerifiedPayment(f.event);
    assert.equal(result.outcome, "settled");
    assert.equal(result.duplicate, committed);
    assert.equal((await receipt(f.event.eventId)).status, "processed");
    assert.equal(
      (await applicationDetail(alice, f.reference)).invoice.status,
      "settled",
    );
  }
});

test("inbox requires tenant/owner context, prevents receipt mutation, and masks cross-tenant event conflicts", async () => {
  const f = await fixture();
  await acceptVerifiedPayment(f.event);
  const security = (
    await pool.query(
      "SELECT relrowsecurity,relforcerowsecurity FROM pg_class WHERE relname='payment_inbox'",
    )
  ).rows[0];
  assert.equal(security.relrowsecurity, true);
  assert.equal(security.relforcerowsecurity, true);
  assert.equal(
    (
      await pool.query("SELECT id FROM payment_inbox WHERE id=$1", [
        f.event.eventId,
      ])
    ).rowCount,
    0,
  );
  for (const actor of [bob, eve, { ...eve, role: "operations" as const }]) {
    assert.equal(await receipt(f.event.eventId, actor), undefined);
    await assert.rejects(
      acceptVerifiedPayment({
        ...f.event,
        tenant: actor.tenant,
        owner: actor.user,
      }),
      hasCode("EVENT_CONFLICT"),
    );
  }
  assert.equal(
    (
      await receipt(f.event.eventId, {
        ...alice,
        user: "staff",
        role: "operations",
      })
    ).status,
    "processed",
  );
  await assert.rejects(
    transaction(alice, (db) =>
      db.query("UPDATE payment_inbox SET event='{}' WHERE id=$1", [
        f.event.eventId,
      ]),
    ),
    /permission denied/,
  );
  await assert.rejects(
    transaction(alice, (db) =>
      db.query("DELETE FROM payment_inbox WHERE id=$1", [f.event.eventId]),
    ),
    /permission denied/,
  );
  const otherTenantEvent = {
    ...f.event,
    eventId: `inbox-${randomUUID()}`,
    tenant: eve.tenant,
    owner: eve.user,
  };
  await assert.rejects(
    acceptVerifiedPayment(otherTenantEvent),
    hasCode("PAYMENT_PROCESSING_PENDING"),
  );
  assert.equal(
    (await receipt(otherTenantEvent.eventId, eve)).failure_code,
    "INVOICE_NOT_FOUND",
  );
  assert.equal(
    (await applicationDetail(alice, f.reference)).invoice.status,
    "settled",
  );
});

test("invalid payloads never enter the durable inbox", async () => {
  const f = await fixture();
  await assert.rejects(
    acceptVerifiedPayment({ ...f.event, rawCustomerData: "unclassified" }),
  );
  assert.equal(await receipt(f.event.eventId), undefined);
});
