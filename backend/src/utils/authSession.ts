import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { CookieOptions, Request } from "express";
import { config } from "../config/index.js";

export const SESSION_COOKIE = "reachinbox_session";
export const GOOGLE_STATE_COOKIE = "reachinbox_google_state";
export const SLACK_STATE_COOKIE = "reachinbox_slack_state";
const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;
const OAUTH_STATE_TTL_SECONDS = 10 * 60;

interface SessionPayload {
  sub: string;
  iat: number;
  exp: number;
}

interface OAuthStatePayload {
  provider: "google" | "slack";
  userId?: string;
  nonce: string;
  exp: number;
}

function sign(value: string): string {
  return createHmac("sha256", config.jwtSecret).update(value).digest("base64url");
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function baseCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: config.nodeEnv === "production",
    path: "/",
  };
}

export function sessionCookieOptions(): CookieOptions {
  return { ...baseCookieOptions(), maxAge: SESSION_TTL_SECONDS * 1000 };
}

export function oauthStateCookieOptions(): CookieOptions {
  return { ...baseCookieOptions(), maxAge: OAUTH_STATE_TTL_SECONDS * 1000 };
}

export function clearCookieOptions(): CookieOptions {
  return baseCookieOptions();
}

export function readCookie(req: Request, name: string): string | undefined {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return undefined;

  for (const item of cookieHeader.split(";")) {
    const separator = item.indexOf("=");
    if (separator < 0 || item.slice(0, separator).trim() !== name) continue;
    try {
      return decodeURIComponent(item.slice(separator + 1).trim());
    } catch {
      return undefined;
    }
  }
  return undefined;
}

export function createSessionToken(userId: string): string {
  const issuedAt = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({
    sub: userId,
    iat: issuedAt,
    exp: issuedAt + SESSION_TTL_SECONDS,
  } satisfies SessionPayload)).toString("base64url");
  const content = `${header}.${payload}`;
  return `${content}.${sign(content)}`;
}

export function getSessionUserId(token: string | undefined): string | null {
  if (!token) return null;
  const segments = token.split(".");
  if (segments.length !== 3) return null;

  const [header, payload, signature] = segments;
  const content = `${header}.${payload}`;
  if (!safeEqual(sign(content), signature)) return null;

  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as SessionPayload;
    if (!parsed.sub || !Number.isInteger(parsed.exp) || parsed.exp <= Date.now() / 1000) return null;
    return parsed.sub;
  } catch {
    return null;
  }
}

export function createOAuthState(provider: "google" | "slack", userId?: string): string {
  const payload: OAuthStatePayload = {
    provider,
    ...(userId ? { userId } : {}),
    nonce: randomBytes(24).toString("base64url"),
    exp: Math.floor(Date.now() / 1000) + OAUTH_STATE_TTL_SECONDS,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encoded}.${sign(encoded)}`;
}

export function verifyOAuthState(
  state: string | undefined,
  cookieState: string | undefined,
  provider: "google" | "slack"
): OAuthStatePayload | null {
  if (!state || !cookieState || !safeEqual(state, cookieState)) return null;
  const [encoded, signature, extra] = state.split(".");
  if (!encoded || !signature || extra || !safeEqual(sign(encoded), signature)) return null;

  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as OAuthStatePayload;
    if (payload.provider !== provider || !payload.nonce || payload.exp <= Date.now() / 1000) return null;
    return payload;
  } catch {
    return null;
  }
}