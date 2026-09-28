import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import SwaggerParser from "@apidevtools/swagger-parser";
import { z } from "zod";
import {
  quoteInput,
  applicationInput,
  paymentEvent,
  insurerInput,
} from "../server/domain.ts";
import {
  productPreviewInput,
  operationsProductsResponse,
  productPreviewResponse,
} from "../server/operations-products.ts";
test("OpenAPI is valid and mutation/provider schemas match runtime validation", async () => {
  await SwaggerParser.validate("api/openapi.json");
  const spec = JSON.parse(readFileSync("api/openapi.json", "utf8"));
  for (const [name, schema] of Object.entries({
    QuoteInput: quoteInput,
    ApplicationInput: applicationInput,
    PaymentEvent: paymentEvent,
    InsurerInput: insurerInput,
    ProductPreviewInput: productPreviewInput,
    OperationsProductsResponse: operationsProductsResponse,
    ProductPreviewResponse: productPreviewResponse,
  })) {
    const generated = z.toJSONSchema(schema);
    delete generated.$schema;
    assert.deepEqual(
      spec.components.schemas[name],
      generated,
      `Regenerate OpenAPI after changing ${name}`,
    );
  }
  assert.equal(Object.keys(spec.paths).length, 26);
  assert.ok(spec.paths["/ops/v1/products"].get.security[0].staffSession);
  const preview = spec.paths["/ops/v1/products/{id}/preview"].post;
  assert.ok(preview.security[0].staffSession);
  for (const name of ["X-CSRF-Token", "Origin"])
    assert.ok(
      preview.parameters.some(
        (parameter: { name: string; required?: boolean }) =>
          parameter.name === name && parameter.required,
      ),
    );
  assert.equal(
    spec.components.schemas.ProductPreviewInput.additionalProperties,
    false,
  );
  assert.equal(
    spec.components.schemas.ProductPreviewResponse.additionalProperties,
    false,
  );
  assert.ok(spec.paths["/ops/v1/cases"].get.security[0].staffSession);
  assert.ok(
    spec.paths["/api/webhooks/payment"].post.security[0].providerSignature,
  );
});
