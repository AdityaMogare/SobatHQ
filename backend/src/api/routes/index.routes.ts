import { Router } from 'express';
import { getAppContext } from '../../app/context.js';
import { asyncHandler, successResponse } from '../middleware/error-handler.js';
import { createOrchestrator } from '../../agents/coordinator.js';
import type { AgentState } from '../../types/index.js';
import { env } from '../../config/env.js';

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
  const { taskQueue } = getAppContext();
  res.json({
    status: 'ok',
    service: 'sobathq-backend',
    version: '0.1.0',
    timestamp: new Date().toISOString(),
    queue: taskQueue.getStats(),
  });
});

export const authRouter = Router();

authRouter.get('/google', (_req, res) => {
  if (!env.GOOGLE_CLIENT_ID) {
    res.status(503).json({ success: false, error: 'Google OAuth not configured' });
    return;
  }

  const scopes = [
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/gmail.compose',
    'https://www.googleapis.com/auth/calendar.readonly',
    'https://www.googleapis.com/auth/drive.readonly',
    'https://www.googleapis.com/auth/spreadsheets.readonly',
  ];

  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: env.GOOGLE_REDIRECT_URI ?? '',
    response_type: 'code',
    scope: scopes.join(' '),
    access_type: 'offline',
    prompt: 'consent',
  });

  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
});

authRouter.get('/google/callback', asyncHandler(async (req, res) => {
  const { code } = req.query;
  if (!code) {
    res.status(400).json({ success: false, error: 'Authorization code missing' });
    return;
  }
  // TODO: Exchange code for tokens via googleapis
  successResponse(res, { message: 'Google OAuth callback received', code });
}));

authRouter.get('/slack', (_req, res) => {
  if (!env.SLACK_CLIENT_ID) {
    res.status(503).json({ success: false, error: 'Slack OAuth not configured' });
    return;
  }

  const params = new URLSearchParams({
    client_id: env.SLACK_CLIENT_ID,
    scope: 'channels:read,channels:history,chat:write,users:read,im:history,im:write',
    redirect_uri: env.SLACK_REDIRECT_URI ?? '',
  });

  res.redirect(`https://slack.com/oauth/v2/authorize?${params}`);
});

authRouter.get('/slack/callback', asyncHandler(async (req, res) => {
  const { code } = req.query;
  if (!code) {
    res.status(400).json({ success: false, error: 'Authorization code missing' });
    return;
  }
  // TODO: Exchange code for tokens via Slack API
  successResponse(res, { message: 'Slack OAuth callback received', code });
}));
