import { randomBytes } from "node:crypto";
import type { Request, Response, NextFunction } from "express";
import * as oidc from "openid-client";
import { pool, type Actor } from "./db.ts";
import { config } from "./config.ts";
import { DomainError, hash } from "./domain.ts";

interface StaffSession {
  audience: "operations";
  actor?: Actor;
  csrf: string;
  flow?: { verifier: string; state: string; nonce: string; created: number };
}
declare module "express-serve-static-core" {
  interface Request {
    staffSession?: StaffSession;
    staffSessionHash?: string;
  }
}
const cookieName = "bt_ops_session";
const callback = `${config.origin}/ops/auth/callback`;
let configuration: Promise<oidc.Configuration> | undefined;

function getStaffOidc() {
  if (!config.staffIssuer || !config.staffClientId || !config.staffClientSecret)
    throw new DomainError(
      503,
      "STAFF_IDENTITY_NOT_CONFIGURED",
      "Staff sign-in is not configured.",
    );
  return (configuration ??= oidc.discovery(
    new URL(config.staffIssuer),
    config.staffClientId,
    config.staffClientSecret,
    undefined,
    { execute: [oidc.enableNonRepudiationChecks] },
  ));
}

async function rotate(
  req: Request,
  res: Response,
  session: Omit<StaffSession, "csrf">,
) {
  const token = randomBytes(32).toString("hex");
  const data: StaffSession = {
    ...session,
    csrf: randomBytes(32).toString("hex"),
  };
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    if (req.staffSessionHash)
      await client.query("DELETE FROM auth_sessions WHERE token_hash=$1", [
        req.staffSessionHash,
      ]);
    await client.query(
      "INSERT INTO auth_sessions(token_hash,data,expires_at) VALUES($1,$2,now()+interval '8 hours')",
      [hash(token), JSON.stringify(data)],
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
  req.staffSession = data;
  req.staffSessionHash = hash(token);
  res.cookie(cookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: config.origin.startsWith("https:"),
    maxAge: 8 * 3600000,
    path: "/ops",
  });
}

export async function staffSessionMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  try {
    const token = req.cookies?.[cookieName];
    if (typeof token === "string" && /^[a-f0-9]{64}$/.test(token)) {
      req.staffSessionHash = hash(token);
      const found = await pool.query(
        "SELECT data FROM auth_sessions WHERE token_hash=$1 AND expires_at>now()",
        [req.staffSessionHash],
      );
      const data = found.rows[0]?.data as StaffSession | undefined;
      if (data?.audience === "operations") req.staffSession = data;
    }
    if (req.staffSession?.actor) {
      const actor = req.staffSession.actor;
      const membership = await pool.query(
        "SELECT tenant_id,owner_id,role FROM memberships WHERE owner_id=$1 AND tenant_id=$2 AND enabled=true AND role='operations'",
        [actor.user, actor.tenant],
      );
      if (membership.rows[0])
        req.staffSession.actor = {
          tenant: membership.rows[0].tenant_id,
          user: membership.rows[0].owner_id,
          role: "operations",
        };
      else req.staffSession = undefined;
    }
    next();
  } catch (error) {
    next(error);
  }
}

export function staffActor(req: Request): Actor {
  if (!req.staffSession?.actor || req.staffSession.actor.role !== "operations")
    throw new DomainError(
      401,
      "STAFF_SIGN_IN_REQUIRED",
      "Staff sign-in is required.",
    );
  return req.staffSession.actor;
}

export async function beginStaffOidc(req: Request, res: Response) {
  const client = await getStaffOidc();
  const verifier = oidc.randomPKCECodeVerifier();
  const state = oidc.randomState();
  const nonce = oidc.randomNonce();
  await rotate(req, res, {
    audience: "operations",
    flow: { verifier, state, nonce, created: Date.now() },
  });
  res.redirect(
    oidc.buildAuthorizationUrl(client, {
      redirect_uri: callback,
      scope: "openid profile",
      code_challenge: await oidc.calculatePKCECodeChallenge(verifier),
      code_challenge_method: "S256",
      state,
      nonce,
    }).href,
  );
}

export async function finishStaffOidc(req: Request, res: Response) {
  const flow = req.staffSession?.flow;
  if (!flow || Date.now() - flow.created > 600000)
    throw new DomainError(
      401,
      "STAFF_LOGIN_EXPIRED",
      "Staff sign-in has expired.",
    );
  const client = await getStaffOidc();
  const tokens = await oidc.authorizationCodeGrant(
    client,
    new URL(req.originalUrl, config.origin),
    {
      pkceCodeVerifier: flow.verifier,
      expectedState: flow.state,
      expectedNonce: flow.nonce,
      idTokenExpected: true,
    },
  );
  const subject = tokens.claims()?.sub;
  if (!subject)
    throw new DomainError(
      401,
      "STAFF_IDENTITY_INVALID",
      "Staff identity was not verified.",
    );
  const membership = await pool.query(
    "SELECT tenant_id,owner_id FROM memberships WHERE subject=$1 AND role='operations' AND enabled=true",
    [hash(`${config.staffIssuer}|${subject}`)],
  );
  if (!membership.rows[0])
    throw new DomainError(
      403,
      "STAFF_NOT_PROVISIONED",
      "Staff access has not been granted.",
    );
  await rotate(req, res, {
    audience: "operations",
    actor: {
      tenant: membership.rows[0].tenant_id,
      user: membership.rows[0].owner_id,
      role: "operations",
    },
  });
  res.redirect("/ops/v1/session");
}

export async function endStaffSession(req: Request, res: Response) {
  if (req.staffSessionHash)
    await pool.query("DELETE FROM auth_sessions WHERE token_hash=$1", [
      req.staffSessionHash,
    ]);
  req.staffSession = undefined;
  res.clearCookie(cookieName, { path: "/ops" });
  res.json({ ok: true });
}
