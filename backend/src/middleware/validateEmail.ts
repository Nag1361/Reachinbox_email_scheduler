import { Request, Response, NextFunction } from "express";
import { AppError } from "./errorHandler.js";

/**
 * Simple email regex — good enough for validation, not for RFC 5322 compliance.
 */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Validate the POST /api/emails/schedule request body.
 */
export function validateScheduleEmails(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
    throw new AppError("Request body must be a JSON object", 400);
  }

  const { senderEmail, recipients, subject, body, startTime, delayBetweenEmails, hourlyLimit } =
    req.body;

  const errors: string[] = [];

  // senderEmail
  if (!senderEmail || typeof senderEmail !== "string") {
    errors.push("senderEmail is required and must be a string");
  } else if (!EMAIL_REGEX.test(senderEmail.trim())) {
    errors.push("senderEmail must be a valid email address");
  }

  // recipients
  if (!Array.isArray(recipients) || recipients.length === 0) {
    errors.push("recipients must be a non-empty array");
  } else {
    recipients.forEach((r: unknown, i: number) => {
      if (typeof r !== "string" || !EMAIL_REGEX.test(r.trim())) {
        errors.push(`recipients[${i}] must be a valid email address`);
      }
    });
  }

  // subject
  if (!subject || typeof subject !== "string" || subject.trim().length === 0) {
    errors.push("subject is required");
  }

  // body
  if (!body || typeof body !== "string" || body.trim().length === 0) {
    errors.push("body is required");
  }

  // startTime
  if (typeof startTime !== "string" || startTime.trim().length === 0) {
    errors.push("startTime is required");
  } else {
    const parsed = new Date(startTime);
    if (Number.isNaN(parsed.getTime())) {
      errors.push("startTime must be a valid ISO 8601 date");
    }
  }

  // delayBetweenEmails
  if (delayBetweenEmails === undefined || delayBetweenEmails === null) {
    errors.push("delayBetweenEmails is required");
  } else if (typeof delayBetweenEmails !== "number" || !Number.isFinite(delayBetweenEmails) || delayBetweenEmails < 0) {
    errors.push("delayBetweenEmails must be a non-negative number (ms)");
  }

  // hourlyLimit
  if (hourlyLimit === undefined || hourlyLimit === null) {
    errors.push("hourlyLimit is required");
  } else if (typeof hourlyLimit !== "number" || !Number.isFinite(hourlyLimit) || hourlyLimit <= 0 || !Number.isInteger(hourlyLimit)) {
    errors.push("hourlyLimit must be a positive integer");
  }

  if (errors.length > 0) {
    throw new AppError(errors.join("; "), 400);
  }

  next();
}
