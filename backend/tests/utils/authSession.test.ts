import { describe, expect, it } from "vitest";
import {
  createOAuthState,
  createSessionToken,
  getSessionUserId,
  verifyOAuthState,
} from "../../src/utils/authSession";

describe("authentication session tokens", () => {
  it("accepts a valid session JWT and rejects a tampered one", () => {
    const token = createSessionToken("user-1");
    const [header, payload, signature] = token.split(".");

    expect(getSessionUserId(token)).toBe("user-1");
    expect(getSessionUserId(`${header}.${payload}.${signature}x`)).toBeNull();
  });

  it("validates signed OAuth state against its cookie and provider", () => {
    const state = createOAuthState("slack", "user-1");

    expect(verifyOAuthState(state, state, "slack")).toMatchObject({
      provider: "slack",
      userId: "user-1",
    });
    expect(verifyOAuthState(state, state, "google")).toBeNull();
    expect(verifyOAuthState(state, undefined, "slack")).toBeNull();
  });
});