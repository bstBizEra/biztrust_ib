import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import type { Server } from "node:http";
import { createApp } from "../server/app.ts";
import { pool, assertRuntimeRole } from "../server/db.ts";
import { config } from "../server/config.ts";
import { hash } from "../server/domain.ts";

let server: Server | undefined;
let origin: string;
const sessionHashes = new Set<string>();

before(async () => {
  assert.equal(config.demo, true, "Customer session tests require demo mode");
  await assertRuntimeRole();
  server = createApp().listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server!.once("listening", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  origin = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  try {
    if (server)
      await new Promise<void>((resolve, reject) =>
        server!.close((error) => (error ? reject(error) : resolve())),
      );
    if (sessionHashes.size)
      await pool.query(
        "DELETE FROM auth_sessions WHERE token_hash=ANY($1::text[])",
        [[...sessionHashes]],
      );
  } finally {
    await pool.end();
  }
});

async function request(route: string, options?: RequestInit) {
  const response = await fetch(`${origin}${route}`, options);
  for (const value of response.headers.getSetCookie()) {
    const cookie = value.split(";")[0];
    if (cookie.startsWith("bt_session="))
      sessionHashes.add(hash(cookie.slice(11)));
  }
  return response;
}

function cookieFrom(response: Response) {
  const cookie = response.headers
    .getSetCookie()
    .find((value) => value.startsWith("bt_session="))
    ?.split(";")[0];
  assert.ok(cookie, "Customer session cookie must be set");
  return cookie;
}

async function openCustomer() {
  const anonymous = await request("/api/session");
  assert.equal(anonymous.status, 200);
  const initial = await anonymous.json();
  assert.equal(initial.user, null);
  const login = await request("/api/auth/demo", {
    method: "POST",
    headers: {
      Cookie: cookieFrom(anonymous),
      Origin: config.origin,
      "X-CSRF-Token": initial.csrf,
    },
  });
  assert.equal(login.status, 200);
  const cookie = cookieFrom(login);
  const { csrf } = await login.json();
  const session = await request("/api/session", {
    headers: { Cookie: cookie },
  });
  assert.equal(session.status, 200);
  assert.equal((await session.json()).user.role, "customer");
  const protectedRead = await request("/api/applications", {
    headers: { Cookie: cookie },
  });
  assert.equal(protectedRead.status, 200);
  assert.ok(Array.isArray(await protectedRead.json()));
  return { cookie, csrf: csrf as string, tokenHash: hash(cookie.slice(11)) };
}

async function expectAnonymous(cookie: string) {
  const denied = await request("/api/applications", {
    headers: { Cookie: cookie },
  });
  assert.equal(denied.status, 401);
  assert.equal((await denied.json()).error.code, "SIGN_IN_REQUIRED");
  const session = await request("/api/session", {
    headers: { Cookie: cookie },
  });
  assert.equal(session.status, 200);
  assert.equal((await session.json()).user, null);
}

test("expired customer cookie loses protected access and reports an anonymous session", async () => {
  const customer = await openCustomer();
  // Runtime cannot UPDATE sessions: preserve the exact token/data with a past DB expiry.
  const expired = await pool.query(
    `WITH previous AS (
       DELETE FROM auth_sessions WHERE token_hash=$1 RETURNING token_hash,data
     ) INSERT INTO auth_sessions(token_hash,data,expires_at)
       SELECT token_hash,data,now()-interval '1 second' FROM previous
       RETURNING expires_at<=now() AS expired`,
    [customer.tokenHash],
  );
  assert.equal(expired.rowCount, 1);
  assert.equal(expired.rows[0].expired, true);
  await expectAnonymous(customer.cookie);
});

test("customer logout deletes the old token and rotates to an anonymous session that cannot be replayed as signed in", async () => {
  const customer = await openCustomer();
  const logout = await request("/api/auth/logout", {
    method: "POST",
    headers: {
      Cookie: customer.cookie,
      Origin: config.origin,
      "X-CSRF-Token": customer.csrf,
    },
  });
  assert.equal(logout.status, 200);
  const body = await logout.json();
  assert.equal(body.ok, true);
  const rotated = cookieFrom(logout);
  assert.ok(
    rotated !== customer.cookie,
    "Logout must rotate the customer token",
  );
  assert.ok(body.csrf !== customer.csrf, "Logout must rotate the CSRF token");
  const old = await pool.query(
    "SELECT token_hash FROM auth_sessions WHERE token_hash=$1",
    [customer.tokenHash],
  );
  assert.equal(old.rowCount, 0);
  const replacement = await pool.query(
    "SELECT data FROM auth_sessions WHERE token_hash=$1 AND expires_at>now()",
    [hash(rotated.slice(11))],
  );
  assert.equal(replacement.rowCount, 1);
  assert.equal(replacement.rows[0].data.actor, undefined);
  await expectAnonymous(customer.cookie);
  await expectAnonymous(rotated);
});
