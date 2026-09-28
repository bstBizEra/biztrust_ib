import express from "express";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import { randomUUID } from "node:crypto";
import { ZodError } from "zod";
import QRCode from "qrcode";
import metadata from "../package.json" with { type: "json" };
import { acceptVerifiedPayment } from "./payment-inbox.ts";
import { config } from "./config.ts";
import { categories, insurers, products } from "./catalog.ts";
import { pool } from "./db.ts";
import {
  sessionMiddleware,
  csrfMiddleware,
  authenticated,
  newSession,
  beginOidc,
  finishOidc,
} from "./auth.ts";
import { DomainError, verifyEvent, signEvent, insurerInput } from "./domain.ts";
import {
  staffSessionMiddleware,
  staffActor,
  beginStaffOidc,
  finishStaffOidc,
  endStaffSession,
  staffCsrf,
  staffSessionResponse,
  startStaffDemo,
} from "./staff-auth.ts";
import {
  overview,
  cases,
  caseEvidence,
  integrationStatus,
} from "./operations.ts";
import { inspectProducts, previewProduct } from "./operations-products.ts";
import {
  createQuote,
  createApplication,
  listApplications,
  applicationDetail,
  simulatorInsurer,
} from "./services.ts";

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: [
            "'self'",
            ...(process.argv.includes("--production-assets")
              ? []
              : ["'unsafe-inline'"]),
          ],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:"],
          connectSrc: ["'self'", ...(config.demo ? ["ws://127.0.0.1:*"] : [])],
          workerSrc: process.argv.includes("--production-assets")
            ? ["'self'"]
            : ["'self'", "blob:"],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
          upgradeInsecureRequests: null,
        },
      },
      strictTransportSecurity: config.origin.startsWith("https:")
        ? undefined
        : false,
    }),
  );
  app.use((req, res, next) => {
    res.setHeader("X-Request-Id", randomUUID());
    if (
      req.path.startsWith("/api/") ||
      req.path === "/ops" ||
      req.path.startsWith("/ops/")
    )
      res.setHeader("Cache-Control", "no-store");
    next();
  });
  app.use(
    "/api",
    rateLimit({
      windowMs: 60000,
      limit: 180,
      standardHeaders: "draft-8",
      legacyHeaders: false,
    }),
  );
  app.use(
    "/ops",
    rateLimit({
      windowMs: 60000,
      limit: 180,
      standardHeaders: "draft-8",
      legacyHeaders: false,
    }),
    express.json({ limit: "32kb" }),
    cookieParser(),
    staffSessionMiddleware,
  );
  app.get("/ops/auth/login", beginStaffOidc);
  app.get("/ops/auth/callback", finishStaffOidc);
  app.post("/ops/auth/logout", staffCsrf, endStaffSession);
  app.post(
    "/ops/auth/demo",
    rateLimit({
      windowMs: 3600000,
      limit: 10,
      standardHeaders: "draft-8",
      legacyHeaders: false,
    }),
    staffCsrf,
    startStaffDemo,
  );
  app.get("/ops/v1/session", staffSessionResponse);
  app.get("/ops/v1/products", (req, res) =>
    res.json(inspectProducts(staffActor(req), req.query)),
  );
  app.post(
    "/ops/v1/products/:id/preview",
    (req, _res, next) => {
      staffActor(req);
      next();
    },
    staffCsrf,
    (req, res) =>
      res.json(
        previewProduct(staffActor(req), String(req.params.id), req.body),
      ),
  );
  app.get("/ops/v1/overview", async (req, res) =>
    res.json(await overview(staffActor(req))),
  );
  app.get("/ops/v1/cases", async (req, res) =>
    res.json(await cases(staffActor(req), req.query)),
  );
  app.get("/ops/v1/cases/:id", async (req, res) =>
    res.json(await caseEvidence(staffActor(req), String(req.params.id))),
  );
  app.get("/ops/v1/integrations", async (req, res) =>
    res.json(await integrationStatus(staffActor(req))),
  );
  app.get("/api/health", async (_req, res) => {
    await pool.query("SELECT 1");
    res.json({
      status: "ok",
      mode: config.demo ? "demonstration" : "production",
      version: metadata.version,
    });
  });
  app.post(
    "/api/webhooks/payment",
    express.text({ type: "application/json", limit: "32kb" }),
    async (req, res) => {
      const raw = typeof req.body === "string" ? req.body : "";
      verifyEvent(
        raw,
        req.get("x-provider-timestamp") || "",
        req.get("x-provider-signature") || "",
        config.webhookSecret,
      );
      let event: unknown;
      try {
        event = JSON.parse(raw);
      } catch {
        throw new DomainError(
          400,
          "INVALID_JSON",
          "The provider event is not valid JSON.",
        );
      }
      res.json(await acceptVerifiedPayment(event));
    },
  );
  app.use(
    "/api",
    express.json({ limit: "32kb" }),
    cookieParser(),
    sessionMiddleware,
    csrfMiddleware,
  );
  app.get("/api/catalog", (_req, res) =>
    res.json({
      categories,
      insurers,
      products,
      synthetic: true,
      mode: "demonstration",
    }),
  );
  app.get("/api/session", (req, res) =>
    res.json({
      user: req.session.actor
        ? {
            name: req.session.name,
            role: req.session.actor.role,
            mode: req.session.mode,
          }
        : null,
      csrf: req.session.csrf,
      demo: config.demo,
      oidcConfigured: Boolean(
        config.issuer && config.clientId && config.clientSecret,
      ),
    }),
  );
  app.post("/api/auth/demo", async (req, res) => {
    if (!config.demo) throw new DomainError(404, "NOT_FOUND", "Not found.");
    await newSession(req, res, {
      actor: { tenant: "biztrust-demo", user: randomUUID(), role: "customer" },
      name: "Demo explorer",
      mode: "demo",
    });
    res.json({ ok: true, csrf: req.session.csrf });
  });
  app.get("/api/auth/login", beginOidc);
  app.get("/api/auth/callback", finishOidc);
  app.post("/api/auth/logout", async (req, res) => {
    await newSession(req, res);
    res.json({ ok: true, csrf: req.session.csrf });
  });
  app.post("/api/quotes", async (req, res) =>
    res.status(201).json(await createQuote(authenticated(req), req.body)),
  );
  app.post("/api/applications", async (req, res) => {
    const result = await createApplication(
      authenticated(req),
      req.body,
      req.get("idempotency-key") || "",
    );
    res.status(result.duplicate ? 200 : 201).json(result);
  });
  app.get("/api/applications", async (req, res) =>
    res.json(await listApplications(authenticated(req))),
  );
  app.get("/api/applications/:reference", async (req, res) =>
    res.json(
      await applicationDetail(authenticated(req), String(req.params.reference)),
    ),
  );
  app.get("/api/applications/:reference/qr", async (req, res) => {
    const { application, invoice } = await applicationDetail(
      authenticated(req),
      String(req.params.reference),
    );
    if (invoice.status !== "pending")
      throw new DomainError(
        409,
        "INVOICE_NOT_PENDING",
        "This payment instruction is no longer active.",
      );
    const payload = `BIZTRUST-DEMO-NOT-PAYABLE|${invoice.provider_reference}|${application.reference}|${invoice.amount}|${invoice.currency}|${new Date(invoice.expires_at).toISOString()}`;
    res.type("svg").send(
      await QRCode.toString(payload, {
        type: "svg",
        width: 220,
        margin: 2,
        color: { dark: "#174e43", light: "#ffffff" },
      }),
    );
  });
  app.get("/api/applications/:reference/document", async (req, res) => {
    const { application } = await applicationDetail(
      authenticated(req),
      String(req.params.reference),
    );
    if (
      application.insurer_status !== "issued" ||
      !application.evidence?.synthetic
    )
      throw new DomainError(
        404,
        "DOCUMENT_UNAVAILABLE",
        "A policy document is not available.",
      );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${application.reference}-DEMONSTRATION.txt"`,
    );
    res
      .type("text/plain")
      .send(
        `BIZTRUST — DEMONSTRATION RECORD\nNOT AN INSURANCE POLICY. NO COVERAGE.\n\nApplication: ${application.reference}\nSynthetic policy reference: ${application.evidence.reference}\nProduct: ${application.product_snapshot.name}\nSource: local insurer simulator\nEvidence received: ${application.evidence.receivedAt}\n\nThis file exercises authorized document retrieval only. It has no legal or insurance effect.\n`,
      );
  });
  app.post("/api/demo/applications/:reference/payment", async (req, res) => {
    if (!config.demo) throw new DomainError(404, "NOT_FOUND", "Not found.");
    const actor = authenticated(req);
    const { invoice } = await applicationDetail(
      actor,
      String(req.params.reference),
    );
    const event = {
      eventId: `sim-${randomUUID()}`,
      tenant: actor.tenant,
      owner: actor.user,
      invoiceId: invoice.id,
      providerReference: invoice.provider_reference,
      amount: Number(invoice.amount),
      currency: "LAK",
      status: "settled",
    };
    const raw = JSON.stringify(event);
    const timestamp = String(Date.now());
    verifyEvent(
      raw,
      timestamp,
      signEvent(raw, timestamp, config.webhookSecret),
      config.webhookSecret,
    );
    res.json(await acceptVerifiedPayment(event));
  });
  app.post("/api/demo/applications/:reference/insurer", async (req, res) => {
    if (!config.demo) throw new DomainError(404, "NOT_FOUND", "Not found.");
    res.json(
      await simulatorInsurer(
        authenticated(req),
        String(req.params.reference),
        insurerInput.parse(req.body).outcome,
      ),
    );
  });
  app.use("/api", (_req, _res, next) =>
    next(new DomainError(404, "NOT_FOUND", "This endpoint does not exist.")),
  );
  app.use(["/ops/v1", "/ops/auth"], (_req, _res, next) =>
    next(new DomainError(404, "NOT_FOUND", "This endpoint does not exist.")),
  );
  app.use(
    (
      error: unknown,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      const requestId = res.getHeader("X-Request-Id");
      if (
        error &&
        typeof error === "object" &&
        "type" in error &&
        error.type === "entity.parse.failed"
      )
        return res.status(400).json({
          error: {
            code: "INVALID_JSON",
            message: "The request body must be valid JSON.",
            requestId,
          },
        });
      if (error instanceof ZodError)
        return res.status(400).json({
          error: {
            code: "VALIDATION_ERROR",
            message: "Please check the information you entered.",
            fields: error.issues.map((i) => ({
              field: i.path.join("."),
              message: i.message,
            })),
            requestId,
          },
        });
      if (error instanceof DomainError)
        return res.status(error.status).json({
          error: { code: error.code, message: error.message, requestId },
        });
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === "23505"
      )
        return res.status(409).json({
          error: {
            code: "DUPLICATE_RECORD",
            message:
              "This request has already been processed. Check My applications.",
            requestId,
          },
        });
      console.error(
        JSON.stringify({
          level: "error",
          requestId,
          type: error instanceof Error ? error.name : "unknown",
        }),
      );
      res.status(500).json({
        error: {
          code: "INTERNAL_ERROR",
          message:
            "Something went wrong. Please try again or keep the support reference.",
          requestId,
        },
      });
    },
  );
  return app;
}
