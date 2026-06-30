import { v4 as uuidv4 } from 'uuid';
import type { AgentRole, AgentState, AgentStatus } from '../types/index.js';

export abstract class BaseAgent {
  readonly id: string;
  abstract readonly role: AgentRole;
  abstract readonly name: string;

  protected status: AgentStatus = 'idle';
  protected currentTask?: string;
  protected lastActiveAt: string;

  constructor() {
    this.id = uuidv4();
    this.lastActiveAt = new Date().toISOString();
  }

  getState(): AgentState {
    return {
      id: this.id,
      role: this.role,
      name: this.name,
      status: this.status,
      currentTask: this.currentTask,
      lastActiveAt: this.lastActiveAt,
    };
  }

  protected setStatus(status: AgentStatus, task?: string): void {
    this.status = status;
    this.currentTask = task;
    this.lastActiveAt = new Date().toISOString();
  }

  abstract process(input: Record<string, unknown>): Promise<Record<string, unknown>>;
}
