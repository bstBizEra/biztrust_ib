import { randomUUID } from "node:crypto";
import type { Actor } from "./db.ts";
import { config, localDemoAvailable } from "./config.ts";
import { DomainError, signEvent, verifyEvent } from "./domain.ts";
import {
  createQuote,
  createApplication,
  applicationDetail,
  simulatorInsurer,
} from "./services.ts";
import { acceptVerifiedPayment } from "./payment-inbox.ts";

/** Only synthetic records in a fresh tenant; exercises the authoritative services. */
export async function seedOperationsDemo(): Promise<Actor> {
  if (!localDemoAvailable())
    throw new DomainError(404, "NOT_FOUND", "Not found.");
  const tenant = `ops-demo-${randomUUID()}`;
  const scenarios = [
    "pending",
    "queued",
    "referred",
    "mismatch",
    "timeout",
  ] as const;
  for (const [index, scenario] of scenarios.entries()) {
    const customer: Actor = { tenant, user: randomUUID(), role: "customer" };
    const quote = await createQuote(customer, {
      productId: index % 2 === 0 ? "travel-essential" : "motor-essential",
      age: 30,
      days: 7,
    });
    const application = await createApplication(
      customer,
      {
        quoteId: quote.id,
        fullName: "Synthetic Operations Example",
        email: "operations-example@example.test",
        consent: true,
        disclosure: true,
      },
      randomUUID(),
    );
    if (scenario === "pending") continue;
    const { invoice } = await applicationDetail(
      customer,
      application.reference,
    );
    const event = {
      eventId: `ops-demo-${randomUUID()}`,
      tenant,
      owner: customer.user,
      invoiceId: invoice.id,
      providerReference: invoice.provider_reference,
      amount: Number(invoice.amount) + (scenario === "mismatch" ? 1 : 0),
      currency: "LAK" as const,
      status: "settled" as const,
    };
    const raw = JSON.stringify(event);
    const timestamp = String(Date.now());
    verifyEvent(
      raw,
      timestamp,
      signEvent(raw, timestamp, config.webhookSecret),
      config.webhookSecret,
    );
    await acceptVerifiedPayment(event);
    if (scenario === "referred" || scenario === "timeout")
      await simulatorInsurer(customer, application.reference, scenario);
  }
  return { tenant, user: randomUUID(), role: "operations" };
}
