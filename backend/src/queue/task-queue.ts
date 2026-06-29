import { v4 as uuidv4 } from 'uuid';
import { createChildLogger } from '../utils/logger.js';

const log = createChildLogger('queue:task');

export type QueueJobStatus = 'waiting' | 'active' | 'completed' | 'failed';

export interface QueueJob<T = Record<string, unknown>> {
  id: string;
  type: string;
  payload: T;
  status: QueueJobStatus;
  attempts: number;
  maxAttempts: number;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  error?: string;
  result?: unknown;
}

export type JobHandler<T = Record<string, unknown>> = (job: QueueJob<T>) => Promise<unknown>;

export class TaskQueue {
  private handlers = new Map<string, JobHandler>();
  private queue: QueueJob[] = [];
  private processing = false;
  private concurrency: number;
  private activeCount = 0;

  constructor(concurrency = 3) {
    this.concurrency = concurrency;
  }

  registerHandler<T extends Record<string, unknown>>(type: string, handler: JobHandler<T>): void {
    this.handlers.set(type, handler as JobHandler);
    log.info({ type }, 'Job handler registered');
  }

  async enqueue<T extends Record<string, unknown>>(
    type: string,
    payload: T,
    maxAttempts = 3,
  ): Promise<QueueJob<T>> {
    const job: QueueJob<T> = {
      id: uuidv4(),
      type,
      payload,
      status: 'waiting',
      attempts: 0,
      maxAttempts,
      createdAt: new Date().toISOString(),
    };

    this.queue.push(job as QueueJob);
    log.info({ jobId: job.id, type }, 'Job enqueued');

    this.processNext();
    return job;
  }

  getJob(jobId: string): QueueJob | undefined {
    return this.queue.find((j) => j.id === jobId);
  }

  getStats(): { waiting: number; active: number; completed: number; failed: number } {
    return {
      waiting: this.queue.filter((j) => j.status === 'waiting').length,
      active: this.queue.filter((j) => j.status === 'active').length,
      completed: this.queue.filter((j) => j.status === 'completed').length,
      failed: this.queue.filter((j) => j.status === 'failed').length,
    };
  }

  listJobs(status?: QueueJobStatus): QueueJob[] {
    return status ? this.queue.filter((j) => j.status === status) : [...this.queue];
  }

  private async processNext(): Promise<void> {
    if (this.processing) return;
    this.processing = true;

    while (this.activeCount < this.concurrency) {
      const job = this.queue.find((j) => j.status === 'waiting');
      if (!job) break;

      this.activeCount++;
      job.status = 'active';
      job.startedAt = new Date().toISOString();
      job.attempts++;

      this.executeJob(job).finally(() => {
        this.activeCount--;
        this.processNext();
      });
    }

    this.processing = false;
  }

  private async executeJob(job: QueueJob): Promise<void> {
    const handler = this.handlers.get(job.type);
    if (!handler) {
      job.status = 'failed';
      job.error = `No handler for job type: ${job.type}`;
      job.completedAt = new Date().toISOString();
      log.error({ jobId: job.id, type: job.type }, job.error);
      return;
    }

    try {
      job.result = await handler(job);
      job.status = 'completed';
      job.completedAt = new Date().toISOString();
      log.info({ jobId: job.id, type: job.type }, 'Job completed');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      if (job.attempts < job.maxAttempts) {
        job.status = 'waiting';
        log.warn({ jobId: job.id, attempt: job.attempts }, 'Job failed, retrying');
      } else {
        job.status = 'failed';
        job.error = message;
        job.completedAt = new Date().toISOString();
        log.error({ jobId: job.id, err: message }, 'Job failed permanently');
      }
    }
  }
}

export const taskQueue = new TaskQueue();
