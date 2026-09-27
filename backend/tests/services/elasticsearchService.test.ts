import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockIndex, mockSearch, mockExists } = vi.hoisted(() => ({
  mockIndex: vi.fn(),
  mockSearch: vi.fn(),
  mockExists: vi.fn(),
}));

vi.mock("@elastic/elasticsearch", () => ({
  Client: class {
    index = mockIndex;
    search = mockSearch;
    indices = { exists: mockExists };
  },
}));

import {
  EMAILS_INDEX,
  indexEmailDocument,
  searchEmails,
} from "../../src/services/elasticsearchService";

const document = {
  id: "email-1",
  userId: "user-1",
  senderEmail: "sender@example.com",
  recipientEmail: "recipient@example.com",
  subject: "Scheduled message",
  body: "Hello from the scheduler",
  status: "SCHEDULED",
  scheduledAt: new Date("2026-09-27T12:00:00Z"),
  sentAt: null,
  createdAt: new Date("2026-09-27T11:00:00Z"),
};

describe("Elasticsearch email index", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIndex.mockResolvedValue({});
    mockExists.mockResolvedValue(true);
    mockSearch.mockResolvedValue({
      hits: {
        total: { value: 1 },
        hits: [{ _source: document }],
      },
    });
  });

  it("upserts documents by email ID in the emails index", async () => {
    await indexEmailDocument(document);

    expect(mockIndex).toHaveBeenCalledWith({
      index: EMAILS_INDEX,
      id: document.id,
      document,
    });
  });

  it("does not throw when Elasticsearch is unavailable", async () => {
    mockIndex.mockRejectedValue(new Error("connection refused"));
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    await expect(indexEmailDocument(document)).resolves.toBeUndefined();
  });

  it("searches all requested fields and returns clean source documents", async () => {
    const results = await searchEmails("scheduler", "user-1");

    expect(mockSearch).toHaveBeenCalledWith({
      index: EMAILS_INDEX,
      size: 50,
      track_total_hits: true,
      query: {
        bool: {
          must: {
            multi_match: {
              query: "scheduler",
              fields: ["senderEmail", "recipientEmail", "subject", "body"],
            },
          },
          filter: { term: { userId: "user-1" } },
        },
      },
    });
    expect(results).toEqual({ count: 1, data: [document] });
  });

  it("returns an empty result when the emails index does not exist yet", async () => {
    mockExists.mockResolvedValue(false);

    await expect(searchEmails("anything", "user-1")).resolves.toEqual({ count: 0, data: [] });
    expect(mockSearch).not.toHaveBeenCalled();
  });
});