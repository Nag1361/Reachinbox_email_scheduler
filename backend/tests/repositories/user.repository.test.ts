import { describe, it, expect, beforeEach, vi } from "vitest";
import { prismaMock } from "../prisma-mock";
import { UserRepository } from "../../src/repositories/user.repository";

const repo = new UserRepository();

const mockUser = {
  id: "user-1",
  googleId: "google-123",
  email: "alice@example.com",
  name: "Alice",
  avatar: null,
  accessToken: "tok",
  refreshToken: "ref",
  tokenExpiry: null,
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("UserRepository", () => {
  describe("findById", () => {
    it("should return a user when found", async () => {
      prismaMock.user.findUnique.mockResolvedValue(mockUser);

      const result = await repo.findById("user-1");

      expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
        where: { id: "user-1" },
      });
      expect(result).toEqual(mockUser);
    });

    it("should return null when not found", async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);

      const result = await repo.findById("nonexistent");

      expect(result).toBeNull();
    });
  });

  describe("findByGoogleId", () => {
    it("should query by googleId", async () => {
      prismaMock.user.findUnique.mockResolvedValue(mockUser);

      const result = await repo.findByGoogleId("google-123");

      expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
        where: { googleId: "google-123" },
      });
      expect(result).toEqual(mockUser);
    });
  });

  describe("findByEmail", () => {
    it("should query by email", async () => {
      prismaMock.user.findUnique.mockResolvedValue(mockUser);

      const result = await repo.findByEmail("alice@example.com");

      expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
        where: { email: "alice@example.com" },
      });
      expect(result).toEqual(mockUser);
    });
  });

  describe("create", () => {
    it("should create and return a new user", async () => {
      const input = {
        googleId: "google-456",
        email: "bob@example.com",
        name: "Bob",
      };
      prismaMock.user.create.mockResolvedValue({ ...mockUser, ...input, id: "user-2" });

      const result = await repo.create(input);

      expect(prismaMock.user.create).toHaveBeenCalledWith({ data: input });
      expect(result.email).toBe("bob@example.com");
    });
  });

  describe("update", () => {
    it("should update and return the user", async () => {
      const updated = { ...mockUser, name: "Alice Updated" };
      prismaMock.user.update.mockResolvedValue(updated);

      const result = await repo.update("user-1", { name: "Alice Updated" });

      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: "user-1" },
        data: { name: "Alice Updated" },
      });
      expect(result.name).toBe("Alice Updated");
    });
  });
});
