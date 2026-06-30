import { createChildLogger } from '../utils/logger.js';
import { buildKey, MemoryNamespaces, type MemoryStore } from '../memory/types.js';
import type { OAuthProvider, StoredOAuthTokens, IntegrationStatus } from './types.js';
import { IntegrationNotConnectedError, TokenRefreshError } from './errors.js';
import type { ToolName, User } from '../types/index.js';

const log = createChildLogger('auth:token-store');

const PROVIDER_TO_TOOLS: Record<OAuthProvider, ToolName[]> = {
  google: ['gmail', 'calendar', 'drive', 'sheets'],
  slack: ['slack'],
};

export class TokenStore {
  constructor(private store: MemoryStore) {}

  private tokenKey(userId: string, provider: OAuthProvider): string {
    return buildKey(MemoryNamespaces.USER_TOKENS, userId, provider);
  }

  private userKey(userId: string): string {
    return buildKey(MemoryNamespaces.USER, userId);
  }

  async saveTokens(userId: string, tokens: StoredOAuthTokens): Promise<void> {
    await this.store.set(this.tokenKey(userId, tokens.provider), tokens);
    await this.updateUserIntegrations(userId, tokens);
    log.info({ userId, provider: tokens.provider }, 'OAuth tokens saved');
  }

  async getTokens(userId: string, provider: OAuthProvider): Promise<StoredOAuthTokens | null> {
    return this.store.get<StoredOAuthTokens>(this.tokenKey(userId, provider));
  }

  async requireTokens(userId: string, provider: OAuthProvider): Promise<StoredOAuthTokens> {
    const tokens = await this.getTokens(userId, provider);
    if (!tokens) {
      throw new IntegrationNotConnectedError(provider);
    }
    return tokens;
  }

  async updateAccessToken(
    userId: string,
    provider: OAuthProvider,
    accessToken: string,
    expiresAt?: number,
  ): Promise<StoredOAuthTokens> {
    const existing = await this.requireTokens(userId, provider);
    const updated: StoredOAuthTokens = {
      ...existing,
      accessToken,
      expiresAt,
      updatedAt: new Date().toISOString(),
    };
    await this.saveTokens(userId, updated);
    return updated;
  }

  async deleteTokens(userId: string, provider: OAuthProvider): Promise<void> {
    await this.store.delete(this.tokenKey(userId, provider));
    const user = await this.getUser(userId);
    if (user) {
      for (const tool of PROVIDER_TO_TOOLS[provider]) {
        delete user.connectedIntegrations[tool];
      }
      await this.store.set(this.userKey(userId), user);
    }
    log.info({ userId, provider }, 'OAuth tokens deleted');
  }

  async isExpired(tokens: StoredOAuthTokens, bufferMs = 60_000): Promise<boolean> {
    if (!tokens.expiresAt) return false;
    return Date.now() >= tokens.expiresAt - bufferMs;
  }

  async getValidAccessToken(
    userId: string,
    provider: OAuthProvider,
    refreshFn: (tokens: StoredOAuthTokens) => Promise<{ accessToken: string; expiresAt?: number }>,
  ): Promise<string> {
    const tokens = await this.requireTokens(userId, provider);

    if (!(await this.isExpired(tokens))) {
      return tokens.accessToken;
    }

    if (!tokens.refreshToken) {
      throw new TokenRefreshError(provider);
    }

    try {
      const refreshed = await refreshFn(tokens);
      const updated = await this.updateAccessToken(
        userId,
        provider,
        refreshed.accessToken,
        refreshed.expiresAt,
      );
      return updated.accessToken;
    } catch (err) {
      log.error({ err, userId, provider }, 'Token refresh failed');
      throw new TokenRefreshError(provider, err);
    }
  }

  async getIntegrationStatuses(userId: string): Promise<IntegrationStatus[]> {
    const statuses: IntegrationStatus[] = [];

    for (const provider of ['google', 'slack'] as OAuthProvider[]) {
      const tokens = await this.getTokens(userId, provider);
      if (!tokens) {
        statuses.push({ provider, connected: false });
        continue;
      }

      const base: IntegrationStatus = {
        provider,
        connected: true,
        connectedAt: tokens.createdAt,
        scopes: tokens.scopes,
        metadata: tokens.metadata,
        expiresAt: tokens.expiresAt,
        needsRefresh: await this.isExpired(tokens),
      };

      statuses.push(base);

      for (const tool of PROVIDER_TO_TOOLS[provider]) {
        statuses.push({ ...base, provider: tool });
      }
    }

    return statuses;
  }

  async upsertUser(user: User): Promise<User> {
    await this.store.set(this.userKey(user.id), user);
    return user;
  }

  async getUser(userId: string): Promise<User | null> {
    return this.store.get<User>(this.userKey(userId));
  }

  async getOrCreateUser(params: {
    id: string;
    email: string;
    name: string;
    avatarUrl?: string;
  }): Promise<User> {
    const existing = await this.getUser(params.id);
    if (existing) return existing;

    const user: User = {
      id: params.id,
      email: params.email,
      name: params.name,
      avatarUrl: params.avatarUrl,
      connectedIntegrations: {},
      createdAt: new Date().toISOString(),
    };
    return this.upsertUser(user);
  }

  private async updateUserIntegrations(userId: string, tokens: StoredOAuthTokens): Promise<void> {
    const user = await this.getOrCreateUser({
      id: userId,
      email: tokens.metadata.email ?? `${userId}@sobathq.local`,
      name: tokens.metadata.name ?? 'SobatHQ User',
      avatarUrl: tokens.metadata.picture,
    });

    const connectedAt = new Date().toISOString();
    for (const tool of PROVIDER_TO_TOOLS[tokens.provider]) {
      user.connectedIntegrations[tool] = { connectedAt, scopes: tokens.scopes };
    }

    await this.upsertUser(user);
  }
}
