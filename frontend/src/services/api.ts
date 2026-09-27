import type {
  ApiEnvelope,
  Email,
  EmailDetail,
  ScheduleEmailRequest,
  ScheduleEmailResponse,
  SearchResult,
  SlackStatus,
  User,
} from '../types/api';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...init,
      credentials: 'include',
      headers: {
        ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
        ...init?.headers,
      },
    });
  } catch {
    throw new Error('Could not reach the server. Check your connection and try again.');
  }

  const payload = await response.json().catch(() => ({})) as {
    status?: string;
    message?: string;
    data?: T;
  };

  if (!response.ok) {
    throw new Error(payload.message ?? `Request failed (${response.status})`);
  }
  return payload as T;
}

export const api = {
  async getCurrentUser(): Promise<User> {
    const result = await request<ApiEnvelope<User>>('/api/auth/me');
    return result.data;
  },
  async logout(): Promise<void> {
    await request('/api/auth/logout', { method: 'POST' });
  },
  async getEmails(kind: 'scheduled' | 'sent'): Promise<Email[]> {
    const result = await request<{ data: Email[] }>(`/api/emails/${kind}`);
    return result.data;
  },
  async searchEmails(query: string): Promise<SearchResult> {
    return request<SearchResult>(`/api/emails/search?q=${encodeURIComponent(query)}`);
  },
  async getEmail(id: string): Promise<EmailDetail> {
    const result = await request<ApiEnvelope<EmailDetail>>(`/api/emails/${encodeURIComponent(id)}`);
    return result.data;
  },
  async scheduleEmail(payload: ScheduleEmailRequest): Promise<ScheduleEmailResponse> {
    const result = await request<ApiEnvelope<ScheduleEmailResponse>>('/api/emails/schedule', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return result.data;
  },
  async getSlackStatus(): Promise<SlackStatus> {
    const result = await request<ApiEnvelope<SlackStatus>>('/api/slack/status');
    return result.data;
  },
  async disconnectSlack(): Promise<void> {
    await request('/api/slack/disconnect', { method: 'POST' });
  },
};