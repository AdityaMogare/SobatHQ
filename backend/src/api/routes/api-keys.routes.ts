import { Router } from 'express';
import { getAppContext } from '../../app/context.js';
import { asyncHandler, successResponse } from '../middleware/error-handler.js';
import { createAuthMiddleware, type AuthenticatedRequest } from '../middleware/auth.middleware.js';

export const apiKeysRouter = Router();

const requireAuth = (req: Parameters<ReturnType<typeof createAuthMiddleware>>[0], res: Parameters<ReturnType<typeof createAuthMiddleware>>[1], next: Parameters<ReturnType<typeof createAuthMiddleware>>[2]) => {
  const { sessions, apiKeys } = getAppContext();
  return createAuthMiddleware(sessions, apiKeys)(req, res, next);
};

apiKeysRouter.use(requireAuth);

apiKeysRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const { apiKeys } = getAppContext();
    const { userId } = req as AuthenticatedRequest;
    const keys = await apiKeys.listByUser(userId);

    successResponse(
      res,
      keys.map((k) => ({
        id: k.id,
        name: k.name,
        prefix: k.prefix,
        scopes: k.scopes,
        lastUsedAt: k.lastUsedAt,
        expiresAt: k.expiresAt,
        createdAt: k.createdAt,
      })),
    );
  }),
);

apiKeysRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const { apiKeys } = getAppContext();
    const { userId } = req as AuthenticatedRequest;
    const { name, scopes, expiresInDays } = req.body as {
      name: string;
      scopes?: string[];
      expiresInDays?: number;
    };

    if (!name) {
      res.status(400).json({ success: false, error: 'name is required' });
      return;
    }

    const { apiKey, rawKey } = await apiKeys.create({ userId, name, scopes, expiresInDays });

    successResponse(
      res,
      {
        id: apiKey.id,
        name: apiKey.name,
        prefix: apiKey.prefix,
        scopes: apiKey.scopes,
        key: rawKey,
        expiresAt: apiKey.expiresAt,
        createdAt: apiKey.createdAt,
        warning: 'Store this key securely. It will not be shown again.',
      },
      201,
    );
  }),
);

apiKeysRouter.delete(
  '/:keyId',
  asyncHandler(async (req, res) => {
    const { apiKeys } = getAppContext();
    const { userId } = req as AuthenticatedRequest;
    const revoked = await apiKeys.revoke(userId, String(req.params.keyId));

    if (!revoked) {
      res.status(404).json({ success: false, error: 'API key not found' });
      return;
    }

    successResponse(res, { revoked: true });
  }),
);
