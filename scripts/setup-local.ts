import { mkdirSync, existsSync, writeFileSync, readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { execFileSync } from "node:child_process";
import { parse } from "dotenv";
import pg from "pg";

if (process.platform !== "win32")
  throw new Error(
    "Use an isolated PostgreSQL service and .env on non-Windows systems. See README.",
  );
mkdirSync(".data", { recursive: true });
if (!existsSync(".env")) {
  const admin = randomBytes(32).toString("hex");
  const app = randomBytes(32).toString("hex");
  writeFileSync(".data/bootstrap-password", admin, { mode: 0o600 });
  writeFileSync(
    ".env",
    `APP_ORIGIN=http://127.0.0.1:3000\nPORT=3000\nHOST=127.0.0.1\nDEMO_MODE=true\nDATABASE_URL=postgresql://biztrust_app:${app}@127.0.0.1:15432/biztrust_dev\nDATABASE_ADMIN_URL=postgresql://postgres:${admin}@127.0.0.1:15432/biztrust_dev\nWEBHOOK_SECRET=${randomBytes(48).toString("hex")}\nCUSTOMER_TENANT=biztrust\n`,
    { mode: 0o600 },
  );
}
const env = parse(readFileSync(".env"));
const adminUrl = new URL(env.DATABASE_ADMIN_URL);
if (
  adminUrl.hostname !== "127.0.0.1" ||
  adminUrl.port !== "15432" ||
  adminUrl.pathname !== "/biztrust_dev"
)
  throw new Error(
    "db:local only manages its own loopback development cluster.",
  );
if (!existsSync(".data/bootstrap-password"))
  writeFileSync(
    ".data/bootstrap-password",
    decodeURIComponent(adminUrl.password),
    { mode: 0o600 },
  );
execFileSync(
  "powershell.exe",
  ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "scripts/local-db.ps1"],
  { stdio: "inherit", windowsHide: true },
);
adminUrl.pathname = "/postgres";
const client = new pg.Client({ connectionString: adminUrl.href });
await client.connect();
if (
  !(
    await client.query("SELECT 1 FROM pg_database WHERE datname='biztrust_dev'")
  ).rowCount
)
  await client.query("CREATE DATABASE biztrust_dev");
const password = decodeURIComponent(new URL(env.DATABASE_URL).password);
if (!/^[a-f0-9]{64}$/.test(password))
  throw new Error("Unexpected generated development password format.");
if (
  !(await client.query("SELECT 1 FROM pg_roles WHERE rolname='biztrust_app'"))
    .rowCount
)
  await client.query(
    `CREATE ROLE biztrust_app LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE PASSWORD '${password}'`,
  );
await client.end();
console.log(
  "Isolated database and least-privilege role ready. Run npm run db:migrate.",
);
