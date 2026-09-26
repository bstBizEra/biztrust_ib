import { createServer } from "node:http";
import path from "node:path";
import express from "express";
import { config, validateConfig } from "./config.ts";
import { createApp } from "./app.ts";
import { assertRuntimeRole, pool } from "./db.ts";

validateConfig();
await assertRuntimeRole();
const app = createApp();
const server = createServer(app);
if (process.argv.includes("--production-assets")) {
  app.use(express.static(path.resolve("dist")));
  app.get("/{*path}", (_req, res) =>
    res.sendFile(path.resolve("dist/index.html"), { dotfiles: "allow" }),
  );
} else {
  const { createServer: createViteServer } = await import("vite");
  const vite = await createViteServer({
    server: { middlewareMode: true, ws: { server } },
    appType: "spa",
  });
  app.use(vite.middlewares);
}
server.listen(config.port, config.host, () =>
  console.log(`BizTrust local demonstration: ${config.origin}`),
);
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.on(signal, () =>
    server.close(() => {
      void pool.end().then(() => process.exit(0));
    }),
  );
