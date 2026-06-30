import type { Task, ApprovalRequest, AgentState, DailyBriefing } from '../types/index.js';

const API_URL = import.meta.env.VITE_API_URL ?? '';
const DEMO_USER_ID = 'demo-user';

export { API_URL, DEMO_USER_ID };

async function fetchApi<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error ?? 'API request failed');
  return json.data as T;
}

export const api = {
  getTasks: (userId = DEMO_USER_ID) =>
    fetchApi<Task[]>(`/api/tasks?userId=${userId}`),

  getApprovals: (userId = DEMO_USER_ID) =>
    fetchApi<ApprovalRequest[]>(`/api/approvals?userId=${userId}`),

  getAgents: () =>
    fetchApi<AgentState[]>('/api/agents'),

  getBriefing: (userId = DEMO_USER_ID) =>
    fetchApi<{ summary: string; briefing?: DailyBriefing }>(
      '/api/orchestrate/briefing',
      { method: 'POST', body: JSON.stringify({ userId }) },
    ),

  approve: (approvalId: string) =>
    fetchApi<ApprovalRequest>(
      `/api/approvals/${approvalId}/approve`,
      { method: 'POST', body: JSON.stringify({ resolvedBy: 'user' }) },
    ),

  reject: (approvalId: string) =>
    fetchApi<ApprovalRequest>(
      `/api/approvals/${approvalId}/reject`,
      { method: 'POST', body: JSON.stringify({ resolvedBy: 'user' }) },
    ),
};
