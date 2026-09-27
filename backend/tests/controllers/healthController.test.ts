import { beforeEach, describe, expect, it, vi } from "vitest";

const { checkDatabaseConnection, checkRedisConnection, checkElasticsearchConnection } = vi.hoisted(() => ({
  checkDatabaseConnection: vi.fn(),
  checkRedisConnection: vi.fn(),
  checkElasticsearchConnection: vi.fn(),
}));

vi.mock("../../src/config/database.js", () => ({ checkDatabaseConnection }));
vi.mock("../../src/config/redis.js", () => ({ checkRedisConnection }));
vi.mock("../../src/services/elasticsearchService.js", () => ({ checkElasticsearchConnection }));

import { getHealth } from "../../src/controllers/healthController";

describe("GET /health controller", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns core dependency status even when Elasticsearch is unavailable", async () => {
    checkDatabaseConnection.mockResolvedValue(true);
    checkRedisConnection.mockResolvedValue(true);
    checkElasticsearchConnection.mockResolvedValue(false);
    const response = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };

    await getHealth({} as never, response as never);

    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.json).toHaveBeenCalledWith({
      status: "ok",
      components: {
        application: "ok",
        mysql: "ok",
        redis: "ok",
        elasticsearch: "unavailable",
      },
    });
  });
});