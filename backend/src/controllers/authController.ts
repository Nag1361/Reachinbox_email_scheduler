import type { Request, Response } from "express";
import { config } from "../config/index.js";
import { userRepository } from "../repositories/user.repository.js";
import {
  clearCookieOptions,
  createOAuthState,
  createSessionToken,
  GOOGLE_STATE_COOKIE,
  oauthStateCookieOptions,
  readCookie,
  SESSION_COOKIE,
  verifyOAuthState,
} from "../utils/authSession.js";

interface GoogleTokenResponse {
  access_token: string;
}

interface GoogleProfile {
  sub: string;
  email: string;
  email_verified: boolean;
  name?: string;
  picture?: string;
}

function redirectToLogin(res: Response, error: string): void {
  const destination = new URL("/login", config.frontendUrl);
  destination.searchParams.set("authError", error);
  res.redirect(destination.toString());
}

export function startGoogleOAuth(_req: Request, res: Response): void {
  if (!config.google.clientId || !config.google.clientSecret) {
    redirectToLogin(res, "google_not_configured");
    return;
  }

  const state = createOAuthState("google");
  res.cookie(GOOGLE_STATE_COOKIE, state, oauthStateCookieOptions());
  const authorizationUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authorizationUrl.search = new URLSearchParams({
    client_id: config.google.clientId,
    redirect_uri: config.google.callbackUrl,
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account",
  }).toString();
  res.redirect(authorizationUrl.toString());
}

export async function googleOAuthCallback(req: Request, res: Response): Promise<void> {
  const stateCookie = readCookie(req, GOOGLE_STATE_COOKIE);
  const clearStateCookie = () => res.clearCookie(GOOGLE_STATE_COOKIE, clearCookieOptions());
  const state = verifyOAuthState(
    typeof req.query.state === "string" ? req.query.state : undefined,
    stateCookie,
    "google"
  );

  if (!state || typeof req.query.code !== "string") {
    clearStateCookie();
    redirectToLogin(res, "google_oauth_failed");
    return;
  }

  try {
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code: req.query.code,
        client_id: config.google.clientId,
        client_secret: config.google.clientSecret,
        redirect_uri: config.google.callbackUrl,
        grant_type: "authorization_code",
      }),
    });
    if (!tokenResponse.ok) throw new Error("Google token exchange failed");
    const tokenData = await tokenResponse.json() as GoogleTokenResponse;

    const profileResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { authorization: `Bearer ${tokenData.access_token}` },
    });
    if (!profileResponse.ok) throw new Error("Google profile request failed");
    const profile = await profileResponse.json() as GoogleProfile;
    if (!profile.sub || !profile.email || !profile.email_verified) {
      throw new Error("Google did not return a verified email profile");
    }

    let user = await userRepository.findByGoogleId(profile.sub);
    if (user) {
      user = await userRepository.update(user.id, {
        email: profile.email,
        name: profile.name ?? null,
        avatar: profile.picture ?? null,
      });
    } else {
      const existingEmailUser = await userRepository.findByEmail(profile.email);
      user = existingEmailUser
        ? await userRepository.update(existingEmailUser.id, {
            googleId: profile.sub,
            name: profile.name ?? null,
            avatar: profile.picture ?? null,
          })
        : await userRepository.create({
            googleId: profile.sub,
            email: profile.email,
            name: profile.name ?? null,
            avatar: profile.picture ?? null,
          });
    }

    clearStateCookie();
    res.cookie(SESSION_COOKIE, createSessionToken(user.id), {
      ...clearCookieOptions(),
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    res.redirect(new URL("/dashboard", config.frontendUrl).toString());
  } catch (error) {
    clearStateCookie();
    console.error(JSON.stringify({
      event: "auth.google.failed",
      error: error instanceof Error ? error.message : String(error),
    }));
    redirectToLogin(res, "google_oauth_failed");
  }
}

export async function getCurrentUser(_req: Request, res: Response): Promise<void> {
  const userId = res.locals.userId as string;
  const user = await userRepository.findById(userId);
  if (!user) {
    res.clearCookie(SESSION_COOKIE, clearCookieOptions());
    res.status(401).json({ status: "error", message: "Session user no longer exists" });
    return;
  }

  res.status(200).json({
    status: "success",
    data: { id: user.id, email: user.email, name: user.name, avatar: user.avatar },
  });
}

export function logout(_req: Request, res: Response): void {
  res.clearCookie(SESSION_COOKIE, clearCookieOptions());
  res.status(200).json({ status: "success", data: { loggedOut: true } });
}
