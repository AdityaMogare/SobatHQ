import type { Server as HttpServer } from 'http';
import type { CoordinatorAgent } from '../agents/coordinator.js';
import type { MemoryStore } from '../memory/types.js';
import type { PreferencesService } from '../memory/preferences.js';
import type { TaskQueue } from '../queue/task-queue.js';
import type { ApprovalService } from '../services/approval.service.js';
import type { TaskService } from '../services/task.service.js';
import type { ToolRegistry } from '../tools/registry.js';
import type { TokenStore } from '../auth/token-store.js';
import type { SessionService } from '../auth/session.service.js';
import type { ApiKeyService } from '../auth/api-key.service.js';
import type { OAuthStateService } from '../auth/oauth-state.service.js';
import type { GoogleOAuthService } from '../auth/google.oauth.js';
import type { SlackOAuthService } from '../auth/slack.oauth.js';
import type { QwenClient } from '../integrations/qwen/client.js';
import type { GmailService } from '../integrations/google/gmail.service.js';
import type { CalendarService } from '../integrations/google/calendar.service.js';
import type { DriveService } from '../integrations/google/drive.service.js';
import type { SheetsService } from '../integrations/google/sheets.service.js';
import type { SlackIntegrationService } from '../integrations/slack/slack.service.js';

export interface AppContext {
  memoryStore: MemoryStore;
  preferences: PreferencesService;
  taskService: TaskService;
  approvalService: ApprovalService;
  taskQueue: TaskQueue;
  toolRegistry: ToolRegistry;
  orchestrator: CoordinatorAgent;
  tokenStore: TokenStore;
  sessions: SessionService;
  apiKeys: ApiKeyService;
  oauthState: OAuthStateService;
  googleOAuth: GoogleOAuthService;
  slackOAuth: SlackOAuthService;
  qwen: QwenClient;
  gmailService: GmailService;
  calendarService: CalendarService;
  driveService: DriveService;
  sheetsService: SheetsService;
  slackIntegration: SlackIntegrationService;
  io?: import('socket.io').Server;
  httpServer?: HttpServer;
}

let ctx: AppContext | null = null;

export function setAppContext(context: AppContext): void {
  ctx = context;
}

export function getAppContext(): AppContext {
  if (!ctx) throw new Error('App context not initialized');
  return ctx;
}

export function emitWsEvent<K extends keyof import('../types/index.js').WsEventMap>(
  event: K,
  data: import('../types/index.js').WsEventMap[K],
): void {
  ctx?.io?.emit(event, data);
}
