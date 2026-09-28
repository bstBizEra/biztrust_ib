import test from "node:test";
import assert from "node:assert/strict";
import { products } from "../server/catalog.ts";
import { config } from "../server/config.ts";
import { DomainError } from "../server/domain.ts";
import {
  inspectProducts,
  previewProduct,
  productPreviewInput,
  operationsProductsResponse,
  productPreviewResponse,
} from "../server/operations-products.ts";

const actor = {
  tenant: "synthetic-inspection",
  user: "staff",
  role: "operations" as const,
};
const now = new Date("2026-09-27T00:00:00Z");
function sample(id = "travel-essential") {
  const product = products.find((item) => item.id === id)!;
  return {
    productVersion: product.version,
    ruleVersion: product.ruleVersion,
    age: 30,
    days: 7,
  };
}
function errorCode(code: string, status: number) {
  return (error: unknown) =>
    error instanceof DomainError &&
    error.code === code &&
    error.status === status;
}

test("inspection projects synthetic fixture versions without leaking mutable references", () => {
  const response = inspectProducts(actor);
  operationsProductsResponse.parse(response);
  assert.equal(response.products.length, products.length);
  for (const [index, product] of response.products.entries()) {
    assert.equal(product.productVersion, products[index].version);
    assert.equal(product.ruleVersion, products[index].ruleVersion);
    assert.equal(product.demoAvailable, products[index].published);
    assert.match(product.source, /Synthetic/);
    assert.equal("published" in product, false);
  }
  response.products[0].coverage.push("tampered");
  response.products[0].flex.addons[0].ratePercent = 999;
  assert.equal(products[0].coverage.includes("tampered"), false);
  assert.notEqual(products[0].flex.addons[0].ratePercent, 999);
  assert.deepEqual(
    inspectProducts({ ...actor, tenant: "second-demo-tenant" }),
    inspectProducts(actor),
  );
});

test("preview preserves independent golden amounts and exposes no persisted quote identity", () => {
  const vectors = [
    { id: "travel-essential", input: sample(), total: 168000 },
    {
      id: "health-essential",
      input: { ...sample("health-essential"), age: 61 },
      total: 4500000,
    },
    {
      id: "health-essential",
      input: {
        ...sample("health-essential"),
        coverageAmount: 225000000,
        addons: ["health-extra-1"],
      },
      total: 5832000,
    },
  ];
  for (const vector of vectors) {
    const result = previewProduct(actor, vector.id, vector.input, now);
    productPreviewResponse.parse(result);
    assert.equal(result.total, vector.total);
    assert.equal(result.fee, 0);
    assert.equal(result.currency, "LAK");
    assert.equal(result.previewOnly, true);
    assert.equal(result.synthetic, true);
    assert.equal(result.mode, "preview");
    assert.equal(result.productVersion, vector.input.productVersion);
    assert.equal(result.ruleVersion, vector.input.ruleVersion);
    for (const field of ["id", "quoteId", "expiresAt", "product"])
      assert.equal(field in result, false);
    assert.deepEqual(
      previewProduct(actor, vector.id, vector.input, now),
      result,
    );
  }
  const defaults = previewProduct(
    actor,
    "travel-essential",
    {
      productVersion: sample().productVersion,
      ruleVersion: sample().ruleVersion,
      age: 30,
    },
    now,
  );
  assert.deepEqual(defaults.input, {
    age: 30,
    days: 7,
    coverageAmount: 300000000,
    addons: [],
  });
});

test("inspection and preview independently enforce staff actor and loopback demo gate", () => {
  for (const invalid of [
    { ...actor, role: "customer" as const },
    { ...actor, tenant: "" },
    { ...actor, user: "" },
  ]) {
    assert.throws(
      () => inspectProducts(invalid),
      errorCode("OPERATIONS_REQUIRED", 403),
    );
    assert.throws(
      () => previewProduct(invalid, "travel-essential", sample(), now),
      errorCode("OPERATIONS_REQUIRED", 403),
    );
  }
  const previous = {
    demo: config.demo,
    host: config.host,
    origin: config.origin,
  };
  try {
    for (const changed of [
      { ...previous, demo: false },
      { ...previous, host: "0.0.0.0" },
      { ...previous, origin: "https://example.test" },
    ]) {
      Object.assign(config, changed);
      assert.throws(() => inspectProducts(actor), errorCode("NOT_FOUND", 404));
      assert.throws(
        () => previewProduct(actor, "travel-essential", sample(), now),
        errorCode("NOT_FOUND", 404),
      );
    }
  } finally {
    Object.assign(config, previous);
  }
});

test("preview rejects stale versions and unavailable products", () => {
  for (const field of ["productVersion", "ruleVersion"])
    assert.throws(
      () =>
        previewProduct(
          actor,
          "travel-essential",
          { ...sample(), [field]: "old-version" },
          now,
        ),
      errorCode("PRODUCT_VERSION_MISMATCH", 409),
    );
  assert.throws(
    () => previewProduct(actor, "unknown", sample(), now),
    errorCode("PRODUCT_UNAVAILABLE", 404),
  );
  for (const date of ["2025-12-31", "2100-01-01"])
    assert.throws(
      () => previewProduct(actor, "travel-essential", sample(), new Date(date)),
      errorCode("PRODUCT_UNAVAILABLE", 404),
    );
});

test("strict preview and inspection inputs reject authority, price and selection tampering", () => {
  for (const field of [
    "tenant",
    "owner",
    "role",
    "actor",
    "productId",
    "premium",
    "published",
    "now",
  ])
    assert.throws(() =>
      previewProduct(
        actor,
        "travel-essential",
        { ...sample(), [field]: "injected" },
        now,
      ),
    );
  assert.throws(() => inspectProducts(actor, { tenant: "another" }));
  for (const body of [
    { age: 30 },
    { ...sample(), age: 17 },
    { ...sample(), age: 71 },
    { ...sample(), age: 30.5 },
    { ...sample(), days: 0 },
    { ...sample(), days: 91 },
    { ...sample(), coverageAmount: 0 },
  ])
    assert.equal(productPreviewInput.safeParse(body).success, false);
  for (const selection of [
    { coverageAmount: 160000000 },
    { coverageAmount: 600000001 },
    { addons: ["travel-extra-1", "travel-extra-1"] },
    { addons: ["health-extra-1"] },
  ])
    assert.throws(
      () =>
        previewProduct(
          actor,
          "travel-essential",
          { ...sample(), ...selection },
          now,
        ),
      errorCode("INVALID_COVERAGE", 400),
    );
  for (const age of [18, 70])
    for (const days of [1, 90])
      assert.ok(
        previewProduct(
          actor,
          "travel-essential",
          { ...sample(), age, days },
          now,
        ).total > 0,
      );
});
