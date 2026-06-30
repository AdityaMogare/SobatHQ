import { Router } from 'express';
import { getAppContext } from '../../app/context.js';
import { asyncHandler, successResponse } from '../middleware/error-handler.js';
import { createAuthMiddleware, type AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { OAuthError } from '../../auth/errors.js';
import { SESSION_COOKIE } from '../../auth/crypto.js';
import { env } from '../../config/env.js';

export const authRouter = Router();

authRouter.get(
  '/google',
  asyncHandler(async (req, res) => {
    const { googleOAuth } = getAppContext();
    const userId = req.query.userId as string | undefined;
    const redirectTo = req.query.redirectTo as string | undefined;
    const url = await googleOAuth.getAuthorizationUrl({ userId, redirectTo });
    res.redirect(url);
  }),
);

authRouter.get(
  '/google/callback',
  asyncHandler(async (req, res) => {
    const { googleOAuth } = getAppContext();
    const code = req.query.code as string | undefined;
    const state = req.query.state as string | undefined;
    const error = req.query.error as string | undefined;

    if (error) {
      const redirectUrl = new URL(`${env.FRONTEND_URL}/settings/integrations`);
      redirectUrl.searchParams.set('connected', 'google');
      redirectUrl.searchParams.set('status', 'error');
      redirectUrl.searchParams.set('message', error);
      res.redirect(redirectUrl.toString());
      return;
    }

    if (!code || !state) {
      res.status(400).json({ success: false, error: 'Authorization code or state missing' });
      return;
    }

    try {
      await googleOAuth.handleCallback(code, state, res);
    } catch (err) {
      if (err instanceof OAuthError) {
        const redirectUrl = new URL(`${env.FRONTEND_URL}/settings/integrations`);
        redirectUrl.searchParams.set('connected', 'google');
        redirectUrl.searchParams.set('status', 'error');
        redirectUrl.searchParams.set('message', err.message);
        res.redirect(redirectUrl.toString());
        return;
      }
      throw err;
    }
  }),
);

authRouter.get(
  '/slack',
  asyncHandler(async (req, res) => {
    const { slackOAuth } = getAppContext();
    const userId = req.query.userId as string | undefined;
    const redirectTo = req.query.redirectTo as string | undefined;
    const url = await slackOAuth.getAuthorizationUrl({ userId, redirectTo });
    res.redirect(url);
  }),
);

authRouter.get(
  '/slack/callback',
  asyncHandler(async (req, res) => {
    const { slackOAuth } = getAppContext();
    const code = req.query.code as string | undefined;
    const state = req.query.state as string | undefined;
    const error = req.query.error as string | undefined;

    if (error) {
      const redirectUrl = new URL(`${env.FRONTEND_URL}/settings/integrations`);
      redirectUrl.searchParams.set('connected', 'slack');
      redirectUrl.searchParams.set('status', 'error');
      redirectUrl.searchParams.set('message', error);
      res.redirect(redirectUrl.toString());
      return;
    }

    if (!code || !state) {
      res.status(400).json({ success: false, error: 'Authorization code or state missing' });
      return;
    }

    try {
      await slackOAuth.handleCallback(code, state, res);
    } catch (err) {
      if (err instanceof OAuthError) {
        const redirectUrl = new URL(`${env.FRONTEND_URL}/settings/integrations`);
        redirectUrl.searchParams.set('connected', 'slack');
        redirectUrl.searchParams.set('status', 'error');
        redirectUrl.searchParams.set('message', err.message);
        res.redirect(redirectUrl.toString());
        return;
      }
      throw err;
    }
  }),
);

authRouter.get(
  '/me',
  asyncHandler(async (req, res, next) => {
    const { sessions, apiKeys, tokenStore } = getAppContext();
    await createAuthMiddleware(sessions, apiKeys)(req, res, next);
  }),
  asyncHandler(async (req, res) => {
    const { tokenStore } = getAppContext();
    const { userId } = req as AuthenticatedRequest;
    const user = await tokenStore.getUser(userId);
    const integrations = await tokenStore.getIntegrationStatuses(userId);

    successResponse(res, {
      user,
      integrations: integrations.filter((i) => i.provider === 'google' || i.provider === 'slack'),
    });
  }),
);

authRouter.post(
  '/logout',
  asyncHandler(async (req, res) => {
    const { sessions } = getAppContext();
    const sessionId = req.cookies?.[SESSION_COOKIE] as string | undefined;

    if (sessionId) {
      await sessions.destroy(sessionId);
    }

    res.clearCookie(SESSION_COOKIE, { path: '/' });
    successResponse(res, { loggedOut: true });
  }),
);
