import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateQuote,
  signEvent,
  verifyEvent,
  assertInsurerTransition,
  quoteInput,
  applicationInput,
} from "../server/domain.ts";
import { products, categories } from "../server/catalog.ts";
import { validateConfig, config } from "../server/config.ts";

test("every product line has multiple independently versioned insurer variants", () => {
  assert.equal(categories.length - 1, 12);
  for (const c of categories.slice(1)) {
    const plans = products.filter((p) => p.category === c.id);
    assert.equal(plans.length, 2);
    assert.equal(new Set(plans.map((p) => p.insurerId)).size, 2);
    assert.ok(
      plans.every(
        (p) =>
          p.synthetic && p.source && p.exclusion && p.deductible && p.version,
      ),
    );
  }
});
test("travel golden vector preserves currency, period, fee and price version", () => {
  const result = calculateQuote(
    { productId: "travel-essential", age: 30, days: 7 },
    new Date("2026-09-26T00:00:00Z"),
  );
  assert.equal(result.premium, 168000);
  assert.equal(result.total, 168000);
  assert.equal(result.fee, 0);
  assert.equal(result.ruleVersion, "demo-flex-pricing-2");
  assert.equal(result.expiresAt, "2026-09-26T00:30:00.000Z");
});
test("age loading has deterministic boundaries and is independent of display price", () => {
  assert.equal(
    calculateQuote({ productId: "health-essential", age: 60, days: 7 }).premium,
    3600000,
  );
  assert.equal(
    calculateQuote({ productId: "health-essential", age: 61, days: 7 }).premium,
    4500000,
  );
  assert.equal(
    calculateQuote({ productId: "motor-essential", age: 61, days: 90 }).premium,
    2400000,
  );
});
test("missing, out-of-range, fractional and unknown inputs fail closed", () => {
  for (const input of [
    {},
    { productId: "travel-essential", age: 17, days: 7 },
    { productId: "travel-essential", age: 71, days: 7 },
    { productId: "travel-essential", age: 30, days: 91 },
    { productId: "travel-essential", age: 30.5, days: 7 },
    { productId: "travel-essential", age: 30, days: 7, amount: 1 },
  ])
    assert.throws(() => quoteInput.parse(input));
  assert.throws(() =>
    calculateQuote({ productId: "not-published", age: 30, days: 7 }),
  );
  assert.throws(() =>
    calculateQuote(
      { productId: "travel-essential", age: 30, days: 7 },
      new Date("2100-01-01"),
    ),
  );
  assert.throws(() =>
    applicationInput.parse({
      quoteId: crypto.randomUUID(),
      fullName: "Demo",
      email: "demo@example.com",
      consent: false,
      disclosure: true,
    }),
  );
});
test("signed callbacks require exact bytes, a valid timestamp and constant-time signature", () => {
  const secret = "unit-test-only-generated-fixture-secret-000000";
  const now = Date.now();
  const timestamp = String(now);
  const body = '{"event":"synthetic"}';
  const signature = signEvent(body, timestamp, secret);
  assert.doesNotThrow(() =>
    verifyEvent(body, timestamp, signature, secret, now),
  );
  assert.throws(() =>
    verifyEvent(`${body} `, timestamp, signature, secret, now),
  );
  assert.throws(() =>
    verifyEvent(body, timestamp, signature, secret, now + 300001),
  );
  assert.throws(() =>
    verifyEvent(body, timestamp, signature, secret, now - 300001),
  );
  assert.throws(() => verifyEvent(body, timestamp, "abc", secret, now));
});
test("insurer issuance cannot skip payment or override a final outcome", () => {
  assert.throws(() => assertInsurerTransition("awaiting_payment", "issued"));
  assert.throws(() => assertInsurerTransition("rejected", "issued"));
  assert.throws(() => assertInsurerTransition("issued", "rejected"));
  assert.doesNotThrow(() => assertInsurerTransition("queued", "referred"));
  assert.doesNotThrow(() => assertInsurerTransition("timeout", "processing"));
});
test("production cannot activate with unapproved providers and fixtures", () => {
  const previous = config.demo;
  config.demo = false;
  try {
    assert.throws(() => validateConfig(), /Production activation is gated/);
  } finally {
    config.demo = previous;
  }
});
