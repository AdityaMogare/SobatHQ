import { Router } from 'express';
import { getAppContext } from '../../app/context.js';
import { asyncHandler, successResponse } from '../middleware/error-handler.js';
import { createOrchestrator } from '../../agents/coordinator.js';
import type { AgentState } from '../../types/index.js';

export const agentsRouter = Router();

agentsRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const coordinator = createOrchestrator();
    const agents: AgentState[] = [
      coordinator.getState(),
      ...Array.from({ length: 5 }, (_, i) => {
        const roles = ['email', 'calendar', 'documents', 'reporting', 'slack'] as const;
        return {
          id: `agent_${i}`,
          role: roles[i],
          name: `${roles[i].charAt(0).toUpperCase() + roles[i].slice(1)} Agent`,
          status: 'idle' as const,
          lastActiveAt: new Date().toISOString(),
        };
      }),
    ];

    successResponse(res, agents);
  }),
);

export const toolsRouter = Router();

toolsRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const { toolRegistry } = getAppContext();
    successResponse(res, toolRegistry.listTools());
  }),
);

toolsRouter.post(
  '/:toolName/execute',
  asyncHandler(async (req, res) => {
    const { toolName } = req.params;
    const { action, params, userId, accessToken } = req.body;

    const { toolRegistry } = getAppContext();
    const result = await toolRegistry.execute(
      toolName as import('../../types/index.js').ToolName,
      action,
      params ?? {},
      { userId, accessToken },
    );

    successResponse(res, result);
  }),
);

export const healthRouter = Router();

healthRouter.get('/', (_req, res) => {
  const { taskQueue, qwen } = getAppContext();
  res.json({
    status: 'ok',
    service: 'sobathq-backend',
    version: '0.2.0',
    timestamp: new Date().toISOString(),
    queue: taskQueue.getStats(),
    integrations: {
      qwen: qwen.isConfigured(),
    },
  });
});
