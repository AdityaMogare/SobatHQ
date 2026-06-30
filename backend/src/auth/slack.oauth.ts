import { v4 as uuidv4 } from 'uuid';
import type { Response } from 'express';
import { env } from '../config/env.js';
import { createChildLogger } from '../utils/logger.js';
import type { OAuthStateService } from './oauth-state.service.js';
import type { SessionService } from './session.service.js';
import type { TokenStore } from './token-store.js';
import type { StoredOAuthTokens } from './types.js';
import { OAuthError } from './errors.js';
import { SESSION_COOKIE, SESSION_TTL_SECONDS } from './crypto.js';

const log = createChildLogger('auth:slack');

export const SLACK_SCOPES = [
  'channels:read',
  'channels:history',
  'chat:write',
  'users:read',
  'im:history',
  'im:read',
  'im:write',
  'groups:read',
  'groups:history',
];

interface SlackOAuthResponse {
  ok: boolean;
  error?: string;
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
  authed_user?: {
    id: string;
    access_token?: string;
    scope?: string;
  };
  team?: {
    id: string;
    name: string;
  };
  bot_user_id?: string;
}

interface SlackUserInfoResponse {
  ok: boolean;
  error?: string;
  user?: {
    id: string;
    name: string;
    real_name?: string;
    profile?: { email?: string; image_192?: string };
  };
}

export class SlackOAuthService {
  constructor(
    private tokenStore: TokenStore,
    private oauthState: OAuthStateService,
    private sessions: SessionService,
  ) {}

  async getAuthorizationUrl(params?: { userId?: string; redirectTo?: string }): Promise<string> {
    if (!env.SLACK_CLIENT_ID) {
      throw new OAuthError('Slack OAuth not configured', 'slack', 'NOT_CONFIGURED', 503);
    }

    const state = await this.oauthState.create({
      provider: 'slack',
      userId: params?.userId,
      redirectTo: params?.redirectTo,
    });

    const params_ = new URLSearchParams({
      client_id: env.SLACK_CLIENT_ID,
      scope: SLACK_SCOPES.join(','),
      user_scope: 'identity.basic,identity.email',
      redirect_uri: env.SLACK_REDIRECT_URI,
      state,
    });

    return `https://slack.com/oauth/v2/authorize?${params_}`;
  }

  async handleCallback(code: string, state: string, res: Response): Promise<void> {
    const statePayload = await this.oauthState.consume(state, 'slack');

    if (!env.SLACK_CLIENT_ID || !env.SLACK_CLIENT_SECRET) {
      throw new OAuthError('Slack OAuth not configured', 'slack', 'NOT_CONFIGURED', 503);
    }

    let data: SlackOAuthResponse;
    try {
      const response = await fetch('https://slack.com/api/oauth.v2.access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: env.SLACK_CLIENT_ID,
          client_secret: env.SLACK_CLIENT_SECRET,
          code,
          redirect_uri: env.SLACK_REDIRECT_URI,
        }),
      });
      data = (await response.json()) as SlackOAuthResponse;
    } catch (err) {
      log.error({ err }, 'Slack token exchange request failed');
      throw new OAuthError('Failed to exchange Slack authorization code', 'slack', 'TOKEN_EXCHANGE_FAILED', 400, err);
    }

    if (!data.ok || !data.access_token) {
      throw new OAuthError(
        data.error ?? 'Slack OAuth failed',
        'slack',
        'SLACK_OAUTH_ERROR',
        400,
      );
    }

    const userToken = data.authed_user?.access_token ?? data.access_token;
    let profile: SlackUserInfoResponse['user'];

    try {
      const userInfoRes = await fetch('https://slack.com/api/users.identity', {
        headers: { Authorization: `Bearer ${userToken}` },
      });
      const userInfo = (await userInfoRes.json()) as SlackUserInfoResponse;
      if (userInfo.ok) profile = userInfo.user;
    } catch (err) {
      log.warn({ err }, 'Failed to fetch Slack user identity');
    }

    const userId = statePayload.userId ?? data.authed_user?.id ?? uuidv4();
    const now = new Date().toISOString();
    const expiresAt = data.expires_in ? Date.now() + data.expires_in * 1000 : undefined;

    const stored: StoredOAuthTokens = {
      provider: 'slack',
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt,
      scopes: data.scope?.split(',') ?? SLACK_SCOPES,
      metadata: {
        email: profile?.profile?.email,
        name: profile?.real_name ?? profile?.name,
        picture: profile?.profile?.image_192,
        slackUserId: data.authed_user?.id ?? profile?.id,
        slackTeamId: data.team?.id,
        slackTeamName: data.team?.name,
        botUserId: data.bot_user_id,
      },
      createdAt: now,
      updatedAt: now,
    };

    await this.tokenStore.saveTokens(userId, stored);
    await this.tokenStore.getOrCreateUser({
      id: userId,
      email: profile?.profile?.email ?? `${userId}@slack.user`,
      name: profile?.real_name ?? profile?.name ?? 'Slack User',
      avatarUrl: profile?.profile?.image_192,
    });

    const { sessionId } = await this.sessions.create({
      userId,
      email: profile?.profile?.email,
      name: profile?.real_name ?? profile?.name,
    });

    this.setSessionCookie(res, sessionId);

    const redirectUrl = new URL(statePayload.redirectTo ?? `${env.FRONTEND_URL}/settings/integrations`);
    redirectUrl.searchParams.set('connected', 'slack');
    redirectUrl.searchParams.set('status', 'success');
    res.redirect(redirectUrl.toString());
  }

  async refreshTokens(tokens: StoredOAuthTokens): Promise<{ accessToken: string; expiresAt?: number }> {
    if (!tokens.refreshToken) {
      throw new OAuthError('No Slack refresh token available', 'slack', 'NO_REFRESH_TOKEN', 401);
    }

    if (!env.SLACK_CLIENT_ID || !env.SLACK_CLIENT_SECRET) {
      throw new OAuthError('Slack OAuth not configured', 'slack', 'NOT_CONFIGURED', 503);
    }

    try {
      const response = await fetch('https://slack.com/api/oauth.v2.access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: env.SLACK_CLIENT_ID,
          client_secret: env.SLACK_CLIENT_SECRET,
          grant_type: 'refresh_token',
          refresh_token: tokens.refreshToken,
        }),
      });

      const data = (await response.json()) as SlackOAuthResponse;
      if (!data.ok || !data.access_token) {
        throw new Error(data.error ?? 'Slack refresh failed');
      }

      return {
        accessToken: data.access_token,
        expiresAt: data.expires_in ? Date.now() + data.expires_in * 1000 : undefined,
      };
    } catch (err) {
      throw new OAuthError('Slack token refresh failed', 'slack', 'REFRESH_FAILED', 401, err);
    }
  }

  async getAccessToken(userId: string): Promise<string> {
    return this.tokenStore.getValidAccessToken(userId, 'slack', (t) => this.refreshTokens(t));
  }

  private setSessionCookie(res: Response, sessionId: string): void {
    res.cookie(SESSION_COOKIE, sessionId, {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: SESSION_TTL_SECONDS * 1000,
      path: '/',
    });
  }
}
