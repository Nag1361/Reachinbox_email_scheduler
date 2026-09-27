import { Router } from "express";
import { getHealth } from "../controllers/healthController.js";
import emailRoutes from "./emailRoutes.js";
import authRoutes from "./authRoutes.js";
import slackRoutes from "./slackRoutes.js";
import { requireAuth } from "../middleware/requireAuth.js";

const router = Router();

router.get("/health", getHealth);
router.use("/auth", authRoutes);
router.use("/slack", slackRoutes);
router.use("/emails", requireAuth, emailRoutes);

export default router;
