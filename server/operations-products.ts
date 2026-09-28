import { z } from "zod";
import type { Actor } from "./db.ts";
import { products } from "./catalog.ts";
import { localDemoAvailable } from "./config.ts";
import { calculateQuote, DomainError, quoteInput } from "./domain.ts";
import type {
  OperationsProductsResponse,
  ProductPreviewResponse,
} from "../shared/operations-products.ts";

export const productPreviewInput = quoteInput
  .omit({ productId: true })
  .extend({
    productVersion: z.string().min(1).max(100),
    ruleVersion: z.string().min(1).max(100),
  })
  .strict();
export const productInspectionQuery = z.object({}).strict();
const addon = z
  .object({
    id: z.string(),
    name: z.string(),
    ratePercent: z.number(),
  })
  .strict();
export const operationsProductsResponse = z
  .object({
    synthetic: z.literal(true),
    mode: z.literal("inspection"),
    products: z.array(
      z
        .object({
          id: z.string(),
          name: z.string(),
          category: z.string(),
          description: z.string(),
          insurerId: z.string(),
          insurer: z.string(),
          productVersion: z.string(),
          ruleVersion: z.string(),
          effectiveFrom: z.string(),
          effectiveTo: z.string(),
          synthetic: z.literal(true),
          demoAvailable: z.boolean(),
          source: z.string(),
          eligibility: z.string(),
          conditions: z.string(),
          coverage: z.array(z.string()),
          limit: z.string(),
          exclusion: z.string(),
          deductible: z.string(),
          basePremium: z.number().int().positive(),
          period: z.enum(["day", "year"]),
          flex: z
            .object({
              label: z.string(),
              baseAmount: z.number(),
              min: z.number(),
              max: z.number(),
              step: z.number(),
              addons: z.array(addon),
            })
            .strict(),
        })
        .strict(),
    ),
  })
  .strict();
export const productPreviewResponse = z
  .object({
    synthetic: z.literal(true),
    previewOnly: z.literal(true),
    mode: z.literal("preview"),
    productId: z.string(),
    productVersion: z.string(),
    ruleVersion: z.string(),
    input: z
      .object({
        age: z.number().int(),
        days: z.number().int(),
        coverageAmount: z.number().int(),
        addons: z.array(z.string()),
      })
      .strict(),
    breakdown: z
      .object({
        base: z.number().int(),
        addons: z.array(addon.extend({ premium: z.number().int() }).strict()),
      })
      .strict(),
    premium: z.number().int(),
    fee: z.number().int(),
    total: z.number().int(),
    currency: z.literal("LAK"),
  })
  .strict();

function requireInspectionAccess(actor: Actor) {
  if (actor.role !== "operations" || !actor.tenant || !actor.user)
    throw new DomainError(
      403,
      "OPERATIONS_REQUIRED",
      "This operation requires staff access.",
    );
  if (!localDemoAvailable())
    throw new DomainError(404, "NOT_FOUND", "Not found.");
}

export function inspectProducts(
  actor: Actor,
  query: unknown = {},
): OperationsProductsResponse {
  requireInspectionAccess(actor);
  productInspectionQuery.parse(query);
  return {
    synthetic: true,
    mode: "inspection",
    products: products.map((product) => ({
      id: product.id,
      name: product.name,
      category: product.category,
      description: product.description,
      insurerId: product.insurerId,
      insurer: product.insurer,
      productVersion: product.version,
      ruleVersion: product.ruleVersion,
      effectiveFrom: product.effectiveFrom,
      effectiveTo: product.effectiveTo,
      synthetic: true,
      demoAvailable: product.published,
      source: product.source,
      eligibility: product.eligibility,
      conditions: product.conditions,
      coverage: [...product.coverage],
      limit: product.limit,
      exclusion: product.exclusion,
      deductible: product.deductible,
      basePremium: product.basePremium,
      period: product.period === "day" ? "day" : "year",
      flex: {
        ...product.flex,
        addons: product.flex.addons.map((item) => ({ ...item })),
      },
    })),
  };
}

export function previewProduct(
  actor: Actor,
  productId: string,
  body: unknown,
  now = new Date(),
): ProductPreviewResponse {
  requireInspectionAccess(actor);
  const input = productPreviewInput.parse(body);
  const product = products.find((candidate) => candidate.id === productId);
  const date = now.toISOString().slice(0, 10);
  if (
    !product ||
    !product.published ||
    product.effectiveFrom > date ||
    product.effectiveTo < date
  )
    throw new DomainError(
      404,
      "PRODUCT_UNAVAILABLE",
      "This demonstration product is unavailable.",
    );
  if (
    input.productVersion !== product.version ||
    input.ruleVersion !== product.ruleVersion
  )
    throw new DomainError(
      409,
      "PRODUCT_VERSION_MISMATCH",
      "This product or rating version changed. Refresh the inspector and try again.",
    );
  const calculation = calculateQuote(
    {
      productId,
      age: input.age,
      days: input.days,
      coverageAmount: input.coverageAmount,
      addons: input.addons,
    },
    now,
  );
  return {
    synthetic: true,
    previewOnly: true,
    mode: "preview",
    productId: product.id,
    productVersion: product.version,
    ruleVersion: product.ruleVersion,
    input: {
      age: calculation.input.age,
      days: calculation.input.days,
      coverageAmount: calculation.input.coverageAmount,
      addons: [...calculation.input.addons],
    },
    breakdown: {
      base: calculation.breakdown.base,
      addons: calculation.breakdown.addons.map(
        ({ id, name, ratePercent, premium }) => ({
          id,
          name,
          ratePercent,
          premium,
        }),
      ),
    },
    premium: calculation.premium,
    fee: calculation.fee,
    total: calculation.total,
    currency: calculation.currency,
  };
}
