import { google } from 'googleapis';
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

const log = createChildLogger('auth:google');

export const GOOGLE_SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.compose',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/spreadsheets.readonly',
  'https://www.googleapis.com/auth/spreadsheets',
];

export class GoogleOAuthService {
  constructor(
    private tokenStore: TokenStore,
    private oauthState: OAuthStateService,
    private sessions: SessionService,
  ) {}

  private createOAuth2Client() {
    if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
      throw new OAuthError('Google OAuth not configured', 'google', 'NOT_CONFIGURED', 503);
    }

    return new google.auth.OAuth2(
      env.GOOGLE_CLIENT_ID,
      env.GOOGLE_CLIENT_SECRET,
      env.GOOGLE_REDIRECT_URI,
    );
  }

  async getAuthorizationUrl(params?: { userId?: string; redirectTo?: string }): Promise<string> {
    const client = this.createOAuth2Client();
    const state = await this.oauthState.create({
      provider: 'google',
      userId: params?.userId,
      redirectTo: params?.redirectTo,
    });

    return client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: GOOGLE_SCOPES,
      state,
      include_granted_scopes: true,
    });
  }

  async handleCallback(code: string, state: string, res: Response): Promise<void> {
    const statePayload = await this.oauthState.consume(state, 'google');
    const client = this.createOAuth2Client();

    let tokensResponse;
    try {
      const { tokens } = await client.getToken(code);
      tokensResponse = tokens;
    } catch (err) {
      log.error({ err }, 'Google token exchange failed');
      throw new OAuthError('Failed to exchange Google authorization code', 'google', 'TOKEN_EXCHANGE_FAILED', 400, err);
    }

    if (!tokensResponse.access_token) {
      throw new OAuthError('Google did not return an access token', 'google', 'MISSING_ACCESS_TOKEN', 400);
    }

    client.setCredentials(tokensResponse);

    const oauth2 = google.oauth2({ version: 'v2', auth: client });
    let profile;
    try {
      const { data } = await oauth2.userinfo.get();
      profile = data;
    } catch (err) {
      log.warn({ err }, 'Failed to fetch Google user profile');
    }

    const userId = statePayload.userId ?? profile?.id ?? uuidv4();
    const now = new Date().toISOString();

    const stored: StoredOAuthTokens = {
      provider: 'google',
      accessToken: tokensResponse.access_token,
      refreshToken: tokensResponse.refresh_token ?? undefined,
      expiresAt: tokensResponse.expiry_date ?? undefined,
      scopes: tokensResponse.scope?.split(' ') ?? GOOGLE_SCOPES,
      metadata: {
        email: profile?.email ?? undefined,
        name: profile?.name ?? undefined,
        picture: profile?.picture ?? undefined,
        googleUserId: profile?.id ?? undefined,
      },
      createdAt: now,
      updatedAt: now,
    };

    await this.tokenStore.saveTokens(userId, stored);
    await this.tokenStore.getOrCreateUser({
      id: userId,
      email: profile?.email ?? `${userId}@google.user`,
      name: profile?.name ?? 'Google User',
      avatarUrl: profile?.picture ?? undefined,
    });

    const { sessionId } = await this.sessions.create({
      userId,
      email: profile?.email ?? undefined,
      name: profile?.name ?? undefined,
    });

    this.setSessionCookie(res, sessionId);

    const redirectUrl = new URL(statePayload.redirectTo ?? `${env.FRONTEND_URL}/settings/integrations`);
    redirectUrl.searchParams.set('connected', 'google');
    redirectUrl.searchParams.set('status', 'success');
    res.redirect(redirectUrl.toString());
  }

  async refreshTokens(tokens: StoredOAuthTokens): Promise<{ accessToken: string; expiresAt?: number }> {
    if (!tokens.refreshToken) {
      throw new OAuthError('No Google refresh token available', 'google', 'NO_REFRESH_TOKEN', 401);
    }

    const client = this.createOAuth2Client();
    client.setCredentials({ refresh_token: tokens.refreshToken });

    try {
      const { credentials } = await client.refreshAccessToken();
      return {
        accessToken: credentials.access_token!,
        expiresAt: credentials.expiry_date ?? undefined,
      };
    } catch (err) {
      throw new OAuthError('Google token refresh failed', 'google', 'REFRESH_FAILED', 401, err);
    }
  }

  async getAuthenticatedClient(userId: string) {
    const accessToken = await this.tokenStore.getValidAccessToken(userId, 'google', (t) =>
      this.refreshTokens(t),
    );
    const client = this.createOAuth2Client();
    const stored = await this.tokenStore.requireTokens(userId, 'google');
    client.setCredentials({
      access_token: accessToken,
      refresh_token: stored.refreshToken,
      expiry_date: stored.expiresAt,
    });
    return client;
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
