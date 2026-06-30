import { v4 as uuidv4 } from 'uuid';
import { createChildLogger } from '../utils/logger.js';
import { buildKey, MemoryNamespaces, type MemoryStore } from '../memory/types.js';
import type { OAuthProvider, OAuthStatePayload } from './types.js';
import { OAuthError } from './errors.js';

const log = createChildLogger('auth:oauth-state');
const STATE_TTL_SECONDS = 600;

export class OAuthStateService {
  constructor(private store: MemoryStore) {}

  async create(params: {
    provider: OAuthProvider;
    userId?: string;
    redirectTo?: string;
  }): Promise<string> {
    const state = uuidv4();
    const payload: OAuthStatePayload = {
      provider: params.provider,
      userId: params.userId,
      redirectTo: params.redirectTo,
      createdAt: new Date().toISOString(),
    };
    await this.store.set(
      buildKey(MemoryNamespaces.OAUTH_STATE, state),
      payload,
      STATE_TTL_SECONDS,
    );
    return state;
  }

  async consume(state: string, expectedProvider: OAuthProvider): Promise<OAuthStatePayload> {
    const key = buildKey(MemoryNamespaces.OAUTH_STATE, state);
    const payload = await this.store.get<OAuthStatePayload>(key);
    await this.store.delete(key);

    if (!payload) {
      throw new OAuthError('Invalid or expired OAuth state', expectedProvider, 'INVALID_STATE', 400);
    }
    if (payload.provider !== expectedProvider) {
      throw new OAuthError('OAuth state provider mismatch', expectedProvider, 'STATE_MISMATCH', 400);
    }
    return payload;
  }
}
