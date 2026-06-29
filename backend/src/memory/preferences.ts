import { v4 as uuidv4 } from 'uuid';
import { createChildLogger } from '../utils/logger.js';
import { buildKey, MemoryNamespaces, type MemoryStore } from '../memory/types.js';
import type { UserPreferences } from '../types/index.js';

const log = createChildLogger('memory:preferences');

const DEFAULT_PREFS: Omit<UserPreferences, 'userId' | 'updatedAt'> = {
  timezone: 'America/New_York',
  workingHours: { start: '09:00', end: '17:00' },
  emailDigestFrequency: 'daily',
  autoDraftReplies: true,
  notificationChannels: ['dashboard', 'slack'],
  customRules: [],
};

export class PreferencesService {
  constructor(private store: MemoryStore) {}

  private key(userId: string): string {
    return buildKey(MemoryNamespaces.USER_PREFS, userId);
  }

  async get(userId: string): Promise<UserPreferences> {
    const existing = await this.store.get<UserPreferences>(this.key(userId));
    if (existing) return existing;

    const defaults: UserPreferences = {
      ...DEFAULT_PREFS,
      userId,
      updatedAt: new Date().toISOString(),
    };
    await this.store.set(this.key(userId), defaults);
    return defaults;
  }

  async update(
    userId: string,
    updates: Partial<Omit<UserPreferences, 'userId' | 'updatedAt'>>,
  ): Promise<UserPreferences> {
    const current = await this.get(userId);
    const updated: UserPreferences = {
      ...current,
      ...updates,
      userId,
      updatedAt: new Date().toISOString(),
    };
    await this.store.set(this.key(userId), updated);
    log.info({ userId }, 'User preferences updated');
    return updated;
  }

  async remember(userId: string, rule: string): Promise<void> {
    const prefs = await this.get(userId);
    if (!prefs.customRules.includes(rule)) {
      prefs.customRules.push(rule);
      await this.update(userId, { customRules: prefs.customRules });
    }
  }
}

export class SessionStore {
  constructor(private store: MemoryStore) {}

  async create(userId: string, data: Record<string, unknown>, ttlSeconds = 86400): Promise<string> {
    const sessionId = uuidv4();
    const key = buildKey(MemoryNamespaces.SESSION, sessionId);
    await this.store.set(key, { userId, ...data }, ttlSeconds);
    return sessionId;
  }

  async get(sessionId: string): Promise<Record<string, unknown> | null> {
    return this.store.get(buildKey(MemoryNamespaces.SESSION, sessionId));
  }

  async destroy(sessionId: string): Promise<void> {
    await this.store.delete(buildKey(MemoryNamespaces.SESSION, sessionId));
  }
}
