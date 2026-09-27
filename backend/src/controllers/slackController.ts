import type { Request, Response } from "express";
import { config } from "../config/index.js";
import { disconnectSlack, getSlackStatus, saveSlackConnection } from "../services/slackService.js";
import {
  clearCookieOptions,
  createOAuthState,
  oauthStateCookieOptions,
  readCookie,
  SLACK_STATE_COOKIE,
  verifyOAuthState,
} from "../utils/authSession.js";

function redirectToDashboard(res: Response, result: "connected" | "error"): void {
  const destination = new URL("/dashboard", config.frontendUrl);
  destination.searchParams.set("slack", result);
  res.redirect(destination.toString());
}

export function startSlackOAuth(_req: Request, res: Response): void {
  if (!config.slack.clientId || !config.slack.clientSecret) {
    res.status(503).json({
      status: "error",
      message: "Slack OAuth is not configured. Set SLACK_CLIENT_ID and SLACK_CLIENT_SECRET in backend/.env.",
    });
    return;
  }

  const state = createOAuthState("slack", res.locals.userId as string);
  res.cookie(SLACK_STATE_COOKIE, state, oauthStateCookieOptions());
  const authorizationUrl = new URL("https://slack.com/oauth/v2/authorize");
  authorizationUrl.search = new URLSearchParams({
    client_id: config.slack.clientId,
    scope: "chat:write,incoming-webhook",
    redirect_uri: config.slack.redirectUri,
    state,
  }).toString();
  res.redirect(authorizationUrl.toString());
}

export async function slackOAuthCallback(req: Request, res: Response): Promise<void> {
  const state = verifyOAuthState(
    typeof req.query.state === "string" ? req.query.state : undefined,
    readCookie(req, SLACK_STATE_COOKIE),
    "slack"
  );
  res.clearCookie(SLACK_STATE_COOKIE, clearCookieOptions());

  if (!state?.userId || typeof req.query.code !== "string" || req.query.error) {
    redirectToDashboard(res, "error");
    return;
  }

  try {
    await saveSlackConnection(state.userId, req.query.code);
    redirectToDashboard(res, "connected");
  } catch (error) {
    console.error(JSON.stringify({
      event: "slack.oauth.failed",
      userId: state.userId,
      error: error instanceof Error ? error.message : String(error),
    }));
    redirectToDashboard(res, "error");
  }
}

export async function slackStatus(_req: Request, res: Response): Promise<void> {
  const status = await getSlackStatus(res.locals.userId as string);
  res.status(200).json({ status: "success", data: status });
}

export async function slackDisconnect(_req: Request, res: Response): Promise<void> {
  const disconnected = await disconnectSlack(res.locals.userId as string);
  res.status(200).json({ status: "success", data: { disconnected: disconnected > 0 } });
}