export interface User {
  id: string;
  email: string;
  name: string | null;
  avatar: string | null;
}

export type EmailStatus = 'SCHEDULED' | 'PROCESSING' | 'SENT' | 'FAILED';

export interface Email {
  id: string;
  recipientEmail: string;
  subject: string;
  body?: string;
  status: EmailStatus;
  scheduledAt: string;
  sentAt: string | null;
  errorMessage?: string | null;
  previewUrl?: string | null;
  messageId?: string | null;
}

export interface EmailDetail extends Omit<Email, 'recipientEmail' | 'errorMessage'> {
  recipient: string;
  error: string | null;
  previewUrl: string | null;
}

export interface ScheduleEmailRequest {
  senderEmail: string;
  recipients: string[];
  subject: string;
  body: string;
  startTime: string;
  delayBetweenEmails: number;
  hourlyLimit: number;
}

export interface ScheduleEmailResponse {
  scheduled: number;
  campaignId: string;
  emailIds: string[];
  firstSendAt: string;
  lastSendAt: string;
}

export interface SearchResult {
  count: number;
  data: Array<{
    id: string;
    userId: string;
    senderEmail: string;
    recipientEmail: string;
    subject: string;
    body: string;
    status: EmailStatus;
    scheduledAt: string;
    sentAt: string | null;
    createdAt: string;
  }>;
}

export interface SlackStatus {
  connected: boolean;
  connections: Array<{
    id: string;
    teamId: string;
    teamName: string | null;
    channelId: string | null;
    channelName: string | null;
    isActive: boolean;
    createdAt: string;
  }>;
}

export interface ApiEnvelope<T> {
  status: 'success' | 'error';
  message?: string;
  data: T;
}