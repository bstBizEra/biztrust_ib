import type pg from "pg";
import { z } from "zod";
import { transaction, type Actor } from "./db.ts";
import { DomainError } from "./domain.ts";

export const caseFilter = z
  .object({
    status: z
      .enum([
        "awaiting_payment",
        "queued",
        "processing",
        "referred",
        "additional_information",
        "rejected",
        "issued",
        "timeout",
      ])
      .optional(),
    payment: z
      .enum([
        "pending",
        "failed",
        "settled",
        "reconciliation_required",
        "expired",
      ])
      .optional(),
    reference: z
      .string()
      .regex(/^BT-[0-9]{4}-[A-F0-9]{10}$/)
      .optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  })
  .strict();

function paymentState(row: { payment_status: string; expires_at: Date }) {
  return row.payment_status === "pending" &&
    new Date(row.expires_at).getTime() < Date.now()
    ? "expired"
    : row.payment_status;
}

function requireOperations(actor: Actor) {
  if (actor.role !== "operations")
    throw new DomainError(
      403,
      "OPERATIONS_REQUIRED",
      "This operation requires staff access.",
    );
}

export async function overview(actor: Actor) {
  requireOperations(actor);
  return transaction(actor, async (db) => {
    const counts = (
      await db.query(`SELECT
      count(*) FILTER (WHERE a.insurer_status IN ('queued','referred','additional_information','timeout'))::int AS awaiting_action,
      count(*) FILTER (WHERE i.status='pending' AND i.expires_at>=now())::int AS payment_pending,
      count(*) FILTER (WHERE i.status='pending' AND i.expires_at<now())::int AS payment_expired,
      count(*) FILTER (WHERE i.status IN ('failed','reconciliation_required'))::int AS payment_exceptions,
      count(*) FILTER (WHERE a.insurer_status='timeout')::int AS insurer_timeouts
      FROM applications a JOIN invoices i ON i.application_id=a.id`)
    ).rows[0];
    const events =
      await db.query(`SELECT count(*)::int AS count FROM provider_events
      WHERE outcome IN ('reconciliation_required','late_payment_review')`);
    const outbox = await db.query(
      `SELECT status,count(*)::int AS count FROM outbox GROUP BY status`,
    );
    const summary = {
      awaitingAction: counts.awaiting_action as number,
      paymentPending: counts.payment_pending as number,
      paymentExpired: counts.payment_expired as number,
      paymentExceptions: counts.payment_exceptions as number,
      insurerTimeouts: counts.insurer_timeouts as number,
    };
    return {
      tenant: actor.tenant,
      asOf: new Date().toISOString(),
      summary,
      integration: {
        payment: "simulator_only",
        insurer: "simulator_only",
        verifiedExceptionEvents: events.rows[0].count,
        outbox: Object.fromEntries(
          outbox.rows.map((row) => [row.status, row.count]),
        ),
      },
      synthetic: true,
    };
  });
}

export async function cases(actor: Actor, input: unknown) {
  requireOperations(actor);
  const filter = caseFilter.parse(input);
  return transaction(actor, async (db) => {
    const rows = await db.query(
      `SELECT a.id,a.reference,a.product_id,
      a.product_snapshot->>'version' AS product_version,a.insurer_status,a.created_at,a.updated_at,
      i.status AS payment_status,i.amount,i.currency,i.expires_at
      FROM applications a JOIN invoices i ON i.application_id=a.id
      WHERE ($1::text IS NULL OR a.insurer_status=$1)
        AND ($2::text IS NULL OR a.reference=$2)
        AND ($3::text IS NULL OR
          CASE WHEN i.status='pending' AND i.expires_at<now() THEN 'expired' ELSE i.status END=$3)
      ORDER BY a.created_at DESC LIMIT $4`,
      [
        filter.status ?? null,
        filter.reference ?? null,
        filter.payment ?? null,
        filter.limit,
      ],
    );
    return rows.rows.map((row) => ({
      caseId: row.id,
      reference: row.reference,
      productId: row.product_id,
      productVersion: row.product_version,
      insurerStatus: row.insurer_status,
      paymentStatus: paymentState(row),
      amountMinor: Number(row.amount),
      currency: row.currency,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  });
}

export async function caseEvidence(actor: Actor, id: string) {
  requireOperations(actor);
  const caseId = z.uuid().parse(id);
  return transaction(actor, async (db) => {
    const found = await db.query(
      `SELECT a.id,a.reference,a.product_id,
      a.product_snapshot->>'version' AS product_version,a.insurer_status,a.insurer_reference,
      a.created_at,a.updated_at,i.id AS invoice_id,i.status AS payment_status,
      i.amount,i.currency,i.expires_at
      FROM applications a JOIN invoices i ON i.application_id=a.id WHERE a.id=$1`,
      [caseId],
    );
    const row = found.rows[0];
    if (!row)
      throw new DomainError(
        404,
        "CASE_NOT_FOUND",
        "This case could not be found.",
      );
    const timeline = await db.query(
      `SELECT action,created_at FROM audit_events
      WHERE resource_id=ANY($1::text[]) ORDER BY id`,
      [[row.id, row.invoice_id]],
    );
    const events = await db.query(
      `SELECT id,outcome,created_at FROM provider_events
      WHERE invoice_id=$1 ORDER BY created_at`,
      [row.invoice_id],
    );
    const work = await db.query(
      `SELECT id,kind,status,attempts,created_at,updated_at
      FROM outbox WHERE application_id=$1`,
      [row.id],
    );
    return {
      tenant: actor.tenant,
      caseId: row.id,
      reference: row.reference,
      productId: row.product_id,
      productVersion: row.product_version,
      insurerStatus: row.insurer_status,
      insurerReference: row.insurer_reference,
      payment: {
        status: paymentState(row),
        amountMinor: Number(row.amount),
        currency: row.currency,
        expiresAt: row.expires_at,
      },
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      timeline: [
        ...timeline.rows.map((event) => ({
          source: "biztrust",
          action: event.action,
          at: event.created_at,
        })),
        ...events.rows.map((event) => ({
          source: "verified_payment_simulator",
          action: `payment.${event.outcome}`,
          at: event.created_at,
          eventId: event.id,
        })),
      ].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime()),
      outbox: work.rows,
      allowedActions: [],
      synthetic: true,
    };
  });
}

export async function integrationStatus(actor: Actor) {
  requireOperations(actor);
  return transaction(actor, async (db: pg.PoolClient) => {
    const failures = await db.query(`SELECT status,count(*)::int AS count,
      min(created_at) AS oldest FROM outbox WHERE status='retry_required' GROUP BY status`);
    const inbox = (
      await db.query(`SELECT
      count(*) FILTER (WHERE status='received')::int AS received,
      count(*) FILTER (WHERE status='failed')::int AS failed,
      count(*) FILTER (WHERE status='processed')::int AS processed,
      min(received_at) FILTER (WHERE status<>'processed') AS oldest_pending_at
      FROM payment_inbox`)
    ).rows[0];
    return {
      asOf: new Date().toISOString(),
      adapters: [
        {
          name: "payment-simulator",
          environment: "local",
          status: "simulator_only",
          credentialStatus: "local_only",
        },
        {
          name: "insurer-simulator",
          environment: "local",
          status: "simulator_only",
          credentialStatus: "not_applicable",
        },
      ],
      retryRequired: failures.rows[0]?.count ?? 0,
      oldestRetryAt: failures.rows[0]?.oldest ?? null,
      paymentInbox: {
        received: inbox.received,
        failed: inbox.failed,
        processed: inbox.processed,
        oldestPendingAt: inbox.oldest_pending_at,
      },
      synthetic: true,
    };
  });
}
