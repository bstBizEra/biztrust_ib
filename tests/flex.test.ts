import test, { after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { calculateQuote, quoteInput } from "../server/domain.ts";
import { products } from "../server/catalog.ts";
import {
  createQuote,
  createApplication,
  applicationDetail,
} from "../server/services.ts";
import { pool, transaction } from "../server/db.ts";
import { pricePlan, restoreSelection } from "../shared/pricing.ts";

after(async () => {
  await pool.end();
});
test("flex cover prices amount and optional benefits with deterministic LAK breakdowns", () => {
  const input = {
    productId: "health-essential",
    age: 30,
    days: 7,
    coverageAmount: 225000000,
    addons: ["health-extra-1"],
  };
  const essential = calculateQuote(input);
  assert.equal(essential.breakdown.base, 5400000);
  assert.equal(essential.breakdown.addons[0].premium, 432000);
  assert.equal(essential.total, 5832000);
  assert.equal(essential.product.limit, "Annual medical limit: ₭225,000,000");
  assert.ok(essential.product.coverage.includes("Outpatient consultations"));
  assert.equal(
    calculateQuote({ ...input, productId: "health-plus" }).total,
    8586000,
  );
  assert.equal(calculateQuote({ ...input, addons: [] }).total, 5400000);
  assert.equal(calculateQuote({ ...input, age: 61 }).total, 7290000);
  assert.equal(
    calculateQuote({ ...input, addons: ["health-extra-1", "health-extra-2"] })
      .total,
    6480000,
  );
  const travel = calculateQuote({
    productId: "travel-essential",
    age: 30,
    days: 10,
    coverageAmount: 450000000,
    addons: ["travel-extra-1"],
  });
  assert.equal(travel.total, 388800);
});
test("all category sliders have working bounds and reversible add-ons", () => {
  for (const product of products) {
    const common = { productId: product.id, age: 30, days: 1 };
    assert.equal(
      calculateQuote({ ...common, coverageAmount: product.flex.min }).total,
      product.basePremium / 2,
    );
    assert.equal(
      calculateQuote({ ...common, coverageAmount: product.flex.max }).total,
      product.basePremium * 2,
    );
    const extra = calculateQuote({
      ...common,
      addons: [product.flex.addons[0].id],
    });
    assert.ok(extra.total > product.basePremium);
    assert.ok(Number.isSafeInteger(extra.total));
  }
});
test("flex pricing rejects tampered values, wrong increments, duplicate and foreign benefits", () => {
  const input = { productId: "health-essential", age: 30, days: 7 };
  for (const coverageAmount of [
    0,
    74999999,
    300000001,
    160000000,
    150000000.5,
    NaN,
    Infinity,
  ])
    assert.throws(() => calculateQuote({ ...input, coverageAmount }));
  for (const addons of [
    ["health-extra-1", "health-extra-1"],
    ["motor-extra-1"],
    ["made-up"],
  ])
    assert.throws(
      () => calculateQuote({ ...input, addons }),
      /optional benefits/,
    );
  assert.throws(() => quoteInput.parse({ ...input, premium: 1 }));
});
test("corrupt or obsolete browser selections recover to a valid default", () => {
  const product = products[0];
  for (const invalid of [
    null,
    {},
    { coverageAmount: 1 },
    {
      coverageAmount: product.flex.baseAmount,
      addons: ["old-benefit"],
      age: 30,
      days: 7,
    },
  ]) {
    const selection = restoreSelection(product, invalid);
    assert.equal(selection.coverageAmount, product.flex.baseAmount);
    assert.deepEqual(selection.addons, []);
    assert.equal(pricePlan(product, selection).premium, product.basePremium);
  }
});
test("saved flex selection, coverage snapshot and invoice retain the exact premium", async () => {
  const actor = {
    tenant: `flex-test-${randomUUID()}`,
    user: "flex-tester",
    role: "customer" as const,
  };
  const quote = await createQuote(actor, {
    productId: "health-essential",
    age: 30,
    days: 7,
    coverageAmount: 225000000,
    addons: ["health-extra-1"],
  });
  const { reference } = await createApplication(
    actor,
    {
      quoteId: quote.id,
      fullName: "Flex Test",
      email: "flex@example.test",
      consent: true,
      disclosure: true,
    },
    randomUUID(),
  );
  const detail = await applicationDetail(actor, reference);
  assert.equal(Number(detail.invoice.amount), 5832000);
  assert.equal(
    detail.application.product_snapshot.limit,
    "Annual medical limit: ₭225,000,000",
  );
  assert.ok(
    detail.application.product_snapshot.coverage.includes(
      "Outpatient consultations",
    ),
  );
  await transaction(actor, async (db) => {
    const saved = (
      await db.query("SELECT input,rule_version FROM quotes WHERE id=$1", [
        quote.id,
      ])
    ).rows[0];
    assert.deepEqual(saved.input.addons, ["health-extra-1"]);
    assert.equal(saved.input.coverageAmount, 225000000);
    assert.equal(saved.rule_version, "demo-flex-pricing-2");
  });
});
