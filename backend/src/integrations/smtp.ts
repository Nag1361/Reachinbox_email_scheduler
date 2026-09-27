import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import { config } from "../config/index.js";

/**
 * Ethereal SMTP transporter.
 *
 * If ETHEREAL_USER / ETHEREAL_PASSWORD are provided in .env, uses those.
 * Otherwise, auto-creates a test account on first use (dev convenience).
 */

let transporter: Transporter | null = null;

export async function getSmtpTransporter(): Promise<Transporter> {
  if (transporter) return transporter;

  let user = config.ethereal.user;
  let pass = config.ethereal.password;

  // Auto-create Ethereal account if credentials are missing
  if (!user || !pass) {
    console.log("[smtp] No Ethereal credentials found, creating test account...");
    const testAccount = await nodemailer.createTestAccount();
    user = testAccount.user;
    pass = testAccount.pass;
    console.log(`[smtp] Ethereal test account created: ${user}`);
    console.log(`[smtp] View sent emails at: https://ethereal.email/login`);
  }

  transporter = nodemailer.createTransport({
    host: config.ethereal.host,
    port: config.ethereal.port,
    secure: config.ethereal.port === 465,
    auth: { user, pass },
  });

  // Verify connection
  await transporter.verify();
  console.log("[smtp] Ethereal SMTP connection verified");

  return transporter;
}
