import { chromium } from "playwright";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import net from "node:net";

const socket = net.createServer();
await new Promise((resolve) => socket.listen(0, "127.0.0.1", resolve));
const port = socket.address().port;
await new Promise((resolve) => socket.close(resolve));
const origin = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, ["--import", "tsx", "server/index.ts"], {
  env: {
    ...process.env,
    PORT: String(port),
    APP_ORIGIN: origin,
    HOST: "127.0.0.1",
    APP_MODE: "demo",
    DEMO_MODE: "true",
    BIZTRUST_VITE_CACHE: ".data/vite-startup-smoke",
  },
  stdio: ["ignore", "pipe", "pipe"],
  windowsHide: true,
});
let logs = "";
server.stderr.on("data", (chunk) => {
  logs += chunk.toString();
});
let browser;
try {
  let ready = false;
  for (let attempt = 0; attempt < 80; attempt++) {
    try {
      if ((await fetch(`${origin}/api/health`)).ok) {
        ready = true;
        break;
      }
    } catch {
      /* Starting. */
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  assert.ok(ready, `Development server failed: ${logs}`);
  browser = await chromium.launch({
    headless: true,
    channel:
      process.env.PLAYWRIGHT_CHANNEL ||
      (process.platform === "win32" ? "chrome" : undefined),
  });
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("response", (response) => {
    if (
      ["script", "stylesheet"].includes(response.request().resourceType()) &&
      response.status() >= 400
    )
      errors.push(`${response.status()} ${response.url()}`);
  });
  page.on("requestfailed", (request) => {
    if (["script", "stylesheet"].includes(request.resourceType()))
      errors.push(request.url());
  });
  for (const route of ["/", "/find-cover", "/insurance"]) {
    await page.goto(`${origin}${route}`);
    await page.getByRole("banner").waitFor();
    await page.getByRole("heading", { level: 1 }).waitFor();
  }
  await page.reload();
  await page.getByRole("banner").waitFor();
  assert.deepEqual(errors, []);
  console.log(
    "Development startup passed: three routes and reload, zero failed script/style requests or page errors.",
  );
} finally {
  if (browser) await browser.close();
  server.kill();
}
