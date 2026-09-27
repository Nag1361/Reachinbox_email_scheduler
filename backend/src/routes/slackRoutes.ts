import { Router } from "express";
import {
  slackDisconnect,
  slackOAuthCallback,
  slackStatus,
  startSlackOAuth,
} from "../controllers/slackController.js";
import { requireAuth } from "../middleware/requireAuth.js";

const router = Router();

router.get("/connect", requireAuth, startSlackOAuth);
router.get("/callback", slackOAuthCallback);
router.get("/status", requireAuth, slackStatus);
router.post("/disconnect", requireAuth, slackDisconnect);

export default router;