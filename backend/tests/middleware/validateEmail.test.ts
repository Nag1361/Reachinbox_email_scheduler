import { describe, expect, it, vi } from "vitest";
import type { Request, Response, NextFunction } from "express";
import { validateScheduleEmails } from "../../src/middleware/validateEmail";

const validBody = {
  senderEmail: "sender@example.com",
  recipients: ["recipient@example.com"],
  subject: "A subject",
  body: "A body",
  startTime: "2026-09-28T10:00:00.000Z",
  delayBetweenEmails: 0,
  hourlyLimit: 1,
};

function invoke(body: unknown) {
  const req = { body } as Request;
  const res = {} as Response;
  const next = vi.fn() as NextFunction;
  validateScheduleEmails(req, res, next);
  return next;
}

describe("validateScheduleEmails", () => {
  it("accepts valid schedule input including zero delay", () => {
    const next = invoke(validBody);
    expect(next).toHaveBeenCalledOnce();
  });

  it.each([
    ["non-object request body", null],
    ["invalid recipient", { ...validBody, recipients: ["bad-address"] }],
    ["empty subject", { ...validBody, subject: "   " }],
    ["empty body", { ...validBody, body: "   " }],
    ["invalid start time", { ...validBody, startTime: "not-a-time" }],
    ["negative delay", { ...validBody, delayBetweenEmails: -1 }],
    ["non-finite delay", { ...validBody, delayBetweenEmails: Number.POSITIVE_INFINITY }],
    ["zero hourly limit", { ...validBody, hourlyLimit: 0 }],
  ])("rejects %s", (_caseName, body) => {
    expect(() => invoke(body)).toThrow();
  });
});