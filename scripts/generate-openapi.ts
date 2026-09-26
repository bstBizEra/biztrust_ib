import { writeFileSync, mkdirSync } from "node:fs";
import { z } from "zod";
import {
  quoteInput,
  applicationInput,
  paymentEvent,
  insurerInput,
} from "../server/domain.ts";

function schema(input: z.ZodType) {
  const value = z.toJSONSchema(input);
  delete value.$schema;
  return value;
}
const json = (value: unknown) => ({ "application/json": { schema: value } });
const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const error = {
  description: "Typed error with safe message and request ID",
  content: json(ref("Error")),
};
const standard = {
  "400": error,
  "401": error,
  "403": error,
  "404": error,
  "409": error,
  "429": { description: "Rate limit exceeded" },
  "500": error,
  "503": error,
};
const csrf = {
  name: "X-CSRF-Token",
  in: "header",
  required: true,
  schema: { type: "string" },
  description:
    "From GET /api/session; mutations also require an exact same-origin Origin header.",
};
const staffCsrfHeader = {
  ...csrf,
  description:
    "From GET /ops/v1/session; staff mutations require the exact same-origin Origin header.",
};
const reference = {
  name: "reference",
  in: "path",
  required: true,
  schema: { type: "string", pattern: "^BT-[0-9]{4}-[A-F0-9]{10}$" },
};
function response(
  description: string,
  schema: unknown = { type: "object", additionalProperties: true },
) {
  return { description, content: json(schema) };
}
function mutation(
  summary: string,
  input: string,
  output: unknown = { type: "object" },
  status = "200",
) {
  return {
    summary,
    parameters: [csrf],
    requestBody: { required: true, content: json(ref(input)) },
    responses: {
      [status]: response("Successful request", output),
      ...standard,
    },
  };
}
const spec = {
  openapi: "3.1.0",
  info: {
    title: "BizTrust brokerage API",
    version: "0.1.0",
    description:
      "Local demonstration contracts. All products, payments and insurer outcomes are synthetic. No actual cover. No live provider integration is configured.",
  },
  servers: [{ url: "http://127.0.0.1:3000" }],
  security: [{ session: [] }],
  paths: {
    "/api/health": {
      get: {
        summary: "Database-backed health and explicit mode",
        security: [],
        responses: {
          "200": response("Healthy", {
            type: "object",
            required: ["status", "mode", "version"],
            properties: {
              status: { const: "ok" },
              mode: { const: "demonstration" },
              version: { type: "string" },
            },
          }),
          "500": error,
        },
      },
    },
    "/api/catalog": {
      get: {
        summary: "Versioned synthetic multi-insurer catalogue",
        security: [],
        responses: {
          "200": response("Catalogue", {
            type: "object",
            required: ["categories", "insurers", "products", "synthetic"],
            properties: {
              categories: { type: "array", items: { type: "object" } },
              insurers: { type: "array", items: { type: "object" } },
              products: { type: "array", items: ref("Product") },
              synthetic: { const: true },
              mode: { const: "demonstration" },
            },
          }),
          ...standard,
        },
      },
    },
    "/api/session": {
      get: {
        summary: "Current server session, CSRF token and identity capabilities",
        security: [],
        responses: { "200": response("Session"), ...standard },
      },
    },
    "/api/auth/demo": {
      post: {
        ...mutation("Create isolated customer demo session", "Empty"),
        description:
          "Loopback demonstration only. Rotates the session; user cannot choose tenant or role.",
      },
    },
    "/api/auth/logout": {
      post: mutation(
        "Revoke local session and create anonymous session",
        "Empty",
      ),
    },
    "/api/auth/login": {
      get: {
        summary:
          "Start Logto-compatible confidential OIDC code flow with state, nonce and PKCE",
        responses: {
          "302": { description: "Identity provider redirect" },
          "503": error,
        },
      },
    },
    "/api/auth/callback": {
      get: {
        summary:
          "Verify OIDC response and establish server-selected membership",
        responses: {
          "302": { description: "Signed-in application redirect" },
          ...standard,
        },
      },
    },
    "/api/quotes": {
      post: mutation(
        "Create a reproducible, owned 30-minute quote",
        "QuoteInput",
        ref("Quote"),
        "201",
      ),
    },
    "/api/applications": {
      get: {
        summary: "List current tenant and ownership-scoped applications",
        responses: {
          "200": response("Applications", {
            type: "array",
            items: {
              type: "object",
              required: [
                "reference",
                "product_snapshot",
                "insurer_status",
                "payment_status",
              ],
              properties: {
                reference: { type: "string" },
                product_snapshot: ref("Product"),
                insurer_status: { type: "string" },
                payment_status: { type: "string" },
              },
            },
          }),
          ...standard,
        },
      },
      post: {
        ...mutation(
          "Atomically create application, invoice and consent/audit evidence",
          "ApplicationInput",
          {
            type: "object",
            required: ["reference", "duplicate"],
            properties: {
              reference: { type: "string" },
              duplicate: { type: "boolean" },
            },
          },
          "201",
        ),
        parameters: [
          csrf,
          {
            name: "Idempotency-Key",
            in: "header",
            required: true,
            schema: {
              type: "string",
              minLength: 16,
              maxLength: 80,
              pattern: "^[a-zA-Z0-9-]+$",
            },
          },
        ],
        responses: {
          "201": response("Application created"),
          "200": response("Identical retry returns original reference"),
          ...standard,
        },
      },
    },
    "/api/applications/{reference}": {
      parameters: [reference],
      get: {
        summary:
          "Application, invoice, quote and audit history, subject to ownership",
        responses: {
          "200": response("Application detail", {
            type: "object",
            required: ["application", "invoice", "quote", "history"],
            properties: {
              application: { type: "object" },
              invoice: { type: "object" },
              quote: { type: "object" },
              history: { type: "array", items: { type: "object" } },
            },
          }),
          ...standard,
        },
      },
    },
    "/api/applications/{reference}/qr": {
      parameters: [reference],
      get: {
        summary: "Owned, unexpired, non-payable demonstration QR",
        responses: {
          "200": {
            description:
              "SVG payload explicitly starts BIZTRUST-DEMO-NOT-PAYABLE",
            content: { "image/svg+xml": { schema: { type: "string" } } },
          },
          ...standard,
        },
      },
    },
    "/api/applications/{reference}/document": {
      parameters: [reference],
      get: {
        summary: "Owned synthetic issuance evidence; never a real policy",
        responses: {
          "200": {
            description: "Attachment marked NOT AN INSURANCE POLICY",
            content: { "text/plain": { schema: { type: "string" } } },
          },
          ...standard,
        },
      },
    },
    "/api/webhooks/payment": {
      post: {
        summary: "Verified simulator payment-provider callback",
        security: [{ providerSignature: [] }],
        description:
          "HMAC-SHA256 hex(timestamp + dot + exact raw request body). Timestamp is Unix milliseconds, max absolute skew 300000 ms. Signed context sets tenant/owner. A minimal verified event is durably committed before domain processing. Event IDs are idempotent; changed payload conflicts. Late/mismatched payments enter reconciliation. A processing failure returns 503 PAYMENT_PROCESSING_PENDING; redeliver the same event after signing with a fresh timestamp.",
        parameters: [
          {
            name: "X-Provider-Timestamp",
            in: "header",
            required: true,
            schema: { type: "string", pattern: "^[0-9]{13}$" },
          },
        ],
        requestBody: { required: true, content: json(ref("PaymentEvent")) },
        responses: {
          "200": response("Normalized event outcome", {
            type: "object",
            required: ["outcome", "duplicate"],
            properties: {
              outcome: {
                enum: [
                  "settled",
                  "failed",
                  "already_settled",
                  "late_payment_review",
                  "reconciliation_required",
                ],
              },
              duplicate: { type: "boolean" },
            },
          }),
          ...standard,
        },
      },
    },
    "/api/demo/applications/{reference}/payment": {
      parameters: [reference],
      post: {
        ...mutation(
          "Generate and verify an owned simulator payment event",
          "Empty",
        ),
        description: "Local-only simulator, never live payment confirmation.",
      },
    },
    "/api/demo/applications/{reference}/insurer": {
      parameters: [reference],
      post: {
        ...mutation(
          "Apply an explicit synthetic insurer outcome",
          "InsurerInput",
        ),
        description:
          "Requires a settled simulator payment. Final rejected/issued states cannot be overwritten. Issued evidence is explicitly synthetic and does not bind coverage.",
      },
    },
    "/ops/auth/login": {
      get: {
        summary: "Start separate staff OIDC code flow",
        security: [],
        responses: {
          "302": { description: "Staff identity redirect" },
          ...standard,
        },
      },
    },
    "/ops/auth/callback": {
      get: {
        summary:
          "Verify staff identity and pre-provisioned operations membership",
        security: [],
        responses: {
          "302": { description: "Operations redirect" },
          ...standard,
        },
      },
    },
    "/ops/auth/logout": {
      post: {
        summary: "Revoke staff session",
        security: [{ staffSession: [] }],
        parameters: [staffCsrfHeader],
        responses: { "200": response("Signed out"), ...standard },
      },
    },
    "/ops/auth/demo": {
      post: {
        summary: "Create an isolated local staff demonstration workspace",
        description:
          "Loopback demonstration only. Server generates the tenant and synthetic records; no client-selected tenant or role. Separate staff cookie and CSRF required.",
        security: [{ staffSession: [] }],
        parameters: [staffCsrfHeader],
        requestBody: { required: true, content: json(ref("Empty")) },
        responses: { "200": response("Staff demo session"), ...standard },
      },
    },
    "/ops/v1/session": {
      get: {
        summary: "Staff tenant and CSRF context",
        security: [],
        responses: { "200": response("Staff context"), ...standard },
      },
    },
    "/ops/v1/overview": {
      get: {
        summary: "Tenant-scoped operational counts and simulator status",
        security: [{ staffSession: [] }],
        responses: { "200": response("Operations overview"), ...standard },
      },
    },
    "/ops/v1/cases": {
      get: {
        summary: "Tenant-scoped case queue without customer PII",
        security: [{ staffSession: [] }],
        parameters: [
          { name: "status", in: "query", schema: { type: "string" } },
          { name: "payment", in: "query", schema: { type: "string" } },
          { name: "reference", in: "query", schema: { type: "string" } },
          {
            name: "limit",
            in: "query",
            schema: { type: "integer", minimum: 1, maximum: 100 },
          },
        ],
        responses: {
          "200": response("Case queue", {
            type: "array",
            items: { type: "object" },
          }),
          ...standard,
        },
      },
    },
    "/ops/v1/cases/{id}": {
      parameters: [
        {
          name: "id",
          in: "path",
          required: true,
          schema: { type: "string", format: "uuid" },
        },
      ],
      get: {
        summary: "Masked case and chronological evidence",
        security: [{ staffSession: [] }],
        responses: { "200": response("Case evidence"), ...standard },
      },
    },
    "/ops/v1/integrations": {
      get: {
        summary: "Simulator adapters and retry queue health",
        security: [{ staffSession: [] }],
        responses: { "200": response("Integration status"), ...standard },
      },
    },
  },
  components: {
    securitySchemes: {
      session: {
        type: "apiKey",
        in: "cookie",
        name: "bt_session",
        description:
          "Opaque HttpOnly SameSite=Lax server session, Secure on HTTPS.",
      },
      staffSession: {
        type: "apiKey",
        in: "cookie",
        name: "bt_ops_session",
        description:
          "Separate HttpOnly staff session, issued only after staff OIDC and pre-provisioned membership.",
      },
      providerSignature: {
        type: "apiKey",
        in: "header",
        name: "X-Provider-Signature",
        description:
          "64-character lowercase hex HMAC-SHA256. See callback authentication contract.",
      },
    },
    schemas: {
      Empty: { type: "object", maxProperties: 0 },
      QuoteInput: schema(quoteInput),
      ApplicationInput: schema(applicationInput),
      PaymentEvent: schema(paymentEvent),
      InsurerInput: schema(insurerInput),
      Error: {
        type: "object",
        required: ["error"],
        properties: {
          error: {
            type: "object",
            required: ["code", "message", "requestId"],
            properties: {
              code: { type: "string" },
              message: { type: "string" },
              requestId: { type: "string" },
              fields: { type: "array", items: { type: "object" } },
            },
          },
        },
      },
      Product: {
        type: "object",
        required: [
          "id",
          "category",
          "insurerId",
          "version",
          "ruleVersion",
          "synthetic",
          "coverage",
          "limit",
          "exclusion",
          "deductible",
          "source",
        ],
        properties: {
          id: { type: "string" },
          category: { type: "string" },
          name: { type: "string" },
          insurerId: { type: "string" },
          version: { type: "string" },
          ruleVersion: { type: "string" },
          synthetic: { const: true },
          basePremium: { type: "number" },
          period: { enum: ["day", "year"] },
          coverage: { type: "array", items: { type: "string" } },
          limit: { type: "string" },
          exclusion: { type: "string" },
          deductible: { type: "string" },
          source: { type: "string" },
          flex: {
            type: "object",
            description:
              "Synthetic coverage range, increment, base amount and insurer-specific optional-benefit percentage rates. Runtime validates selection against this product configuration.",
          },
        },
      },
      Quote: {
        type: "object",
        required: [
          "id",
          "premium",
          "fee",
          "total",
          "currency",
          "expiresAt",
          "ruleVersion",
          "product",
        ],
        properties: {
          id: { type: "string", format: "uuid" },
          premium: { type: "integer", minimum: 1 },
          fee: { type: "integer", minimum: 0 },
          total: { type: "integer", minimum: 1 },
          currency: { const: "LAK" },
          expiresAt: { type: "string", format: "date-time" },
          ruleVersion: { type: "string" },
          product: ref("Product"),
          input: ref("QuoteInput"),
          breakdown: {
            type: "object",
            description:
              "Integer LAK base premium and individually priced selected benefits; premium equals their sum.",
          },
        },
      },
    },
  },
};
mkdirSync("api", { recursive: true });
writeFileSync("api/openapi.json", JSON.stringify(spec, null, 2) + "\n");
console.log(
  "OpenAPI 3.1 generated from the same request schemas used at runtime.",
);
