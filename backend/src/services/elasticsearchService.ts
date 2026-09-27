import { Client } from "@elastic/elasticsearch";
import { prisma } from "../config/database.js";
import { config } from "../config/index.js";

export const EMAILS_INDEX = "emails";

export interface EmailSearchDocument {
  id: string;
  userId: string;
  senderEmail: string;
  recipientEmail: string;
  subject: string;
  body: string;
  status: string;
  scheduledAt: Date;
  sentAt: Date | null;
  createdAt: Date;
}

const elasticsearch = new Client({
  node: config.elasticsearchUrl,
  maxRetries: 0,
  requestTimeout: 1500,
});

export async function checkElasticsearchConnection(): Promise<boolean> {
  try {
    await elasticsearch.ping();
    return true;
  } catch {
    return false;
  }
}

export async function closeElasticsearchConnection(): Promise<void> {
  await elasticsearch.close();
}

export async function indexEmailDocument(document: EmailSearchDocument): Promise<void> {
  try {
    await elasticsearch.index({
      index: EMAILS_INDEX,
      id: document.id,
      document,
    });
  } catch (error) {
    console.warn(JSON.stringify({
      event: "email.elasticsearch.index_failed",
      emailId: document.id,
      error: error instanceof Error ? error.message : String(error),
    }));
  }
}

/** Re-index the database source of truth after an email status transition. */
export async function syncEmailIndex(emailId: string): Promise<void> {
  try {
    const email = await prisma.emailMessage.findUnique({
      where: { id: emailId },
      include: { senderAccount: true },
    });
    if (!email) return;

    await indexEmailDocument({
      id: email.id,
      userId: email.senderAccount.userId,
      senderEmail: email.senderAccount.email,
      recipientEmail: email.recipientEmail,
      subject: email.subject,
      body: email.body,
      status: email.status,
      scheduledAt: email.scheduledAt,
      sentAt: email.sentAt,
      createdAt: email.createdAt,
    });
  } catch (error) {
    console.warn(JSON.stringify({
      event: "email.elasticsearch.sync_failed",
      emailId,
      error: error instanceof Error ? error.message : String(error),
    }));
  }
}

export async function searchEmails(query: string, userId: string): Promise<{
  count: number;
  data: EmailSearchDocument[];
}> {
  const exists = await elasticsearch.indices.exists({ index: EMAILS_INDEX });
  if (!exists) return { count: 0, data: [] };

  const response = await elasticsearch.search<EmailSearchDocument>({
    index: EMAILS_INDEX,
    size: 50,
    track_total_hits: true,
    query: {
      bool: {
        must: {
          multi_match: {
            query,
            fields: ["senderEmail", "recipientEmail", "subject", "body"],
          },
        },
        filter: { term: { userId } },
      },
    },
  });

  const total = response.hits.total;
  return {
    count: typeof total === "number" ? total : total?.value ?? 0,
    data: response.hits.hits.flatMap((hit) => hit._source ? [hit._source] : []),
  };
}