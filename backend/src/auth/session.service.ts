import { v4 as uuidv4 } from 'uuid';
import { createChildLogger } from '../utils/logger.js';
import { buildKey, MemoryNamespaces, type MemoryStore } from '../memory/types.js';
import { SESSION_TTL_SECONDS } from './crypto.js';
import type { SessionData } from './types.js';
import { AuthError } from './errors.js';

const log = createChildLogger('auth:session');

export class SessionService {
  constructor(private store: MemoryStore) {}

  private key(sessionId: string): string {
    return buildKey(MemoryNamespaces.SESSION, sessionId);
  }

  async create(params: {
    userId: string;
    email?: string;
    name?: string;
    ttlSeconds?: number;
  }): Promise<{ sessionId: string; session: SessionData }> {
    const sessionId = uuidv4();
    const now = new Date();
    const ttl = params.ttlSeconds ?? SESSION_TTL_SECONDS;
    const expiresAt = new Date(now.getTime() + ttl * 1000);

    const session: SessionData = {
      sessionId,
      userId: params.userId,
      email: params.email,
      name: params.name,
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      lastActiveAt: now.toISOString(),
    };

    await this.store.set(this.key(sessionId), session, ttl);
    log.info({ userId: params.userId, sessionId }, 'Session created');
    return { sessionId, session };
  }

  async get(sessionId: string): Promise<SessionData | null> {
    const session = await this.store.get<SessionData>(this.key(sessionId));
    if (!session) return null;

    if (new Date(session.expiresAt) < new Date()) {
      await this.destroy(sessionId);
      return null;
    }

    session.lastActiveAt = new Date().toISOString();
    await this.store.set(this.key(sessionId), session, SESSION_TTL_SECONDS);
    return session;
  }

  async require(sessionId: string): Promise<SessionData> {
    const session = await this.get(sessionId);
    if (!session) {
      throw new AuthError('Invalid or expired session', 'INVALID_SESSION');
    }
    return session;
  }

  async destroy(sessionId: string): Promise<void> {
    await this.store.delete(this.key(sessionId));
    log.info({ sessionId }, 'Session destroyed');
  }
}
