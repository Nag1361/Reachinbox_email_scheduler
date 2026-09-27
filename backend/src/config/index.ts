import dotenv from "dotenv";
import path from "path";

// Load .env from backend root
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

/**
 * Helper to read a required env var. Throws at startup if missing.
 */
function required(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

/**
 * Helper to read an optional env var with a default.
 */
function optional(key: string, fallback: string): string {
  return process.env[key] || fallback;
}

const nodeEnv = optional("NODE_ENV", "development");
const port = parseInt(optional("PORT", "3000"), 10);
const backendUrl = optional("BACKEND_URL", `http://127.0.0.1:${port}`);
const jwtSecret = process.env.JWT_SECRET || (
  nodeEnv === "production" ? "" : "development-only-change-this-secret"
);

if (!jwtSecret) {
  throw new Error("JWT_SECRET must be configured outside development");
}

export const config = {
  // ── Server ──────────────────────────────────────────────
  nodeEnv,
  port,
  isDev: nodeEnv === "development",
  backendUrl,

  // ── Database ────────────────────────────────────────────
  databaseUrl: required("DATABASE_URL"),

  // ── Redis ───────────────────────────────────────────────
  redis: {
    url: process.env.REDIS_URL || undefined,
    host: optional("REDIS_HOST", "localhost"),
    port: parseInt(optional("REDIS_PORT", "6379"), 10),
    password: process.env.REDIS_PASSWORD || undefined,
  },

  // ── Elasticsearch ───────────────────────────────────────
  elasticsearchUrl: optional("ELASTICSEARCH_URL", "http://localhost:9200"),

  // ── Google OAuth ────────────────────────────────────────
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || "",
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    callbackUrl: optional(
      "GOOGLE_CALLBACK_URL",
      `${backendUrl}/api/auth/google/callback`
    ),
  },

  // ── JWT ─────────────────────────────────────────────────
  jwtSecret,

  // ── Ethereal SMTP ───────────────────────────────────────
  ethereal: {
    host: optional("ETHEREAL_HOST", "smtp.ethereal.email"),
    port: parseInt(optional("ETHEREAL_PORT", "587"), 10),
    user: process.env.ETHEREAL_USER || "",
    password: process.env.ETHEREAL_PASSWORD || "",
  },

  // ── Slack ───────────────────────────────────────────────
  slack: {
    clientId: process.env.SLACK_CLIENT_ID || "",
    clientSecret: process.env.SLACK_CLIENT_SECRET || "",
    redirectUri: optional(
      "SLACK_REDIRECT_URI",
      `${backendUrl}/api/slack/callback`
    ),
  },

  // ── Frontend ────────────────────────────────────────────
  frontendUrl: optional("FRONTEND_URL", "http://127.0.0.1:5173"),

  // ── Worker / Rate Limiting ──────────────────────────────
  worker: {
    concurrency: parseInt(optional("WORKER_CONCURRENCY", "5"), 10),
    minEmailDelayMs: parseInt(optional("MIN_SEND_DELAY_MS", "2000"), 10),
    maxEmailsPerHour: parseInt(optional("MAX_EMAILS_PER_HOUR", "200"), 10),
  },
} as const;
