import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import net from "node:net";

await mkdir("output/playwright", { recursive: true });
const socket = net.createServer();
await new Promise((r) => socket.listen(0, "127.0.0.1", r));
const port = socket.address().port;
await new Promise((r) => socket.close(r));
const origin = `http://127.0.0.1:${port}`;
const server = spawn(
  process.execPath,
  ["--import", "tsx", "server/index.ts", "--production-assets"],
  {
    env: {
      ...process.env,
      PORT: String(port),
      APP_ORIGIN: origin,
      HOST: "127.0.0.1",
      DEMO_MODE: "true",
    },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  },
);
let serverFailure = "";
server.stderr.on("data", (chunk) => {
  serverFailure += chunk.toString();
});
let browser;
const report = { pages: [], journeys: [], consoleErrors: [], assetErrors: [] };
try {
  let ready = false;
  for (let i = 0; i < 80; i++) {
    try {
      const r = await fetch(`${origin}/api/health`);
      if (r.ok) {
        ready = true;
        break;
      }
    } catch {
      /* The isolated web server may still be starting. */
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  assert.ok(ready, `Preview server did not start: ${serverFailure}`);
  browser = await chromium.launch({
    headless: true,
    channel:
      process.env.PLAYWRIGHT_CHANNEL ||
      (process.platform === "win32" ? "chrome" : undefined),
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => report.consoleErrors.push(e.message));
  page.on("response", (response) => {
    if (
      ["script", "stylesheet"].includes(response.request().resourceType()) &&
      response.status() >= 400
    )
      report.assetErrors.push(`${response.status()} ${response.url()}`);
  });
  page.on("requestfailed", (request) => {
    if (["script", "stylesheet"].includes(request.resourceType()))
      report.assetErrors.push(
        `${request.failure()?.errorText} ${request.url()}`,
      );
  });
  async function visit(path) {
    await page.goto(`${origin}${path}`);
    await page.getByRole("banner").waitFor();
    await page.locator("main .skeleton").first().waitFor({ state: "hidden" });
  }
  async function accessibility(label) {
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    const violations = results.violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      description: v.description,
      nodes: v.nodes.map((n) => ({
        target: n.target,
        summary: n.failureSummary,
      })),
    }));
    report.pages.push({ label, violations });
    await writeFile(
      "output/playwright/accessibility.json",
      JSON.stringify(report, null, 2),
    );
  }
  async function noOverflow() {
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
      `Horizontal overflow at ${page.url()}`,
    );
  }
  await visit("/");
  await page
    .getByRole("heading", { name: "Life moves forward. Move with confidence." })
    .waitFor();
  await accessibility("home-desktop");
  await noOverflow();
  await page.screenshot({
    path: "output/playwright/home-desktop.png",
    fullPage: true,
  });
  // Native modal keyboard escape and focus containment.
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByRole("dialog").waitFor();
  await accessibility("sign-in-dialog");
  await page.keyboard.press("Tab");
  assert.ok(
    await page.evaluate(() =>
      document.querySelector("dialog")?.contains(document.activeElement),
    ),
  );
  await page.keyboard.press("Escape");
  assert.equal(await page.getByRole("dialog").count(), 0);
  await page
    .getByRole("link", { name: "Find your cover", exact: true })
    .first()
    .click();
  await page
    .getByRole("heading", { name: "What would you like to protect?" })
    .waitFor();
  assert.equal(await page.locator(".finder-category").count(), 12);
  await accessibility("cover-finder-categories");
  await page.getByRole("button", { name: "My business", exact: true }).click();
  assert.equal(await page.locator(".finder-category").count(), 6);
  await page
    .getByRole("button", { name: "Me & my family", exact: true })
    .click();
  assert.equal(await page.locator(".finder-category").count(), 6);
  await page.getByRole("button", { name: /^Health Put your/ }).click();
  await page
    .getByRole("heading", { name: "Health cover, side by side." })
    .waitFor();
  await page.reload();
  await page
    .getByRole("heading", { name: "Health cover, side by side." })
    .waitFor();
  const healthEssential = page.getByRole("article").filter({
    has: page.getByRole("heading", { name: "Health Essential", exact: true }),
  });
  const essentialPremium = healthEssential.locator(
    ".finder-offer-price > strong",
  );
  assert.equal(await essentialPremium.textContent(), "₭3,600,000");
  await page
    .getByRole("checkbox", { name: "Compare Health Essential" })
    .check();
  const coverageSlider = page.getByRole("slider", {
    name: "Coverage amount",
    exact: true,
  });
  await coverageSlider.focus();
  await coverageSlider.press("ArrowRight");
  await coverageSlider.press("ArrowRight");
  assert.equal(await essentialPremium.textContent(), "₭5,400,000");
  await page
    .getByRole("checkbox", { name: "Outpatient consultations", exact: true })
    .check();
  await page.reload();
  await page
    .getByRole("heading", { name: "Health cover, side by side." })
    .waitFor();
  assert.equal(
    await page
      .getByRole("slider", { name: "Coverage amount", exact: true })
      .inputValue(),
    "225000000",
  );
  assert.ok(
    await page
      .getByRole("checkbox", { name: "Outpatient consultations", exact: true })
      .isChecked(),
  );
  assert.equal(await essentialPremium.textContent(), "₭5,832,000");
  await page
    .getByRole("checkbox", { name: "Outpatient consultations", exact: true })
    .uncheck();
  assert.equal(await essentialPremium.textContent(), "₭5,400,000");
  await page
    .getByRole("checkbox", { name: "Outpatient consultations", exact: true })
    .check();
  await visit("/compare");
  await page.getByRole("table").waitFor();
  await page
    .getByRole("cell", { name: "₭5,832,000 / year", exact: true })
    .waitFor();
  await page
    .getByRole("cell", {
      name: "Annual medical limit: ₭225,000,000",
      exact: true,
    })
    .waitFor();
  await page.getByRole("button", { name: "View plan", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByText("Outpatient consultations", { exact: true })
    .waitFor();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Remove Health Essential" }).click();
  await visit("/find-cover?category=health");
  await page
    .getByRole("heading", { name: "Health cover, side by side." })
    .waitFor();
  report.journeys.push(
    "Coverage slider and optional benefit update prices immediately, removing a benefit reverses its price, and comparison/review retain the configured amount and premium",
  );
  await page
    .getByRole("checkbox", {
      name: "Extended assistance and higher sublimits",
      exact: true,
    })
    .check();
  assert.equal(await page.locator(".finder-match.missing").count(), 1);
  await page
    .getByRole("checkbox", { name: "Matching plans only", exact: true })
    .check();
  assert.equal(await page.getByRole("article").count(), 1);
  await page
    .getByRole("heading", { name: "Health Plus", exact: true })
    .waitFor();
  await page
    .getByRole("checkbox", { name: "Standard assistance service", exact: true })
    .check();
  await page
    .getByRole("heading", {
      name: "No sample plan includes every selected feature.",
    })
    .waitFor();
  await page
    .getByRole("button", { name: "Show all plans", exact: true })
    .click();
  assert.equal(await page.getByRole("article").count(), 2);
  await page.getByRole("button", { name: "Reset needs", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Sort matching plans" })
    .selectOption("price-high");
  assert.equal(
    await page.getByRole("article").first().getByRole("heading").textContent(),
    "Health Plus",
  );
  await page
    .getByRole("article")
    .first()
    .getByRole("button", { name: "Review plan" })
    .click();
  await page.getByRole("dialog").waitFor();
  await page.keyboard.press("Escape");
  await accessibility("cover-finder-offers");
  await page.screenshot({
    path: "output/playwright/cover-finder-desktop.png",
    fullPage: true,
  });
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await noOverflow();
    await accessibility(`cover-finder-offers-${width}`);
    await page.screenshot({
      path: `output/playwright/cover-finder-mobile-${width}.png`,
      fullPage: true,
    });
    await visit("/find-cover");
    await page
      .getByRole("heading", { name: "What would you like to protect?" })
      .waitFor();
    await noOverflow();
    await accessibility(`cover-finder-categories-${width}`);
    await visit("/find-cover?category=health");
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  report.journeys.push(
    "Guided cover finder: 12 categories, audience filters, shareable category, coverage matching, transparent missing features, empty-state recovery, sorting and plan review on desktop/390px/320px",
  );
  await visit("/insurance?category=travel");
  assert.equal(await page.getByRole("article").count(), 2);
  await page
    .getByRole("checkbox", { name: "Compare Travel Essential" })
    .check();
  await page.getByRole("checkbox", { name: "Compare Travel Plus" }).check();
  await page
    .getByRole("link", { name: "Compare plans", exact: true })
    .last()
    .click();
  await page.getByRole("table").waitFor();
  assert.equal(await page.locator("thead th").count(), 3);
  await accessibility("comparison-desktop");
  await page.screenshot({
    path: "output/playwright/comparison-desktop.png",
    fullPage: true,
  });
  await visit("/insurance?category=travel");
  await page
    .getByRole("textbox", { name: "Search plans or coverage" })
    .fill("not-a-real-plan");
  await page
    .getByRole("heading", { name: "No plans match these filters." })
    .waitFor();
  await page.getByRole("button", { name: "Clear filters" }).click();
  assert.equal(await page.getByRole("article").count(), 24);
  report.journeys.push(
    "Category, search, empty-state reset and persistent comparison",
  );
  await page.getByRole("button", { name: "Travel 2", exact: true }).click();
  await page
    .getByRole("article")
    .filter({
      has: page.getByRole("heading", { name: "Travel Essential", exact: true }),
    })
    .getByRole("button", { name: "View plan" })
    .click();
  await page.getByRole("button", { name: "Start a demo quote" }).click();
  await page.getByRole("spinbutton", { name: "Your age" }).fill("17");
  await page.getByRole("button", { name: "Calculate demo quote" }).click();
  assert.equal(
    await page
      .getByRole("spinbutton", { name: "Your age" })
      .evaluate((el) => el.validity.rangeUnderflow),
    true,
  );
  await page.getByRole("spinbutton", { name: "Your age" }).fill("30");
  await page
    .getByRole("spinbutton", { name: "Trip duration (days)" })
    .fill("7");
  const quoteSlider = page.getByRole("slider", {
    name: "Coverage amount",
    exact: true,
  });
  await quoteSlider.press("ArrowRight");
  await quoteSlider.press("ArrowRight");
  await page
    .getByRole("checkbox", { name: "Baggage benefit", exact: true })
    .check();
  assert.ok(
    (await page.locator(".flex-quote-estimate").innerText()).includes(
      "₭272,160",
    ),
  );
  await accessibility("flex-quote-form");
  await page.getByRole("button", { name: "Calculate demo quote" }).click();
  await page
    .getByRole("heading", { name: "Review your application" })
    .waitFor();
  await accessibility("application-review");
  await page
    .getByRole("dialog")
    .getByText("₭272,160", { exact: true })
    .first()
    .waitFor();
  await page
    .getByRole("dialog")
    .getByText("Baggage benefit", { exact: true })
    .waitFor();
  await page
    .getByRole("textbox", { name: "Full name", exact: true })
    .fill("Browser Demo");
  await page
    .getByRole("textbox", { name: "Email address", exact: true })
    .fill("browser@example.test");
  await page.getByRole("checkbox", { name: /I agree to store/ }).check();
  await page
    .getByRole("checkbox", { name: /I understand this is a demonstration/ })
    .check();
  await page.getByRole("button", { name: "Submit demo application" }).click();
  await page.waitForURL(/\/applications\/BT-/);
  await page.getByRole("heading", { name: "Your progress" }).waitFor();
  await page
    .getByRole("img", {
      name: "Non-payable demonstration QR code linked to this application",
    })
    .waitFor();
  const reference = page.url().split("/").at(-1);
  await accessibility("application-tracking-pending");
  await page.reload();
  await page.getByRole("heading", { name: "Your progress" }).waitFor();
  assert.ok(page.url().includes(reference));
  await page
    .locator(".selected-cover-summary")
    .getByText("Emergency medical limit: ₭450,000,000", { exact: true })
    .waitFor();
  await page
    .locator(".selected-cover-summary")
    .getByText("Baggage benefit", { exact: true })
    .waitFor();
  await page
    .locator(".summary-total")
    .getByText("₭272,160", { exact: true })
    .waitFor();
  await page.getByRole("button", { name: "Simulate verified payment" }).click();
  await page
    .getByRole("combobox", { name: "Simulated insurer outcome" })
    .waitFor();
  await page
    .getByRole("combobox", { name: "Simulated insurer outcome" })
    .selectOption("timeout");
  await page.getByRole("button", { name: "Simulate insurer update" }).click();
  await page.getByText("Response delayed", { exact: true }).first().waitFor();
  await page
    .getByRole("combobox", { name: "Simulated insurer outcome" })
    .selectOption("issued");
  await page.getByRole("button", { name: "Simulate insurer update" }).click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("link", { name: "Download demo record" }).click();
  const download = await downloadPromise;
  assert.ok(download.suggestedFilename().endsWith("-DEMONSTRATION.txt"));
  await accessibility("application-tracking-issued");
  await page.screenshot({
    path: "output/playwright/application-desktop.png",
    fullPage: true,
  });
  report.journeys.push(
    "Validation → deterministic quote → application → reload persistence → QR → verified simulator payment → insurer timeout → evidenced demo document download",
  );
  await visit("/applications");
  await page.getByRole("link").filter({ hasText: reference }).waitFor();
  await accessibility("applications-list");
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await visit("/");
    await noOverflow();
    await accessibility(`home-${width}`);
    await page.screenshot({
      path: `output/playwright/home-mobile-${width}.png`,
      fullPage: true,
    });
    await page.getByRole("button", { name: "Toggle navigation" }).click();
    await page
      .getByRole("navigation")
      .getByRole("link", { name: "Explore insurance" })
      .click();
    await page.getByRole("button", { name: "Filters", exact: true }).click();
    await page.getByRole("button", { name: "Health 2", exact: true }).click();
    assert.equal(await page.getByRole("article").count(), 2);
    await noOverflow();
    await accessibility(`catalogue-${width}`);
    await page.screenshot({
      path: `output/playwright/catalogue-mobile-${width}.png`,
      fullPage: true,
    });
  }
  await visit("/compare");
  await noOverflow();
  await accessibility("comparison-mobile");
  await page.screenshot({
    path: "output/playwright/comparison-mobile.png",
    fullPage: true,
  });
  await visit("/");
  await page.getByRole("button", { name: "EN", exact: true }).click();
  assert.equal(await page.locator("html").getAttribute("lang"), "lo");
  await noOverflow();
  await page.screenshot({
    path: "output/playwright/home-lao-mobile.png",
    fullPage: true,
  });
  report.journeys.push(
    "390px / 320px layouts, responsive navigation, mobile filters, comparison scrolling and Lao navigation",
  );
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`${origin}/ops`);
  await page
    .getByRole("button", { name: "Open isolated staff demo" })
    .waitFor();
  await accessibility("operations-sign-in");
  await page.getByRole("button", { name: "Open isolated staff demo" }).click();
  await page.getByRole("heading", { name: "Recent cases" }).waitFor();
  await page.locator(".ops-table tbody tr").first().waitFor();
  assert.equal(await page.locator(".ops-table tbody tr").count(), 5);
  await accessibility("operations-overview");
  await page.screenshot({
    path: "output/playwright/operations-overview.png",
    fullPage: true,
  });
  const opsReference = await page.locator(".ops-case-link").first().innerText();
  await page.locator(".ops-case-link").first().click();
  await page
    .getByRole("dialog")
    .getByRole("heading", { name: opsReference })
    .waitFor();
  await accessibility("operations-case-evidence");
  await page.getByRole("button", { name: "Close case evidence" }).click();
  await page.getByRole("button", { name: "Cases", exact: true }).click();
  await page.getByLabel("Exact case reference").fill(opsReference);
  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes("/ops/v1/cases?") && response.status() === 200,
    ),
    page.getByRole("button", { name: "Apply filters" }).click(),
  ]);
  await page.getByText("1 shown · up to 50", { exact: true }).waitFor();
  assert.equal(await page.locator(".ops-table tbody tr").count(), 1);
  await page.getByRole("button", { name: "Payments", exact: true }).click();
  await page
    .getByLabel("Payment status")
    .selectOption("reconciliation_required");
  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes("payment=reconciliation_required") &&
        response.status() === 200,
    ),
    page.getByRole("button", { name: "Apply filters" }).click(),
  ]);
  await page.getByText("1 shown · up to 50", { exact: true }).waitFor();
  assert.equal(await page.locator(".ops-table tbody tr").count(), 1);
  await accessibility("operations-payment-review");
  await page.getByRole("button", { name: "Integrations", exact: true }).click();
  await page.getByRole("heading", { name: "Delivery exceptions" }).waitFor();
  await accessibility("operations-integrations");
  await page
    .getByRole("button", { name: "System health", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Access & service responses" })
    .waitFor();
  await accessibility("operations-system-health");
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await page.getByRole("button", { name: "Cases", exact: true }).click();
    await page.locator(".ops-table tbody tr").first().waitFor();
    await noOverflow();
    await accessibility(`operations-cases-${width}`);
    await page.screenshot({
      path: `output/playwright/operations-mobile-${width}.png`,
      fullPage: true,
    });
  }
  await page.getByRole("button", { name: "Sign out of staff console" }).click();
  await page
    .getByRole("button", { name: "Open isolated staff demo" })
    .waitFor();
  report.journeys.push(
    "Separate staff console sign-in, isolated demo, filtered cases/payments, evidence, integration and inbox health, mobile layouts and logout",
  );
  assert.equal(
    report.pages.flatMap((p) => p.violations).length,
    0,
    JSON.stringify(report.pages.filter((p) => p.violations.length)),
  );
  assert.deepEqual(report.consoleErrors, []);
  assert.deepEqual(report.assetErrors, []);
  // Test the failure that React's error boundary cannot catch: an unavailable module.
  const recovery = await context.newPage();
  await recovery.route("**/assets/main-*.js", (route) => route.abort());
  await recovery.goto(origin);
  await recovery
    .getByRole("heading", { name: "Let’s try that again." })
    .waitFor();
  await recovery.getByRole("link", { name: "Reload BizTrust" }).waitFor();
  await recovery.unroute("**/assets/main-*.js");
  await recovery.getByRole("link", { name: "Reload BizTrust" }).click();
  await recovery.getByRole("banner").waitFor();
  await recovery.close();
  const noScript = await browser.newContext({ javaScriptEnabled: false });
  const fallback = await noScript.newPage();
  await fallback.goto(origin);
  await fallback.getByRole("link", { name: "Reload BizTrust" }).waitFor();
  await fallback.locator("noscript p").waitFor();
  assert.match(
    await fallback.locator("noscript p").innerText(),
    /Enable JavaScript/,
  );
  await noScript.close();
  report.journeys.push(
    "Module-load failure displays recovery screen, reload restores application, and disabled JavaScript keeps a visible explanation",
  );
  await writeFile(
    "output/playwright/results.json",
    JSON.stringify(report, null, 2),
  );
  console.log(
    `Browser verification passed: ${report.pages.length} accessibility checks, ${report.journeys.length} journeys, no page errors.`,
  );
} finally {
  if (browser) await browser.close();
  server.kill();
}
