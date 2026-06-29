import { v4 as uuidv4 } from 'uuid';
import { createChildLogger } from '../utils/logger.js';
import type { Task, TaskPriority, TaskStatus, ToolName } from '../types/index.js';
import { buildKey, MemoryNamespaces, type MemoryStore } from '../memory/types.js';

const log = createChildLogger('services:tasks');

export class TaskService {
  constructor(private store: MemoryStore) {}

  private key(taskId: string): string {
    return buildKey(MemoryNamespaces.TASK, taskId);
  }

  private userIndexKey(userId: string): string {
    return buildKey(MemoryNamespaces.TASK, 'user', userId);
  }

  async create(params: {
    userId: string;
    title: string;
    description?: string;
    priority?: TaskPriority;
    source?: ToolName | 'user' | 'system';
    assignedAgent?: Task['assignedAgent'];
    payload?: Record<string, unknown>;
  }): Promise<Task> {
    const now = new Date().toISOString();
    const task: Task = {
      id: uuidv4(),
      userId: params.userId,
      title: params.title,
      description: params.description,
      priority: params.priority ?? 'medium',
      status: 'pending',
      assignedAgent: params.assignedAgent,
      source: params.source ?? 'system',
      payload: params.payload,
      createdAt: now,
      updatedAt: now,
    };

    await this.store.set(this.key(task.id), task);
    await this.store.increment(this.userIndexKey(params.userId));

    log.info({ taskId: task.id, userId: params.userId }, 'Task created');
    return task;
  }

  async get(taskId: string): Promise<Task | null> {
    return this.store.get<Task>(this.key(taskId));
  }

  async updateStatus(taskId: string, status: TaskStatus, result?: Record<string, unknown>, error?: string): Promise<Task | null> {
    const task = await this.get(taskId);
    if (!task) return null;

    task.status = status;
    task.updatedAt = new Date().toISOString();
    if (result) task.result = result;
    if (error) task.error = error;
    if (status === 'completed' || status === 'failed') {
      task.completedAt = new Date().toISOString();
    }

    await this.store.set(this.key(taskId), task);
    log.info({ taskId, status }, 'Task status updated');
    return task;
  }

  async listByUser(userId: string, status?: TaskStatus): Promise<Task[]> {
    const pattern = buildKey(MemoryNamespaces.TASK, '*');
    const keys = await this.store.keys(pattern);
    const taskKeys = keys.filter((k) => !k.includes(':user:'));

    const tasks = await this.store.mget<Task>(taskKeys);
    return tasks
      .filter((t): t is Task => t !== null && t.userId === userId)
      .filter((t) => !status || t.status === status)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }
}
