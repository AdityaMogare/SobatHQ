import type { Request, Response, NextFunction } from 'express';
import type { SessionService } from '../../auth/session.service.js';
import type { ApiKeyService } from '../../auth/api-key.service.js';
import { SESSION_COOKIE, isApiKeyFormat } from '../../auth/crypto.js';
import { AuthError } from '../../auth/errors.js';

export interface AuthenticatedRequest extends Request {
  userId: string;
  authMethod: 'session' | 'api_key';
  apiKeyId?: string;
  sessionId?: string;
}

export function createAuthMiddleware(sessions: SessionService, apiKeys: ApiKeyService) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const apiKeyHeader = req.headers['x-api-key'] as string | undefined;
      const authHeader = req.headers.authorization;
      const bearerKey = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
      const rawApiKey = apiKeyHeader ?? (bearerKey && isApiKeyFormat(bearerKey) ? bearerKey : undefined);

      if (rawApiKey) {
        const record = await apiKeys.authenticate(rawApiKey);
        (req as AuthenticatedRequest).userId = record.userId;
        (req as AuthenticatedRequest).authMethod = 'api_key';
        (req as AuthenticatedRequest).apiKeyId = record.id;
        next();
        return;
      }

      const sessionId = req.cookies?.[SESSION_COOKIE] as string | undefined;
      if (sessionId) {
        const session = await sessions.require(sessionId);
        (req as AuthenticatedRequest).userId = session.userId;
        (req as AuthenticatedRequest).authMethod = 'session';
        (req as AuthenticatedRequest).sessionId = sessionId;
        next();
        return;
      }

      throw new AuthError('Authentication required', 'UNAUTHORIZED');
    } catch (err) {
      if (err instanceof AuthError) {
        res.status(err.statusCode).json({ success: false, error: err.message, code: err.code });
        return;
      }
      next(err);
    }
  };
}

export function optionalAuth(sessions: SessionService, apiKeys: ApiKeyService) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const middleware = createAuthMiddleware(sessions, apiKeys);
      await middleware(req, _res, next);
    } catch {
      next();
    }
  };
}
