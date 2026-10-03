import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";
import pg from "pg";
import { products } from "../server/catalog.ts";
import {
  createQuote,
  createApplication,
  applicationDetail,
} from "../server/services.ts";
import { pool, transaction, assertRuntimeRole } from "../server/db.ts";
import { config } from "../server/config.ts";
import { DomainError } from "../server/domain.ts";

const actor = {
  tenant: `snapshot-${randomUUID()}`,
  user: "snapshot-tester",
  role: "customer" as const,
};
const input = {
  productId: "health-essential",
  age: 30,
  days: 7,
  coverageAmount: 225000000,
  addons: ["health-extra-1"],
};
const application = (quoteId: string) => ({
  quoteId,
  fullName: "Synthetic Snapshot",
  email: "snapshot@example.test",
  consent: true,
  disclosure: true,
});
before(async () => {
  assert.equal(config.demo, true);
  await assertRuntimeRole();
});
after(() => pool.end());

for (const mixedCase of [false, true]) {
  test(`different submission keys serialize one quote (${mixedCase ? "mixed UUID case" : "same UUID case"}) without duplicate evidence`, async () => {
    const quote = await createQuote(actor, input);
    const bodies = [
      application(quote.id),
      application(mixedCase ? quote.id.toUpperCase() : quote.id),
    ];
    const keys = [randomUUID(), randomUUID()];
    const blocker = new pg.Client({
      connectionString: process.env.DATABASE_ADMIN_URL,
    });
    await blocker.connect();
    let submissions:
      | Promise<
          PromiseSettledResult<Awaited<ReturnType<typeof createApplication>>>[]
        >
      | undefined;
    try {
      await blocker.query("BEGIN");
      // Hold only this synthetic quote's FK target, forcing both calls to overlap.
      await blocker.query("SELECT id FROM quotes WHERE id=$1 FOR UPDATE", [
        quote.id,
      ]);
      const blockerPid = (await blocker.query("SELECT pg_backend_pid() AS pid"))
        .rows[0].pid;
      submissions = Promise.allSettled(
        keys.map((key, index) => createApplication(actor, bodies[index], key)),
      );
      const deadline = Date.now() + 5000;
      let waiting = 0;
      while (Date.now() < deadline) {
        await blocker.query("SELECT pg_stat_clear_snapshot()");
        waiting = Number(
          (
            await blocker.query(
              `WITH RECURSIVE blocked(pid) AS (
        SELECT pid FROM pg_stat_activity WHERE $1=ANY(pg_blocking_pids(pid))
        UNION
        SELECT a.pid FROM pg_stat_activity a JOIN blocked b ON b.pid=ANY(pg_blocking_pids(a.pid))
      ) SELECT count(*) FROM blocked`,
              [blockerPid],
            )
          ).rows[0].count,
        );
        if (waiting === 2) break;
        await delay(10);
      }
      assert.equal(
        waiting,
        2,
        "Both submissions reached the forced database contention point",
      );
      await blocker.query("ROLLBACK");
      const results = await submissions;
      const winner = results.findIndex(
        (result) => result.status === "fulfilled",
      );
      assert.notEqual(winner, -1);
      const success = results[winner];
      assert.equal(success.status, "fulfilled");
      const loser = results[1 - winner];
      assert.equal(loser.status, "rejected");
      assert.ok(
        loser.reason instanceof DomainError,
        "Competing submission must be a domain error",
      );
      assert.equal(loser.reason.status, 409);
      assert.equal(loser.reason.code, "QUOTE_ALREADY_SUBMITTED");
      assert.equal(success.value.duplicate, false);
      assert.deepEqual(
        await createApplication(actor, bodies[winner], keys[winner]),
        {
          reference: success.value.reference,
          duplicate: true,
        },
      );
      await assert.rejects(
        createApplication(actor, bodies[1 - winner], keys[1 - winner]),
        (error: unknown) =>
          error instanceof DomainError &&
          error.code === "QUOTE_ALREADY_SUBMITTED",
      );
      await transaction(actor, async (db) => {
        const applications = await db.query(
          "SELECT id FROM applications WHERE quote_id=$1",
          [quote.id],
        );
        assert.equal(applications.rowCount, 1);
        const invoices = await db.query(
          "SELECT id FROM invoices WHERE application_id=$1",
          [applications.rows[0].id],
        );
        assert.equal(invoices.rowCount, 1);
        const audits = await db.query(
          "SELECT action FROM audit_events WHERE resource_id=ANY($1::text[]) ORDER BY action",
          [[applications.rows[0].id, invoices.rows[0].id]],
        );
        assert.deepEqual(audits.rows, [
          { action: "application.submitted" },
          { action: "invoice.created" },
        ]);
      });
    } finally {
      await blocker.query("ROLLBACK");
      if (submissions) await submissions;
      await blocker.end();
    }
  });
}

test("quote snapshot survives same-version catalogue changes without re-rating or changing terms", async () => {
  const product = products.find((p) => p.id === input.productId)!;
  const original = structuredClone(product);
  const quote = await createQuote(actor, input);
  const expected = structuredClone(quote.product);
  try {
    product.coverage = ["Different coverage"];
    product.exclusion = "Different exclusion";
    product.basePremium *= 2;
    product.flex.addons[0].name = "Different benefit";
    const key = randomUUID();
    const submitted = await createApplication(
      actor,
      application(quote.id),
      key,
    );
    const detail = await applicationDetail(actor, submitted.reference);
    assert.deepEqual(detail.application.product_snapshot, expected);
    assert.equal(Number(detail.invoice.amount), quote.total);
    assert.equal(Number(detail.quote.total), quote.total);
    product.published = false;
    assert.deepEqual(
      await createApplication(actor, application(quote.id), key),
      { reference: submitted.reference, duplicate: true },
    );
    assert.deepEqual(
      (await applicationDetail(actor, submitted.reference)).application
        .product_snapshot,
      expected,
    );
    await transaction(actor, async (db) => {
      const saved = (
        await db.query("SELECT product_snapshot FROM quotes WHERE id=$1", [
          quote.id,
        ])
      ).rows[0];
      assert.deepEqual(saved.product_snapshot, expected);
    });
    await assert.rejects(
      transaction(actor, (db) =>
        db.query("UPDATE quotes SET product_snapshot='{}' WHERE id=$1", [
          quote.id,
        ]),
      ),
      /permission denied/,
    );
    const other = { ...actor, tenant: `other-${randomUUID()}` };
    assert.equal(
      (
        await transaction(other, (db) =>
          db.query("SELECT product_snapshot FROM quotes WHERE id=$1", [
            quote.id,
          ]),
        )
      ).rowCount,
      0,
    );
  } finally {
    Object.assign(product, original);
  }
});

test("quote snapshot missing on a legacy quote fails closed without creating application evidence", async () => {
  const quote = await createQuote(actor, input);
  const legacyId = randomUUID();
  await transaction(actor, (db) =>
    db.query(
      "INSERT INTO quotes(id,tenant_id,owner_id,product_id,product_version,rule_version,input,premium,fee,total,currency,expires_at) SELECT $1,tenant_id,owner_id,product_id,product_version,rule_version,input,premium,fee,total,currency,expires_at FROM quotes WHERE id=$2",
      [legacyId, quote.id],
    ),
  );
  await assert.rejects(
    createApplication(actor, application(legacyId), randomUUID()),
    (e: unknown) =>
      e instanceof DomainError &&
      e.status === 409 &&
      e.code === "QUOTE_SNAPSHOT_REQUIRED",
  );
  await transaction(actor, async (db) => {
    assert.equal(
      (
        await db.query("SELECT id FROM applications WHERE quote_id=$1", [
          legacyId,
        ])
      ).rowCount,
      0,
    );
    assert.equal(
      (
        await db.query("SELECT id FROM audit_events WHERE resource_id=$1", [
          legacyId,
        ])
      ).rowCount,
      0,
    );
  });
});

test("quote snapshot rejects mismatched or missing identity fields in non-null persisted snapshots", async () => {
  const quote = await createQuote(actor, input);
  for (const snapshot of [
    {},
    [],
    { ...quote.product, id: "different" },
    { ...quote.product, version: "different" },
    { ...quote.product, ruleVersion: "different" },
  ]) {
    await assert.rejects(
      transaction(actor, (db) =>
        db.query(
          "INSERT INTO quotes(id,tenant_id,owner_id,product_id,product_version,rule_version,input,premium,fee,total,currency,expires_at,product_snapshot) SELECT $1,tenant_id,owner_id,product_id,product_version,rule_version,input,premium,fee,total,currency,expires_at,$3 FROM quotes WHERE id=$2",
          [randomUUID(), quote.id, JSON.stringify(snapshot)],
        ),
      ),
      /quotes_snapshot_identity/,
    );
  }
});

test("quote snapshot migration preserves pre-existing quote rows without fabricating terms", async () => {
  const quote = await createQuote(actor, input);
  const admin = new pg.Client({
    connectionString: process.env.DATABASE_ADMIN_URL,
  });
  await admin.connect();
  try {
    // Session-local copies model the pre-003 tables without altering the live test schema.
    await admin.query(
      "CREATE TEMP TABLE quotes (LIKE public.quotes INCLUDING ALL)",
    );
    await admin.query(
      "ALTER TABLE pg_temp.quotes DROP COLUMN product_snapshot",
    );
    await admin.query(
      "CREATE TEMP TABLE schema_migrations (version text PRIMARY KEY)",
    );
    await admin.query(
      "INSERT INTO pg_temp.quotes SELECT (jsonb_populate_record(NULL::pg_temp.quotes,to_jsonb(q))).* FROM public.quotes q WHERE id=$1",
      [quote.id],
    );
    const before = (await admin.query("SELECT * FROM pg_temp.quotes")).rows;
    assert.equal(before.length, 1);
    await admin.query(
      readFileSync(
        new URL("../server/migrations/003-quote-snapshot.sql", import.meta.url),
        "utf8",
      ),
    );
    const after = (await admin.query("SELECT * FROM pg_temp.quotes")).rows;
    assert.deepEqual(
      after,
      before.map((row) => ({ ...row, product_snapshot: null })),
    );
    assert.deepEqual(
      (await admin.query("SELECT version FROM pg_temp.schema_migrations")).rows,
      [{ version: "003" }],
    );
  } finally {
    await admin.end();
  }
});

test("quote snapshot does not bypass current product availability or version restrictions", async () => {
  const product = products.find((p) => p.id === input.productId)!;
  const original = structuredClone(product);
  for (const change of [
    { published: false },
    { version: "changed" },
    { ruleVersion: "changed" },
    { effectiveFrom: "2099-01-01" },
    { effectiveTo: "2000-01-01" },
  ]) {
    const quote = await createQuote(actor, input);
    try {
      Object.assign(product, change);
      await assert.rejects(
        createApplication(actor, application(quote.id), randomUUID()),
        (e: unknown) =>
          e instanceof DomainError && e.code === "PRODUCT_UNAVAILABLE",
      );
      assert.equal(
        (
          await transaction(actor, (db) =>
            db.query("SELECT id FROM applications WHERE quote_id=$1", [
              quote.id,
            ]),
          )
        ).rowCount,
        0,
      );
    } finally {
      Object.assign(product, original);
    }
  }
});
