import { z } from 'zod';

// ─── Agent Types ───────────────────────────────────────────────────────────

export const AgentRoleSchema = z.enum([
  'coordinator',
  'email',
  'calendar',
  'documents',
  'slack',
  'reporting',
]);
export type AgentRole = z.infer<typeof AgentRoleSchema>;

export const AgentStatusSchema = z.enum([
  'idle',
  'thinking',
  'working',
  'waiting_approval',
  'error',
]);
export type AgentStatus = z.infer<typeof AgentStatusSchema>;

export interface AgentState {
  id: string;
  role: AgentRole;
  name: string;
  status: AgentStatus;
  currentTask?: string;
  lastActiveAt: string;
  metadata?: Record<string, unknown>;
}

// ─── Task Types ────────────────────────────────────────────────────────────

export const TaskPrioritySchema = z.enum(['low', 'medium', 'high', 'urgent']);
export type TaskPriority = z.infer<typeof TaskPrioritySchema>;

export const TaskStatusSchema = z.enum([
  'pending',
  'queued',
  'in_progress',
  'awaiting_approval',
  'completed',
  'failed',
  'cancelled',
]);
export type TaskStatus = z.infer<typeof TaskStatusSchema>;

export interface Task {
  id: string;
  userId: string;
  title: string;
  description?: string;
  priority: TaskPriority;
  status: TaskStatus;
  assignedAgent?: AgentRole;
  source: ToolName | 'user' | 'system';
  payload?: Record<string, unknown>;
  result?: Record<string, unknown>;
  error?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

// ─── Approval Types ────────────────────────────────────────────────────────

export const ApprovalActionSchema = z.enum([
  'send_email',
  'reply_slack',
  'create_event',
  'update_sheet',
  'share_document',
  'custom',
]);
export type ApprovalAction = z.infer<typeof ApprovalActionSchema>;

export const ApprovalStatusSchema = z.enum(['pending', 'approved', 'rejected', 'expired']);
export type ApprovalStatus = z.infer<typeof ApprovalStatusSchema>;

export interface ApprovalRequest {
  id: string;
  userId: string;
  taskId: string;
  action: ApprovalAction;
  title: string;
  description: string;
  preview: Record<string, unknown>;
  status: ApprovalStatus;
  createdAt: string;
  resolvedAt?: string;
  resolvedBy?: string;
}

// ─── Tool Types ────────────────────────────────────────────────────────────

export const ToolNameSchema = z.enum(['gmail', 'calendar', 'drive', 'sheets', 'slack']);
export type ToolName = z.infer<typeof ToolNameSchema>;

export interface ToolContext {
  userId: string;
  accessToken?: string;
  refreshToken?: string;
}

export interface ToolResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface ToolDefinition {
  name: ToolName;
  displayName: string;
  description: string;
  requiredScopes: string[];
  actions: string[];
}

// ─── Orchestration Types ───────────────────────────────────────────────────

export interface OrchestratorRequest {
  userId: string;
  message: string;
  context?: {
    source?: 'dashboard' | 'slack' | 'api';
    channelId?: string;
    threadTs?: string;
  };
}

export interface OrchestratorResponse {
  requestId: string;
  summary: string;
  briefing?: DailyBriefing;
  suggestedActions: SuggestedAction[];
  tasksCreated: string[];
  approvalsRequired: string[];
}

export interface SuggestedAction {
  id: string;
  label: string;
  description: string;
  action: ApprovalAction;
  priority: TaskPriority;
  tool: ToolName;
}

export interface DailyBriefing {
  date: string;
  emailCount: number;
  highlights: BriefingItem[];
  meetings: BriefingItem[];
  followUps: BriefingItem[];
  reports: BriefingItem[];
}

export interface BriefingItem {
  id: string;
  icon: string;
  title: string;
  description?: string;
  priority: TaskPriority;
  source: ToolName;
}

// ─── Memory Types ──────────────────────────────────────────────────────────

export interface UserPreferences {
  userId: string;
  timezone: string;
  workingHours: { start: string; end: string };
  emailDigestFrequency: 'realtime' | 'hourly' | 'daily';
  autoDraftReplies: boolean;
  notificationChannels: ('dashboard' | 'slack' | 'email')[];
  customRules: string[];
  updatedAt: string;
}

export interface MemoryEntry {
  key: string;
  value: unknown;
  ttl?: number;
  createdAt: string;
  updatedAt: string;
}

// ─── API Types ─────────────────────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
  };
}

// ─── WebSocket Events ──────────────────────────────────────────────────────

export interface WsEventMap {
  'agent:status': AgentState;
  'task:updated': Task;
  'approval:new': ApprovalRequest;
  'approval:resolved': ApprovalRequest;
  'briefing:ready': DailyBriefing;
  'orchestrator:progress': { requestId: string; step: string; agent: AgentRole };
}

export type WsEventType = keyof WsEventMap;

// ─── User / Auth Types ─────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  connectedIntegrations: Partial<Record<ToolName, { connectedAt: string; scopes: string[] }>>;
  createdAt: string;
}

export interface OAuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
  scopes: string[];
}
