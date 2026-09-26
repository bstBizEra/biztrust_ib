import pg from "pg";
import { config } from "./config.ts";

export const pool = new pg.Pool({
  connectionString: config.databaseUrl,
  max: 8,
});
export interface Actor {
  tenant: string;
  user: string;
  role: "customer" | "operations";
}
export async function transaction<T>(
  actor: Actor,
  work: (db: pg.PoolClient) => Promise<T>,
) {
  const db = await pool.connect();
  try {
    await db.query("BEGIN");
    await db.query(
      "SELECT set_config('app.tenant', $1, true), set_config('app.user', $2, true), set_config('app.role', $3, true)",
      [actor.tenant, actor.user, actor.role],
    );
    const result = await work(db);
    await db.query("COMMIT");
    return result;
  } catch (error) {
    await db.query("ROLLBACK");
    throw error;
  } finally {
    db.release();
  }
}
export async function assertRuntimeRole() {
  const { rows } = await pool.query(
    "SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user",
  );
  if (rows[0]?.rolsuper || rows[0]?.rolbypassrls)
    throw new Error("Runtime database role must not bypass row security.");
}
export async function audit(
  db: pg.PoolClient,
  actor: Actor,
  action: string,
  resource: string,
  detail: object = {},
) {
  await db.query(
    "INSERT INTO audit_events (tenant_id, owner_id, action, resource_id, detail) VALUES ($1,$2,$3,$4,$5)",
    [actor.tenant, actor.user, action, resource, JSON.stringify(detail)],
  );
}
