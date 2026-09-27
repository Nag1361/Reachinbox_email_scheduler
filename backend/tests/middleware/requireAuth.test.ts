import { describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";
import { requireAuth } from "../../src/middleware/requireAuth";
import { createSessionToken, SESSION_COOKIE } from "../../src/utils/authSession";

function createRequest(cookie?: string): Request {
  return {
    headers: cookie ? { cookie } : {},
    get: vi.fn().mockReturnValue(undefined),
  } as unknown as Request;
}

function createResponse(): Response {
  return {
    locals: {},
    status: vi.fn().mockReturnThis(),
    json: vi.fn(),
  } as unknown as Response;
}

describe("requireAuth", () => {
  it("rejects requests without a session", () => {
    const req = createRequest();
    const res = createResponse();
    const next = vi.fn();

    requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("sets the user ID from a valid session cookie", () => {
    const token = createSessionToken("user-123");
    const req = createRequest(`${SESSION_COOKIE}=${token}`);
    const res = createResponse();
    const next = vi.fn();

    requireAuth(req, res, next);

    expect(res.locals.userId).toBe("user-123");
    expect(next).toHaveBeenCalledOnce();
  });
});