import { transaction, type Actor } from "./db.ts";
import { DomainError, hash, paymentEvent } from "./domain.ts";
import { processPayment } from "./services.ts";

/** Called only after ingress has verified the provider signature or local simulator authority. */
export async function acceptVerifiedPayment(body: unknown) {
  const event = paymentEvent.parse(body);
  const actor: Actor = {
    tenant: event.tenant,
    user: event.owner,
    role: "customer",
  };
  // Schema parsing gives stable field order and excludes unclassified payload data.
  const digest = hash(JSON.stringify(event));
  const received = await transaction(actor, async (db) => {
    await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
      `payment-inbox:${event.eventId}`,
    ]);
    const inserted = await db.query(
      "INSERT INTO payment_inbox(id,tenant_id,owner_id,event,digest) VALUES($1,$2,$3,$4,$5) ON CONFLICT(id) DO NOTHING RETURNING id",
      [event.eventId, actor.tenant, actor.user, event, digest],
    );
    const receipt = (
      await db.query(
        "SELECT digest,status,outcome FROM payment_inbox WHERE id=$1",
        [event.eventId],
      )
    ).rows[0];
    if (!receipt || receipt.digest !== digest)
      throw new DomainError(
        409,
        "EVENT_CONFLICT",
        "This provider event ID was used for a different payload.",
      );
    if (receipt.status === "processed")
      return { processed: true as const, outcome: receipt.outcome as string };
    if (!inserted.rowCount)
      await db.query(
        "UPDATE payment_inbox SET attempts=attempts+1,last_received_at=now() WHERE id=$1",
        [event.eventId],
      );
    return { processed: false as const };
  });
  if (received.processed) return { outcome: received.outcome, duplicate: true };

  try {
    const result = await processPayment(event);
    await transaction(actor, (db) =>
      db.query(
        "UPDATE payment_inbox SET status='processed',outcome=$2,failure_code=NULL,processed_at=now() WHERE id=$1",
        [event.eventId, result.outcome],
      ),
    );
    return result;
  } catch (error) {
    const failureCode =
      error instanceof DomainError &&
      ["INVOICE_NOT_FOUND", "EVENT_CONFLICT"].includes(error.code)
        ? error.code
        : "PAYMENT_PROCESSING_FAILED";
    // A crash before this update leaves a durable received row; redelivery can retry it.
    // A competing successful delivery must never be downgraded by a failure.
    await transaction(actor, (db) =>
      db.query(
        "UPDATE payment_inbox SET status='failed',failure_code=$2 WHERE id=$1 AND status<>'processed'",
        [event.eventId, failureCode],
      ),
    ).catch(() => undefined);
    throw new DomainError(
      503,
      "PAYMENT_PROCESSING_PENDING",
      "The verified payment event has been recorded. Retry the same event to complete processing.",
    );
  }
}
