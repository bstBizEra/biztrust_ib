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
test("OpenAPI is valid and mutation/provider schemas match runtime validation", async () => {
  await SwaggerParser.validate("api/openapi.json");
  const spec = JSON.parse(readFileSync("api/openapi.json", "utf8"));
  for (const [name, schema] of Object.entries({
    QuoteInput: quoteInput,
    ApplicationInput: applicationInput,
    PaymentEvent: paymentEvent,
    InsurerInput: insurerInput,
  })) {
    const generated = z.toJSONSchema(schema);
    delete generated.$schema;
    assert.deepEqual(
      spec.components.schemas[name],
      generated,
      `Regenerate OpenAPI after changing ${name}`,
    );
  }
  assert.equal(Object.keys(spec.paths).length, 23);
  assert.ok(spec.paths["/ops/v1/cases"].get.security[0].staffSession);
  assert.ok(
    spec.paths["/api/webhooks/payment"].post.security[0].providerSignature,
  );
});
