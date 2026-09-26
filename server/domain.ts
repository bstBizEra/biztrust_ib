import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { products } from "./catalog.ts";
import { pricePlan, selectedLimit } from "../shared/pricing.ts";

export class DomainError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
export const quoteInput = z
  .object({
    productId: z.string().min(1),
    age: z.number().int().min(18).max(70),
    days: z.number().int().min(1).max(90).default(7),
    coverageAmount: z.number().int().positive().max(4000000000).optional(),
    addons: z.array(z.string().min(1).max(80)).max(2).optional(),
  })
  .strict();
export const applicationInput = z
  .object({
    quoteId: z.uuid(),
    fullName: z.string().trim().min(2).max(100),
    email: z.email().max(180),
    consent: z.literal(true),
    disclosure: z.literal(true),
  })
  .strict();
export const paymentEvent = z
  .object({
    eventId: z.string().min(12).max(150),
    tenant: z.string().min(1).max(100),
    owner: z.string().min(1).max(150),
    invoiceId: z.uuid(),
    providerReference: z.string().min(1),
    amount: z.number().int().positive(),
    currency: z.literal("LAK"),
    status: z.enum(["settled", "failed"]),
  })
  .strict();
export const insurerInput = z
  .object({
    outcome: z.enum([
      "processing",
      "referred",
      "additional_information",
      "rejected",
      "issued",
      "timeout",
    ]),
  })
  .strict();
export function hash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}
export function calculateQuote(
  input: z.infer<typeof quoteInput>,
  now = new Date(),
) {
  const parsed = quoteInput.parse(input);
  const product = products.find(
    (p) =>
      p.id === parsed.productId &&
      p.published &&
      p.effectiveFrom <= now.toISOString().slice(0, 10) &&
      p.effectiveTo >= now.toISOString().slice(0, 10),
  );
  if (!product)
    throw new DomainError(
      404,
      "PRODUCT_UNAVAILABLE",
      "This product is no longer available. Please choose another plan.",
    );
  const selection = {
    age: parsed.age,
    days: parsed.days,
    coverageAmount: parsed.coverageAmount ?? product.flex.baseAmount,
    addons: parsed.addons ?? [],
  };
  let pricing;
  try {
    pricing = pricePlan(product, selection);
  } catch (error) {
    throw new DomainError(400, "INVALID_COVERAGE", (error as Error).message);
  }
  const premium = pricing.premium;
  const fee = 0;
  return {
    product: {
      ...product,
      limit: selectedLimit(product, selection),
      coverage: [
        ...product.coverage,
        ...pricing.addons.map((addon) => addon.name),
      ],
      configuration: selection,
    },
    input: { ...parsed, ...selection },
    breakdown: { base: pricing.base, addons: pricing.addons },
    premium,
    fee,
    total: premium + fee,
    currency: "LAK" as const,
    expiresAt: new Date(now.getTime() + 30 * 60 * 1000).toISOString(),
    ruleVersion: product.ruleVersion,
  };
}
export function signEvent(body: string, timestamp: string, secret: string) {
  return createHmac("sha256", secret)
    .update(`${timestamp}.${body}`)
    .digest("hex");
}
export function verifyEvent(
  body: string,
  timestamp: string,
  signature: string,
  secret: string,
  now = Date.now(),
) {
  if (
    !/^\d{13}$/.test(timestamp) ||
    Math.abs(now - Number(timestamp)) > 300000 ||
    !/^[a-f0-9]{64}$/.test(signature)
  )
    throw new DomainError(
      401,
      "INVALID_SIGNATURE",
      "The provider event could not be verified.",
    );
  const expected = signEvent(body, timestamp, secret);
  if (
    !timingSafeEqual(
      Buffer.from(expected, "hex"),
      Buffer.from(signature, "hex"),
    )
  )
    throw new DomainError(
      401,
      "INVALID_SIGNATURE",
      "The provider event could not be verified.",
    );
}
export function assertInsurerTransition(from: string, to: string) {
  const allowed: Record<string, string[]> = {
    awaiting_payment: [],
    queued: [
      "processing",
      "referred",
      "additional_information",
      "rejected",
      "issued",
      "timeout",
    ],
    processing: [
      "referred",
      "additional_information",
      "rejected",
      "issued",
      "timeout",
    ],
    referred: [
      "processing",
      "additional_information",
      "rejected",
      "issued",
      "timeout",
    ],
    additional_information: ["processing", "rejected", "issued", "timeout"],
    timeout: [
      "processing",
      "referred",
      "additional_information",
      "rejected",
      "issued",
    ],
    issued: [],
    rejected: [],
  };
  if (!(allowed[from] || []).includes(to))
    throw new DomainError(
      409,
      "INVALID_TRANSITION",
      "That insurer outcome is not available from the current status.",
    );
}
