import { Router } from 'express';
import { getAppContext, emitWsEvent } from '../../app/context.js';
import { asyncHandler, successResponse } from '../middleware/error-handler.js';
import type { OrchestratorRequest } from '../../types/index.js';

export const orchestrateRouter = Router();

orchestrateRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const { userId, message, context } = req.body as OrchestratorRequest;

    if (!userId || !message) {
      res.status(400).json({ success: false, error: 'userId and message are required' });
      return;
    }

    const { orchestrator, taskQueue } = getAppContext();

    const job = await taskQueue.enqueue('orchestrate', { userId, message, context });

    emitWsEvent('orchestrator:progress', {
      requestId: job.id,
      step: 'queued',
      agent: 'coordinator',
    });

    const result = await orchestrator.orchestrate({ userId, message, context });

    emitWsEvent('orchestrator:progress', {
      requestId: job.id,
      step: 'completed',
      agent: 'coordinator',
    });

    if (result.briefing) {
      emitWsEvent('briefing:ready', result.briefing);
    }

    successResponse(res, result);
  }),
);

orchestrateRouter.post(
  '/briefing',
  asyncHandler(async (req, res) => {
    const { userId } = req.body as { userId: string };
    if (!userId) {
      res.status(400).json({ success: false, error: 'userId is required' });
      return;
    }

    const { orchestrator } = getAppContext();
    const result = await orchestrator.orchestrate({
      userId,
      message: "What's important today?",
      context: { source: 'api' },
    });

    if (result.briefing) {
      emitWsEvent('briefing:ready', result.briefing);
    }

    successResponse(res, result);
  }),
);
