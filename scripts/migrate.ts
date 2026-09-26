import "dotenv/config";
import pg from "pg";
import { readFileSync } from "node:fs";
const client = new pg.Client({
  connectionString: process.env.DATABASE_ADMIN_URL,
});
if (!process.env.DATABASE_ADMIN_URL)
  throw new Error("DATABASE_ADMIN_URL is required for migrations only.");
await client.connect();
try {
  await client.query(
    readFileSync("server/migrations/001-foundation.sql", "utf8"),
  );
  console.log(
    "Migration 001 applied; forced RLS and append-only audit installed.",
  );
} finally {
  await client.end();
}
