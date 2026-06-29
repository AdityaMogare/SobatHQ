import 'dotenv/config';
import { createServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { createMemoryStore } from './memory/store.js';
import { PreferencesService } from './memory/preferences.js';
import { TaskService } from './services/task.service.js';
import { ApprovalService } from './services/approval.service.js';
import { taskQueue } from './queue/task-queue.js';
import { toolRegistry } from './tools/registry.js';
import { createOrchestrator } from './agents/coordinator.js';
import { setAppContext, emitWsEvent } from './app/context.js';
import { logger } from './utils/logger.js';
import type { OrchestratorRequest } from './types/index.js';

async function bootstrap(): Promise<void> {
  const memoryStore = await createMemoryStore(env.REDIS_URL);
  const preferences = new PreferencesService(memoryStore);
  const taskService = new TaskService(memoryStore);
  const approvalService = new ApprovalService(memoryStore);
  const orchestrator = createOrchestrator();

  const app = createApp();
  const httpServer = createServer(app);

  const io = new SocketServer(httpServer, {
    cors: { origin: env.CORS_ORIGIN, credentials: true },
  });

  setAppContext({
    memoryStore,
    preferences,
    taskService,
    approvalService,
    taskQueue,
    toolRegistry,
    orchestrator,
    io,
    httpServer,
  });

  // Register queue handlers
  taskQueue.registerHandler('orchestrate', async (job) => {
    const payload = job.payload as unknown as OrchestratorRequest;
    emitWsEvent('orchestrator:progress', {
      requestId: job.id,
      step: 'processing',
      agent: 'coordinator',
    });
    return orchestrator.orchestrate(payload);
  });

  taskQueue.registerHandler('daily_briefing', async (job) => {
    const { userId } = job.payload as { userId: string };
    const result = await orchestrator.orchestrate({
      userId,
      message: "What's important today?",
    });
    if (result.briefing) {
      emitWsEvent('briefing:ready', result.briefing);
    }
    return result;
  });

  // WebSocket connection handling
  io.on('connection', (socket) => {
    logger.info({ socketId: socket.id }, 'Client connected');

    socket.on('subscribe', (userId: string) => {
      socket.join(`user:${userId}`);
      logger.debug({ socketId: socket.id, userId }, 'Client subscribed');
    });

    socket.on('disconnect', () => {
      logger.info({ socketId: socket.id }, 'Client disconnected');
    });
  });

  // Seed demo approvals for dashboard
  await seedDemoData(taskService, approvalService);

  httpServer.listen(env.PORT, () => {
    logger.info(
      {
        port: env.PORT,
        env: env.NODE_ENV,
        redis: !!env.REDIS_URL,
      },
      'SobatHQ backend started',
    );
  });

  const shutdown = async () => {
    logger.info('Shutting down...');
    await memoryStore.disconnect();
    httpServer.close();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

async function seedDemoData(
  taskService: TaskService,
  approvalService: ApprovalService,
): Promise<void> {
  const demoUserId = 'demo-user';

  await taskService.create({
    userId: demoUserId,
    title: 'Reply to Amazon recruiter',
    priority: 'urgent',
    source: 'gmail',
    assignedAgent: 'email',
  });

  await taskService.create({
    userId: demoUserId,
    title: 'Confirm Thursday interview',
    priority: 'high',
    source: 'calendar',
    assignedAgent: 'calendar',
  });

  await taskService.create({
    userId: demoUserId,
    title: 'Review weekly report',
    priority: 'medium',
    source: 'sheets',
    assignedAgent: 'reporting',
  });

  const task = await taskService.create({
    userId: demoUserId,
    title: 'Draft recruiter reply',
    priority: 'urgent',
    source: 'gmail',
    assignedAgent: 'email',
  });
  await taskService.updateStatus(task.id, 'awaiting_approval');

  const approval = await approvalService.create({
    userId: demoUserId,
    taskId: task.id,
    action: 'send_email',
    title: 'Reply to Amazon recruiter',
    description: 'Draft response confirming interview availability on Thursday at 2 PM',
    preview: {
      to: 'recruiter@amazon.com',
      subject: 'Re: Interview Invitation',
      body: 'Thank you for reaching out. I am available for an interview on Thursday at 2 PM. Please let me know if that works for your team.',
    },
  });

  logger.info({ approvalId: approval.id }, 'Demo data seeded');
}

bootstrap().catch((err) => {
  logger.fatal({ err }, 'Failed to start server');
  process.exit(1);
});
