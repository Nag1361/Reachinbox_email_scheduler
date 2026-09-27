import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSmtpTransporter, sendMail, getTestMessageUrl } = vi.hoisted(() => ({
  getSmtpTransporter: vi.fn(),
  sendMail: vi.fn(),
  getTestMessageUrl: vi.fn(),
}));

vi.mock("nodemailer", () => ({
  default: { getTestMessageUrl },
}));

vi.mock("../../src/integrations/smtp.js", () => ({
  getSmtpTransporter,
}));

import { deliverEmail } from "../../src/services/email.service";

describe("deliverEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSmtpTransporter.mockResolvedValue({ sendMail });
    sendMail.mockResolvedValue({ messageId: "ethereal-message-1" });
    getTestMessageUrl.mockReturnValue("https://ethereal.email/message/preview-1");
  });

  it("sends the scheduled email fields and returns Ethereal metadata", async () => {
    const result = await deliverEmail({
      senderEmail: "sender@example.com",
      recipientEmail: "recipient@example.com",
      subject: "A scheduled message",
      body: "<p>Hello</p>",
    });

    expect(sendMail).toHaveBeenCalledWith({
      from: "sender@example.com",
      to: "recipient@example.com",
      subject: "A scheduled message",
      html: "<p>Hello</p>",
    });
    expect(getTestMessageUrl).toHaveBeenCalledWith({ messageId: "ethereal-message-1" });
    expect(result).toEqual({
      messageId: "ethereal-message-1",
      previewUrl: "https://ethereal.email/message/preview-1",
    });
  });

  it("returns a null preview URL when Nodemailer has no Ethereal preview", async () => {
    getTestMessageUrl.mockReturnValue(false);

    const result = await deliverEmail({
      senderEmail: "sender@example.com",
      recipientEmail: "recipient@example.com",
      subject: "A scheduled message",
      body: "<p>Hello</p>",
    });

    expect(result.previewUrl).toBeNull();
  });
});