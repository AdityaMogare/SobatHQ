import { Router } from 'express';
import { getAppContext } from '../../app/context.js';
import { asyncHandler, successResponse } from '../middleware/error-handler.js';
import { createAuthMiddleware, type AuthenticatedRequest } from '../middleware/auth.middleware.js';
import type { OAuthProvider } from '../../auth/types.js';

export const integrationsRouter = Router();

const requireAuth = (req: Parameters<ReturnType<typeof createAuthMiddleware>>[0], res: Parameters<ReturnType<typeof createAuthMiddleware>>[1], next: Parameters<ReturnType<typeof createAuthMiddleware>>[2]) => {
  const { sessions, apiKeys } = getAppContext();
  return createAuthMiddleware(sessions, apiKeys)(req, res, next);
};

integrationsRouter.use(requireAuth);

integrationsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const { tokenStore } = getAppContext();
    const { userId } = req as AuthenticatedRequest;
    const statuses = await tokenStore.getIntegrationStatuses(userId);
    successResponse(res, statuses);
  }),
);

integrationsRouter.delete(
  '/:provider',
  asyncHandler(async (req, res) => {
    const { tokenStore } = getAppContext();
    const { userId } = req as AuthenticatedRequest;
    const provider = req.params.provider as OAuthProvider;

    if (provider !== 'google' && provider !== 'slack') {
      res.status(400).json({ success: false, error: 'Invalid provider. Use google or slack.' });
      return;
    }

    await tokenStore.deleteTokens(userId, provider);
    successResponse(res, { disconnected: provider });
  }),
);

// ─── Google service boilerplate endpoints ───────────────────────────────────

integrationsRouter.get(
  '/gmail/unread',
  asyncHandler(async (req, res) => {
    const { gmailService } = getAppContext();
    const { userId } = req as AuthenticatedRequest;
    const maxResults = Number(req.query.maxResults ?? 20);
    const result = await gmailService.listUnread(userId, maxResults);
    successResponse(res, result);
  }),
);

integrationsRouter.get(
  '/calendar/today',
  asyncHandler(async (req, res) => {
    const { calendarService } = getAppContext();
    const { userId } = req as AuthenticatedRequest;
    const result = await calendarService.listToday(userId);
    successResponse(res, result);
  }),
);

integrationsRouter.get(
  '/drive/recent',
  asyncHandler(async (req, res) => {
    const { driveService } = getAppContext();
    const { userId } = req as AuthenticatedRequest;
    const result = await driveService.listRecent(userId);
    successResponse(res, result);
  }),
);

integrationsRouter.get(
  '/sheets/:spreadsheetId',
  asyncHandler(async (req, res) => {
    const { sheetsService } = getAppContext();
    const { userId } = req as AuthenticatedRequest;
    const result = await sheetsService.getSpreadsheet(userId, String(req.params.spreadsheetId));
    successResponse(res, result);
  }),
);

integrationsRouter.get(
  '/slack/channels',
  asyncHandler(async (req, res) => {
    const { slackIntegration } = getAppContext();
    const { userId } = req as AuthenticatedRequest;
    const result = await slackIntegration.listChannels(userId);
    successResponse(res, result);
  }),
);
