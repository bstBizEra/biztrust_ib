import "dotenv/config";
import pg from "pg";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
const client = new pg.Client({
  connectionString: process.env.DATABASE_ADMIN_URL,
});
if (!process.env.DATABASE_ADMIN_URL)
  throw new Error("DATABASE_ADMIN_URL is required for migrations only.");
await client.connect();
try {
  // Session lock serializes migration runners without changing runtime privileges.
  await client.query(
    "SELECT pg_advisory_lock(hashtextextended('biztrust:schema-migrations',0))",
  );
  await client.query(
    "CREATE TABLE IF NOT EXISTS schema_migrations (version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())",
  );
  const directory = fileURLToPath(
    new URL("../server/migrations/", import.meta.url),
  );
  const files = readdirSync(directory)
    .filter((file) => /^\d+-[a-z0-9-]+\.sql$/.test(file))
    .sort((a, b) => Number(a.split("-")[0]) - Number(b.split("-")[0]));
  const applied = new Set(
    (await client.query("SELECT version FROM schema_migrations")).rows.map(
      (row: { version: string }) => row.version,
    ),
  );
  const versions = new Set<string>();
  for (const file of files) {
    const version = file.split("-")[0];
    if (versions.has(version))
      throw new Error(`Duplicate migration ${version}.`);
    versions.add(version);
    if (applied.has(version)) continue;
    // Each numbered SQL file owns its transaction and records its version atomically.
    await client.query(
      readFileSync(
        new URL(`../server/migrations/${file}`, import.meta.url),
        "utf8",
      ),
    );
    const recorded = await client.query(
      "SELECT version FROM schema_migrations WHERE version=$1",
      [version],
    );
    if (recorded.rowCount !== 1)
      throw new Error(`Migration ${version} did not record completion.`);
    console.log(`Migration ${version} applied.`);
  }
  console.log("Database migrations are current.");
} finally {
  await client.end();
}
