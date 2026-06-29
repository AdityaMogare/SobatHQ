export type AgentRole = 'coordinator' | 'email' | 'calendar' | 'documents' | 'slack' | 'reporting';
export type AgentStatus = 'idle' | 'thinking' | 'working' | 'waiting_approval' | 'error';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TaskStatus = 'pending' | 'queued' | 'in_progress' | 'awaiting_approval' | 'completed' | 'failed' | 'cancelled';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'expired';
export type ToolName = 'gmail' | 'calendar' | 'drive' | 'sheets' | 'slack';

export interface AgentState {
  id: string;
  role: AgentRole;
  name: string;
  status: AgentStatus;
  currentTask?: string;
  lastActiveAt: string;
}

export interface Task {
  id: string;
  userId: string;
  title: string;
  description?: string;
  priority: TaskPriority;
  status: TaskStatus;
  assignedAgent?: AgentRole;
  source: ToolName | 'user' | 'system';
  createdAt: string;
  updatedAt: string;
}

export interface ApprovalRequest {
  id: string;
  userId: string;
  taskId: string;
  action: string;
  title: string;
  description: string;
  preview: Record<string, unknown>;
  status: ApprovalStatus;
  createdAt: string;
}

export interface DailyBriefing {
  date: string;
  emailCount: number;
  highlights: Array<{ id: string; icon: string; title: string; priority: TaskPriority }>;
  meetings: Array<{ id: string; icon: string; title: string; priority: TaskPriority }>;
  followUps: Array<{ id: string; icon: string; title: string; priority: TaskPriority }>;
  reports: Array<{ id: string; icon: string; title: string; priority: TaskPriority }>;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}
