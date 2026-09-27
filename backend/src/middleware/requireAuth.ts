import type { Request, Response, NextFunction } from "express";
import { getSessionUserId, readCookie, SESSION_COOKIE } from "../utils/authSession.js";

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authorization = req.get("authorization");
  const bearerToken = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : undefined;
  const userId = getSessionUserId(bearerToken ?? readCookie(req, SESSION_COOKIE));

  if (!userId) {
    res.status(401).json({ status: "error", message: "Authentication required" });
    return;
  }

  res.locals.userId = userId;
  next();
}