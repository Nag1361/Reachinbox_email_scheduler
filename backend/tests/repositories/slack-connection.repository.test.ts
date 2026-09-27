import { describe, it, expect, beforeEach, vi } from "vitest";
import { prismaMock } from "../prisma-mock";
import { SlackConnectionRepository } from "../../src/repositories/slack-connection.repository";

const repo = new SlackConnectionRepository();

const mockSlack = {
  id: "slack-1",
  userId: "user-1",
  teamId: "T12345",
  teamName: "MyTeam",
  channelId: "C12345",
  channelName: "#general",
  webhookUrl: "https://hooks.slack.com/services/xxx",
  accessToken: "xoxb-token",
  isActive: true,
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("SlackConnectionRepository", () => {
  describe("findByUser", () => {
    it("should return all slack connections for a user", async () => {
      prismaMock.slackConnection.findMany.mockResolvedValue([mockSlack]);

      const result = await repo.findByUser("user-1");

      expect(prismaMock.slackConnection.findMany).toHaveBeenCalledWith({
        where: { userId: "user-1" },
        orderBy: { createdAt: "desc" },
      });
      expect(result).toHaveLength(1);
      expect(result[0].teamId).toBe("T12345");
    });

    it("should return empty array when no connections exist", async () => {
      prismaMock.slackConnection.findMany.mockResolvedValue([]);

      const result = await repo.findByUser("user-2");

      expect(result).toHaveLength(0);
    });
  });

  describe("create", () => {
    it("should create and return a new slack connection", async () => {
      prismaMock.slackConnection.create.mockResolvedValue(mockSlack);

      const result = await repo.create({
        teamId: "T12345",
        teamName: "MyTeam",
        accessToken: "xoxb-token",
        user: { connect: { id: "user-1" } },
      });

      expect(prismaMock.slackConnection.create).toHaveBeenCalled();
      expect(result.teamId).toBe("T12345");
    });
  });

  describe("update", () => {
    it("should update and return the connection", async () => {
      const updated = { ...mockSlack, channelName: "#alerts" };
      prismaMock.slackConnection.update.mockResolvedValue(updated);

      const result = await repo.update("slack-1", { channelName: "#alerts" });

      expect(prismaMock.slackConnection.update).toHaveBeenCalledWith({
        where: { id: "slack-1" },
        data: { channelName: "#alerts" },
      });
      expect(result.channelName).toBe("#alerts");
    });
  });

  describe("delete", () => {
    it("should delete and return the connection", async () => {
      prismaMock.slackConnection.delete.mockResolvedValue(mockSlack);

      const result = await repo.delete("slack-1");

      expect(prismaMock.slackConnection.delete).toHaveBeenCalledWith({
        where: { id: "slack-1" },
      });
      expect(result.id).toBe("slack-1");
    });
  });
});
