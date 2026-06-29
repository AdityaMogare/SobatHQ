import express from 'express';
import cors from 'cors';
import pinoHttp from 'pino-http';
import { env } from './config/env.js';
import { logger } from './utils/logger.js';
import {
  agentsRouter,
  toolsRouter,
  healthRouter,
  authRouter,
} from './api/routes/index.routes.js';
import { orchestrateRouter } from './api/routes/orchestrate.routes.js';
import { tasksRouter } from './api/routes/tasks.routes.js';
import { approvalsRouter } from './api/routes/approvals.routes.js';
import { errorHandler, notFoundHandler } from './api/middleware/error-handler.js';

export function createApp(): express.Application {
  const app = express();

  app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
  app.use(express.json());
  app.use(pinoHttp.default({ logger }));

  app.use('/health', healthRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/orchestrate', orchestrateRouter);
  app.use('/api/tasks', tasksRouter);
  app.use('/api/approvals', approvalsRouter);
  app.use('/api/agents', agentsRouter);
  app.use('/api/tools', toolsRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
