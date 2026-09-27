import { Router } from "express";
import {
  getCurrentUser,
  googleOAuthCallback,
  logout,
  startGoogleOAuth,
} from "../controllers/authController.js";
import { requireAuth } from "../middleware/requireAuth.js";

const router = Router();

router.get("/google", startGoogleOAuth);
router.get("/google/callback", googleOAuthCallback);
router.get("/me", requireAuth, getCurrentUser);
router.post("/logout", logout);

export default router;