import { randomBytes, randomUUID } from "node:crypto";
import type { Request, Response, NextFunction } from "express";
import * as oidc from "openid-client";
import { pool, type Actor } from "./db.ts";
import { config } from "./config.ts";
import { DomainError, hash } from "./domain.ts";

export interface Session {
  actor?: Actor;
  csrf: string;
  name?: string;
  mode?: "demo" | "oidc";
  oidc?: { verifier: string; state: string; nonce: string; created: number };
}
declare module "express-serve-static-core" {
  interface Request {
    session: Session;
    sessionHash: string;
  }
}
const cookieName = "bt_session";
export async function newSession(
  req: Request,
  res: Response,
  data: Partial<Session> = {},
) {
  const token = randomBytes(32).toString("hex");
  const session = { ...data, csrf: randomBytes(32).toString("hex") };
  const tokenHash = hash(token);
  const db = await pool.connect();
  try {
    await db.query("BEGIN");
    if (req.sessionHash)
      await db.query("DELETE FROM auth_sessions WHERE token_hash=$1", [
        req.sessionHash,
      ]);
    await db.query(
      "INSERT INTO auth_sessions(token_hash,data,expires_at) VALUES($1,$2,now()+interval '12 hours')",
      [tokenHash, JSON.stringify(session)],
    );
    await db.query("COMMIT");
  } catch (error) {
    await db.query("ROLLBACK");
    throw error;
  } finally {
    db.release();
  }
  req.sessionHash = tokenHash;
  req.session = session;
  res.cookie(cookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: config.origin.startsWith("https:"),
    maxAge: 12 * 3600000,
    path: "/",
  });
}
export async function sessionMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const token = req.cookies[cookieName];
    if (typeof token === "string" && /^[a-f0-9]{64}$/.test(token)) {
      req.sessionHash = hash(token);
      const { rows } = await pool.query(
        "SELECT data FROM auth_sessions WHERE token_hash=$1 AND expires_at>now()",
        [req.sessionHash],
      );
      if (rows[0] && rows[0].data?.audience !== "operations")
        req.session = rows[0].data;
    }
    if (!req.session) await newSession(req, res);
    if (req.session.mode === "oidc" && req.session.actor) {
      const { rows } = await pool.query(
        "SELECT tenant_id,owner_id,role FROM memberships WHERE owner_id=$1 AND enabled=true",
        [req.session.actor.user],
      );
      if (!rows[0]) await newSession(req, res);
      else
        req.session.actor = {
          tenant: rows[0].tenant_id,
          user: rows[0].owner_id,
          role: rows[0].role,
        };
    }
    next();
  } catch (error) {
    next(error);
  }
}
export function authenticated(req: Request): Actor {
  if (!req.session.actor)
    throw new DomainError(
      401,
      "SIGN_IN_REQUIRED",
      "Please sign in to continue.",
    );
  if (req.session.actor.role !== "customer")
    throw new DomainError(
      403,
      "CUSTOMER_AUDIENCE_REQUIRED",
      "Use staff sign-in for this account.",
    );
  return req.session.actor;
}
export function csrfMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  if (
    !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
    (req.get("origin") !== config.origin ||
      req.get("x-csrf-token") !== req.session.csrf)
  )
    return next(
      new DomainError(
        403,
        "INVALID_REQUEST_ORIGIN",
        "Your session changed. Refresh the page and try again.",
      ),
    );
  next();
}
let oidcConfiguration: Promise<oidc.Configuration> | undefined;
function getOidc() {
  if (!config.issuer || !config.clientId || !config.clientSecret)
    throw new DomainError(
      503,
      "IDENTITY_NOT_CONFIGURED",
      "Secure sign-in is awaiting BizTrust identity configuration. Use the local demonstration to explore.",
    );
  return (oidcConfiguration ??= oidc.discovery(
    new URL(config.issuer),
    config.clientId,
    config.clientSecret,
    undefined,
    { execute: [oidc.enableNonRepudiationChecks] },
  ));
}
export async function beginOidc(req: Request, res: Response) {
  const client = await getOidc();
  const verifier = oidc.randomPKCECodeVerifier();
  const state = oidc.randomState();
  const nonce = oidc.randomNonce();
  await newSession(req, res, {
    oidc: { verifier, state, nonce, created: Date.now() },
  });
  res.redirect(
    oidc.buildAuthorizationUrl(client, {
      redirect_uri: `${config.origin}/api/auth/callback`,
      scope: "openid profile email",
      code_challenge: await oidc.calculatePKCECodeChallenge(verifier),
      code_challenge_method: "S256",
      state,
      nonce,
    }).href,
  );
}
export async function finishOidc(req: Request, res: Response) {
  const flow = req.session.oidc;
  if (!flow || Date.now() - flow.created > 600000)
    throw new DomainError(
      401,
      "LOGIN_EXPIRED",
      "This sign-in attempt has expired. Please try again.",
    );
  const client = await getOidc();
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
  const claims = tokens.claims();
  if (!claims?.sub)
    throw new DomainError(
      401,
      "IDENTITY_INVALID",
      "The identity provider did not return a valid account.",
    );
  const subject = hash(`${config.issuer}|${claims.sub}`);
  await pool.query(
    "INSERT INTO memberships(subject,tenant_id,owner_id,role) VALUES($1,$2,$3,'customer') ON CONFLICT(subject) DO NOTHING",
    [subject, config.customerTenant, randomUUID()],
  );
  const { rows } = await pool.query(
    "SELECT * FROM memberships WHERE subject=$1 AND enabled=true",
    [subject],
  );
  if (!rows[0])
    throw new DomainError(
      403,
      "ACCOUNT_DISABLED",
      "This account is unavailable. Please contact BizTrust support.",
    );
  const membership = rows[0];
  if (membership.role !== "customer")
    throw new DomainError(
      403,
      "CUSTOMER_AUDIENCE_REQUIRED",
      "Use staff sign-in for this account.",
    );
  await newSession(req, res, {
    actor: {
      tenant: membership.tenant_id,
      user: membership.owner_id,
      role: membership.role,
    },
    mode: "oidc",
    name: typeof claims.name === "string" ? claims.name : "Your account",
  });
  res.redirect("/insurance?signed-in=1");
}
