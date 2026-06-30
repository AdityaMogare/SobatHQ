import type { Server as HttpServer } from 'http';
import type { CoordinatorAgent } from '../agents/coordinator.js';
import type { MemoryStore } from '../memory/types.js';
import type { PreferencesService } from '../memory/preferences.js';
import type { TaskQueue } from '../queue/task-queue.js';
import type { ApprovalService } from '../services/approval.service.js';
import type { TaskService } from '../services/task.service.js';
import type { ToolRegistry } from '../tools/registry.js';

export interface AppContext {
  memoryStore: MemoryStore;
  preferences: PreferencesService;
  taskService: TaskService;
  approvalService: ApprovalService;
  taskQueue: TaskQueue;
  toolRegistry: ToolRegistry;
  orchestrator: CoordinatorAgent;
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
