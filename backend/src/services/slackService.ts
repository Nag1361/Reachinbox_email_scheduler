import { createHash } from "node:crypto";
import { prisma } from "../config/database.js";
import { config } from "../config/index.js";
import { redisConnection } from "../config/redis.js";

interface SlackOAuthResponse {
  ok: boolean;
  error?: string;
  access_token?: string;
  team?: { id?: string; name?: string };
  incoming_webhook?: { url?: string; channel?: string; channel_id?: string };
}

export async function saveSlackConnection(userId: string, code: string): Promise<void> {
  if (!config.slack.clientId || !config.slack.clientSecret) {
    throw new Error("Slack OAuth is not configured: SLACK_CLIENT_ID and SLACK_CLIENT_SECRET are required.");
  }

  const response = await fetch("https://slack.com/api/oauth.v2.access", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: config.slack.clientId,
      client_secret: config.slack.clientSecret,
      redirect_uri: config.slack.redirectUri,
    }),
  });

  const result = await response.json() as SlackOAuthResponse;
  if (!response.ok || !result.ok || !result.access_token || !result.team?.id) {
    throw new Error(`Slack OAuth failed: ${result.error ?? response.statusText}`);
  }

  await prisma.slackConnection.upsert({
    where: { userId_teamId: { userId, teamId: result.team.id } },
    create: {
      user: { connect: { id: userId } },
      teamId: result.team.id,
      teamName: result.team.name ?? null,
      channelId: result.incoming_webhook?.channel_id ?? null,
      channelName: result.incoming_webhook?.channel ?? null,
      webhookUrl: result.incoming_webhook?.url ?? null,
      accessToken: result.access_token,
      isActive: true,
    },
    update: {
      teamName: result.team.name ?? null,
      channelId: result.incoming_webhook?.channel_id ?? null,
      channelName: result.incoming_webhook?.channel ?? null,
      webhookUrl: result.incoming_webhook?.url ?? null,
      accessToken: result.access_token,
      isActive: true,
    },
  });
}

export async function getSlackStatus(userId: string) {
  const connections = await prisma.slackConnection.findMany({
    where: { userId, isActive: true },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      teamId: true,
      teamName: true,
      channelId: true,
      channelName: true,
      isActive: true,
      createdAt: true,
    },
  });

  return {
    connected: connections.length > 0,
    connections,
  };
}

export async function disconnectSlack(userId: string): Promise<number> {
  const result = await prisma.slackConnection.deleteMany({ where: { userId } });
  return result.count;
}

export async function notifyRateLimitHit(
  userId: string,
  senderEmail: string,
  hourWindow: string
): Promise<void> {
  const normalizedSender = senderEmail.trim().toLowerCase();
  const fingerprint = createHash("sha256")
    .update(`${userId}:${normalizedSender}:${hourWindow}`)
    .digest("hex");

  try {
    const reserved = await redisConnection.set(
      `slack-rate-limit-notice:${fingerprint}`,
      "1",
      "EX",
      48 * 60 * 60,
      "NX"
    );
    if (reserved !== "OK") return;

    const connection = await prisma.slackConnection.findFirst({
      where: { userId, isActive: true },
      orderBy: { updatedAt: "desc" },
    });
    if (!connection) return;

    const text = `Email rate limit reached for ${normalizedSender} during ${hourWindow} UTC.`;
    if (connection.webhookUrl) {
      const webhookResponse = await fetch(connection.webhookUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!webhookResponse.ok || (await webhookResponse.text()) !== "ok") {
        throw new Error("Slack webhook rejected the notification");
      }
    } else if (connection.channelId) {
      const slackResponse = await fetch("https://slack.com/api/chat.postMessage", {
        method: "POST",
        headers: {
          authorization: `Bearer ${connection.accessToken}`,
          "content-type": "application/json; charset=utf-8",
        },
        body: JSON.stringify({ channel: connection.channelId, text }),
      });
      const result = await slackResponse.json() as { ok?: boolean; error?: string };
      if (!slackResponse.ok || !result.ok) {
        throw new Error(`Slack notification failed: ${result.error ?? slackResponse.statusText}`);
      }
    } else {
      return;
    }

    console.info(JSON.stringify({
      event: "slack.rate_limit_notified",
      userId,
      senderEmail: normalizedSender,
      hourWindow,
    }));
  } catch (error) {
    console.warn(JSON.stringify({
      event: "slack.rate_limit_notification_skipped",
      userId,
      senderEmail: normalizedSender,
      hourWindow,
      error: error instanceof Error ? error.message : String(error),
    }));
  }
}