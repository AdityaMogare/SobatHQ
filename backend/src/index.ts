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
import { TokenStore } from './auth/token-store.js';
import { SessionService } from './auth/session.service.js';
import { ApiKeyService } from './auth/api-key.service.js';
import { OAuthStateService } from './auth/oauth-state.service.js';
import { GoogleOAuthService } from './auth/google.oauth.js';
import { SlackOAuthService } from './auth/slack.oauth.js';
import { QwenClient } from './integrations/qwen/client.js';
import { GmailService } from './integrations/google/gmail.service.js';
import { CalendarService } from './integrations/google/calendar.service.js';
import { DriveService } from './integrations/google/drive.service.js';
import { SheetsService } from './integrations/google/sheets.service.js';
import { SlackIntegrationService } from './integrations/slack/slack.service.js';

async function bootstrap(): Promise<void> {
  const memoryStore = await createMemoryStore(env.REDIS_URL);
  const preferences = new PreferencesService(memoryStore);
  const taskService = new TaskService(memoryStore);
  const approvalService = new ApprovalService(memoryStore);
  const orchestrator = createOrchestrator();

  // Auth & integrations
  const tokenStore = new TokenStore(memoryStore);
  const sessions = new SessionService(memoryStore);
  const apiKeys = new ApiKeyService(memoryStore);
  const oauthState = new OAuthStateService(memoryStore);
  const googleOAuth = new GoogleOAuthService(tokenStore, oauthState, sessions);
  const slackOAuth = new SlackOAuthService(tokenStore, oauthState, sessions);
  const qwen = new QwenClient();
  const gmailService = new GmailService(googleOAuth);
  const calendarService = new CalendarService(googleOAuth);
  const driveService = new DriveService(googleOAuth);
  const sheetsService = new SheetsService(googleOAuth);
  const slackIntegration = new SlackIntegrationService(slackOAuth);

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
    tokenStore,
    sessions,
    apiKeys,
    oauthState,
    googleOAuth,
    slackOAuth,
    qwen,
    gmailService,
    calendarService,
    driveService,
    sheetsService,
    slackIntegration,
    io,
    httpServer,
  });

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

  await seedDemoData(taskService, approvalService);

  httpServer.listen(env.PORT, () => {
    logger.info(
      {
        port: env.PORT,
        env: env.NODE_ENV,
        redis: !!env.REDIS_URL,
        qwen: qwen.isConfigured(),
        googleOAuth: !!env.GOOGLE_CLIENT_ID,
        slackOAuth: !!env.SLACK_CLIENT_ID,
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
