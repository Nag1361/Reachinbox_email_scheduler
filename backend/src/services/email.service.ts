import nodemailer from "nodemailer";
import { getSmtpTransporter } from "../integrations/smtp.js";

export interface DeliverEmailInput {
  senderEmail: string;
  recipientEmail: string;
  subject: string;
  body: string;
}

export interface EmailDeliveryResult {
  messageId: string;
  previewUrl: string | null;
}

export async function deliverEmail(input: DeliverEmailInput): Promise<EmailDeliveryResult> {
  const transporter = await getSmtpTransporter();
  const info = await transporter.sendMail({
    from: input.senderEmail,
    to: input.recipientEmail,
    subject: input.subject,
    html: input.body,
  });

  const previewUrl = nodemailer.getTestMessageUrl(info);
  return {
    messageId: info.messageId,
    previewUrl: typeof previewUrl === "string" ? previewUrl : null,
  };
}