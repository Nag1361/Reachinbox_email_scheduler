import { Router } from "express";
import {
  scheduleEmailsController,
  getScheduledEmailsController,
  getSentEmailsController,
  getEmailByIdController,
  searchEmailsController,
} from "../controllers/emailController.js";
import { validateScheduleEmails } from "../middleware/validateEmail.js";

const router = Router();

/**
 * POST /api/emails/schedule
 * Schedule a batch of emails.
 */
router.post("/schedule", validateScheduleEmails, scheduleEmailsController);

/**
 * GET /api/emails/scheduled
 * List all scheduled (pending) emails.
 */
router.get("/scheduled", getScheduledEmailsController);

/**
 * GET /api/emails/sent
 * List all sent emails.
 */
router.get("/sent", getSentEmailsController);

/** Search indexed sender, recipient, subject, and body fields. */
router.get("/search", searchEmailsController);

/**
 * GET /api/emails/:id
 * Get a single email by ID.
 */
router.get("/:id", getEmailByIdController);

export default router;
