import type { ToolName } from '../types/index.js';

export type OAuthProvider = 'google' | 'slack';

export interface StoredOAuthTokens {
  provider: OAuthProvider;
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
  scopes: string[];
  metadata: OAuthTokenMetadata;
  createdAt: string;
  updatedAt: string;
}

export interface OAuthTokenMetadata {
  email?: string;
  name?: string;
  picture?: string;
  googleUserId?: string;
  slackUserId?: string;
  slackTeamId?: string;
  slackTeamName?: string;
  botUserId?: string;
}

export interface SessionData {
  sessionId: string;
  userId: string;
  email?: string;
  name?: string;
  createdAt: string;
  expiresAt: string;
  lastActiveAt: string;
}

export interface ApiKeyRecord {
  id: string;
  userId: string;
  name: string;
  prefix: string;
  keyHash: string;
  scopes: string[];
  lastUsedAt?: string;
  expiresAt?: string;
  createdAt: string;
  revokedAt?: string;
}

export interface OAuthStatePayload {
  provider: OAuthProvider;
  userId?: string;
  redirectTo?: string;
  createdAt: string;
}

export interface IntegrationStatus {
  provider: OAuthProvider | ToolName;
  connected: boolean;
  connectedAt?: string;
  scopes?: string[];
  metadata?: Partial<OAuthTokenMetadata>;
  expiresAt?: number;
  needsRefresh?: boolean;
}

export interface GoogleServiceContext {
  userId: string;
  accessToken: string;
}

export interface SlackServiceContext {
  userId: string;
  accessToken: string;
  teamId?: string;
}
