import { randomUUID, randomBytes } from "node:crypto";
import type pg from "pg";
import { transaction, audit, type Actor } from "./db.ts";
import { products } from "./catalog.ts";
import {
  DomainError,
  quoteInput,
  applicationInput,
  calculateQuote,
  hash,
  paymentEvent,
  assertInsurerTransition,
} from "./domain.ts";

export async function createQuote(actor: Actor, body: unknown) {
  const calculation = calculateQuote(quoteInput.parse(body));
  const id = randomUUID();
  await transaction(actor, async (db) => {
    await db.query(
      "INSERT INTO quotes(id,tenant_id,owner_id,product_id,product_version,rule_version,input,premium,fee,total,currency,expires_at,product_snapshot) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)",
      [
        id,
        actor.tenant,
        actor.user,
        calculation.product.id,
        calculation.product.version,
        calculation.ruleVersion,
        calculation.input,
        calculation.premium,
        calculation.fee,
        calculation.total,
        calculation.currency,
        calculation.expiresAt,
        calculation.product,
      ],
    );
    await audit(db, actor, "quote.created", id, {
      ruleVersion: calculation.ruleVersion,
      synthetic: true,
    });
  });
  return { id, ...calculation };
}
export async function createApplication(
  actor: Actor,
  body: unknown,
  key: string,
) {
  if (!/^[a-zA-Z0-9-]{16,80}$/.test(key))
    throw new DomainError(
      400,
      "IDEMPOTENCY_REQUIRED",
      "A valid submission key is required.",
    );
  const input = applicationInput.parse(body);
  const requestHash = hash(JSON.stringify(input));
  return transaction(actor, async (db) => {
    await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
      `${actor.tenant}:${actor.user}:${key}`,
    ]);
    const previous = await db.query(
      "SELECT reference,request_hash FROM applications WHERE idempotency_key=$1 AND owner_id=$2",
      [key, actor.user],
    );
    if (previous.rows[0]) {
      if (previous.rows[0].request_hash !== requestHash)
        throw new DomainError(
          409,
          "IDEMPOTENCY_CONFLICT",
          "This submission key was already used for different information.",
        );
      return { reference: previous.rows[0].reference, duplicate: true };
    }
    const result = await db.query(
      "SELECT * FROM quotes WHERE id=$1 AND owner_id=$2",
      [input.quoteId, actor.user],
    );
    const quote = result.rows[0];
    if (!quote)
      throw new DomainError(
        404,
        "QUOTE_NOT_FOUND",
        "The quote could not be found.",
      );
    if (new Date(quote.expires_at).getTime() < Date.now())
      throw new DomainError(
        409,
        "QUOTE_EXPIRED",
        "Your quote has expired. Please calculate a new quote.",
      );
    const product = products.find(
      (p) =>
        p.id === quote.product_id &&
        p.published &&
        p.version === quote.product_version &&
        p.ruleVersion === quote.rule_version &&
        p.effectiveFrom <= new Date().toISOString().slice(0, 10) &&
        p.effectiveTo >= new Date().toISOString().slice(0, 10),
    );
    if (!product)
      throw new DomainError(
        409,
        "PRODUCT_UNAVAILABLE",
        "This plan is no longer available for new applications.",
      );
    if (!quote.product_snapshot)
      throw new DomainError(
        409,
        "QUOTE_SNAPSHOT_REQUIRED",
        "Please calculate a new quote to confirm this plan's terms.",
      );
    const used = await db.query(
      "SELECT reference FROM applications WHERE quote_id=$1",
      [quote.id],
    );
    if (used.rowCount)
      throw new DomainError(
        409,
        "QUOTE_ALREADY_SUBMITTED",
        "This quote already has an application. Find it in My applications.",
      );
    const id = randomUUID();
    const reference = `BT-${new Date().getUTCFullYear()}-${randomBytes(5).toString("hex").toUpperCase()}`;
    const invoiceId = randomUUID();
    await db.query(
      "INSERT INTO applications(id,reference,tenant_id,owner_id,quote_id,product_id,product_snapshot,customer,consent,idempotency_key,request_hash) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)",
      [
        id,
        reference,
        actor.tenant,
        actor.user,
        quote.id,
        product.id,
        quote.product_snapshot,
        { fullName: input.fullName, email: input.email },
        {
          wordingVersion: "demo-disclosure-1",
          acceptedAt: new Date().toISOString(),
          privacy: true,
          nonBinding: true,
        },
        key,
        requestHash,
      ],
    );
    await db.query(
      "INSERT INTO invoices(id,tenant_id,owner_id,application_id,provider_reference,amount,currency,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7,now()+interval '30 minutes')",
      [
        invoiceId,
        actor.tenant,
        actor.user,
        id,
        `SIM-${invoiceId}`,
        quote.total,
        quote.currency,
      ],
    );
    await audit(db, actor, "application.submitted", id, {
      reference,
      productVersion: product.version,
    });
    await audit(db, actor, "invoice.created", invoiceId, {
      amount: Number(quote.total),
      currency: quote.currency,
    });
    return { reference, duplicate: false };
  });
}
export async function listApplications(actor: Actor) {
  return transaction(
    actor,
    async (db) =>
      (
        await db.query(
          "SELECT a.reference,a.product_snapshot,a.insurer_status,a.status,a.created_at,i.amount,i.currency,i.status AS payment_status,i.expires_at FROM applications a JOIN invoices i ON i.application_id=a.id ORDER BY a.created_at DESC LIMIT 100",
        )
      ).rows,
  );
}
export async function applicationDetail(actor: Actor, reference: string) {
  return transaction(actor, async (db) => {
    const { rows } = await db.query(
      "SELECT * FROM applications WHERE reference=$1",
      [reference],
    );
    const application = rows[0];
    if (!application)
      throw new DomainError(
        404,
        "APPLICATION_NOT_FOUND",
        "This application could not be found in your account.",
      );
    const invoice = (
      await db.query("SELECT * FROM invoices WHERE application_id=$1", [
        application.id,
      ])
    ).rows[0];
    const quote = (
      await db.query(
        "SELECT premium,fee,total,currency,input,rule_version,expires_at FROM quotes WHERE id=$1",
        [application.quote_id],
      )
    ).rows[0];
    const history = (
      await db.query(
        "SELECT action,detail,created_at FROM audit_events WHERE resource_id=ANY($1::text[]) ORDER BY id",
        [[application.id, invoice.id]],
      )
    ).rows;
    return {
      application,
      invoice: {
        ...invoice,
        status:
          invoice.status === "pending" &&
          new Date(invoice.expires_at).getTime() < Date.now()
            ? "expired"
            : invoice.status,
      },
      quote,
      history,
    };
  });
}
export async function processPayment(body: unknown) {
  const event = paymentEvent.parse(body);
  const actor: Actor = {
    tenant: event.tenant,
    user: event.owner,
    role: "customer",
  };
  const bodyHash = hash(JSON.stringify(event));
  return transaction(actor, async (db) => {
    const { rows } = await db.query(
      "SELECT * FROM invoices WHERE id=$1 FOR UPDATE",
      [event.invoiceId],
    );
    const invoice = rows[0];
    if (!invoice)
      throw new DomainError(
        404,
        "INVOICE_NOT_FOUND",
        "The payment instruction could not be found.",
      );
    const previous = (
      await db.query(
        "SELECT body_hash,outcome FROM provider_events WHERE id=$1",
        [event.eventId],
      )
    ).rows[0];
    if (previous) {
      if (previous.body_hash !== bodyHash)
        throw new DomainError(
          409,
          "EVENT_CONFLICT",
          "This provider event ID was used for a different payload.",
        );
      return { outcome: previous.outcome, duplicate: true };
    }
    let outcome = event.status === "failed" ? "failed" : "settled";
    if (invoice.status === "settled") outcome = "already_settled";
    else if (invoice.status === "reconciliation_required")
      outcome = "reconciliation_required";
    else if (
      Number(invoice.amount) !== event.amount ||
      invoice.currency !== event.currency ||
      invoice.provider_reference !== event.providerReference
    )
      outcome = "reconciliation_required";
    else if (new Date(invoice.expires_at).getTime() < Date.now())
      outcome = "late_payment_review";
    await db.query(
      "INSERT INTO provider_events(id,tenant_id,owner_id,invoice_id,body_hash,outcome) VALUES($1,$2,$3,$4,$5,$6)",
      [event.eventId, actor.tenant, actor.user, invoice.id, bodyHash, outcome],
    );
    let resultingState = invoice.status;
    if (outcome !== "already_settled") {
      resultingState =
        outcome === "settled"
          ? "settled"
          : outcome === "failed"
            ? "failed"
            : "reconciliation_required";
      await db.query(
        "UPDATE invoices SET status=$1,settled_at=CASE WHEN $1='settled' THEN now() ELSE NULL END WHERE id=$2",
        [resultingState, invoice.id],
      );
      if (resultingState === "settled") {
        const queued = await db.query(
          "UPDATE applications SET insurer_status='queued',updated_at=now() WHERE id=$1 AND insurer_status='awaiting_payment'",
          [invoice.application_id],
        );
        if (queued.rowCount)
          await audit(db, actor, "insurer.queued", invoice.application_id, {
            previousState: "awaiting_payment",
            resultingState: "queued",
            eventId: event.eventId,
            synthetic: true,
          });
        await db.query(
          "INSERT INTO outbox(id,tenant_id,owner_id,application_id,kind) VALUES($1,$2,$3,$4,'insurer.submit') ON CONFLICT(application_id) DO NOTHING",
          [randomUUID(), actor.tenant, actor.user, invoice.application_id],
        );
      }
    }
    await audit(db, actor, `payment.${outcome}`, invoice.id, {
      eventId: event.eventId,
      synthetic: true,
      previousState: invoice.status,
      resultingState,
    });
    return { outcome, duplicate: false };
  });
}
export async function simulatorInsurer(
  actor: Actor,
  reference: string,
  outcome: string,
) {
  return transaction(actor, async (db) => {
    const app = (
      await db.query(
        "SELECT * FROM applications WHERE reference=$1 FOR UPDATE",
        [reference],
      )
    ).rows[0];
    if (!app)
      throw new DomainError(
        404,
        "APPLICATION_NOT_FOUND",
        "This application could not be found.",
      );
    if (app.insurer_status === outcome) return { outcome, duplicate: true };
    assertInsurerTransition(app.insurer_status, outcome);
    const invoice = (
      await db.query("SELECT status FROM invoices WHERE application_id=$1", [
        app.id,
      ])
    ).rows[0];
    if (invoice.status !== "settled")
      throw new DomainError(
        409,
        "PAYMENT_REQUIRED",
        "A verified simulator payment is required first.",
      );
    const evidence =
      outcome === "issued"
        ? {
            synthetic: true,
            source: "local-insurer-simulator",
            reference: `DEMO-POL-${app.reference}`,
            receivedAt: new Date().toISOString(),
            noCoverage: true,
          }
        : null;
    await db.query(
      "UPDATE applications SET insurer_status=$1,insurer_reference=$2,evidence=$3,updated_at=now() WHERE id=$4",
      [outcome, `DEMO-INS-${app.reference}`, evidence, app.id],
    );
    await db.query(
      "UPDATE outbox SET status=$1,attempts=attempts+1,updated_at=now() WHERE application_id=$2",
      [outcome === "timeout" ? "retry_required" : "delivered", app.id],
    );
    await audit(db, actor, `insurer.${outcome}`, app.id, {
      source: "local-insurer-simulator",
      synthetic: true,
      previousState: app.insurer_status,
      resultingState: outcome,
    });
    return { outcome, duplicate: false };
  });
}
export async function reconcile(db: pg.PoolClient) {
  return (
    await db.query(
      "SELECT a.reference,i.status,i.amount,i.currency,i.expires_at FROM invoices i JOIN applications a ON a.id=i.application_id WHERE i.status IN ('reconciliation_required','failed') OR (i.status='pending' AND i.expires_at<now()) ORDER BY i.created_at DESC",
    )
  ).rows;
}
