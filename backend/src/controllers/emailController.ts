import { Request, Response, NextFunction } from "express";
import {
  scheduleEmails,
  getScheduledEmails,
  getSentEmails,
  getEmailById,
} from "../services/emailService.js";
import { AppError } from "../middleware/errorHandler.js";
import { searchEmails } from "../services/elasticsearchService.js";

/**
 * POST /api/emails/schedule
 * Schedule a batch of emails to be sent via BullMQ delayed jobs.
 */
export async function scheduleEmailsController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const result = await scheduleEmails({
      userId: res.locals.userId as string,
      senderEmail: req.body.senderEmail,
      recipients: req.body.recipients,
      subject: req.body.subject,
      body: req.body.body,
      startTime: req.body.startTime,
      delayBetweenEmails: req.body.delayBetweenEmails,
      hourlyLimit: req.body.hourlyLimit,
    });

    res.status(201).json({
      status: "success",
      message: `${result.scheduled} emails scheduled successfully`,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/emails/scheduled
 * List all emails with SCHEDULED status.
 */
export async function getScheduledEmailsController(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const emails = await getScheduledEmails(res.locals.userId as string);

    res.status(200).json({
      status: "success",
      count: emails.length,
      data: emails,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/emails/sent
 * List all emails with SENT status.
 */
export async function getSentEmailsController(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const emails = await getSentEmails(res.locals.userId as string);

    res.status(200).json({
      status: "success",
      count: emails.length,
      data: emails,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/emails/:id
 * Get a single email message by ID.
 */
export async function getEmailByIdController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = req.params.id as string;
    const email = await getEmailById(id, res.locals.userId as string);

    if (!email) {
      throw new AppError("Email not found", 404);
    }

    res.status(200).json({
      status: "success",
      data: {
        id: email.id,
        status: email.status,
        recipient: email.recipientEmail,
        subject: email.subject,
        scheduledAt: email.scheduledAt,
        sentAt: email.sentAt,
        error: email.errorMessage,
        previewUrl: email.previewUrl,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function searchEmailsController(
  req: Request,
  res: Response
): Promise<void> {
  const query = req.query.q;
  if (typeof query !== "string" || query.trim().length === 0) {
    res.status(400).json({
      status: "error",
      message: "Query parameter q is required",
    });
    return;
  }

  try {
    const results = await searchEmails(query.trim(), res.locals.userId as string);
    res.status(200).json({ status: "success", ...results });
  } catch (error) {
    console.warn(JSON.stringify({
      event: "email.elasticsearch.search_failed",
      error: error instanceof Error ? error.message : String(error),
    }));
    res.status(503).json({
      status: "error",
      message: "Email search is temporarily unavailable",
    });
  }
}
