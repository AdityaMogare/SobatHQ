import { createChildLogger } from '../utils/logger.js';
import { buildKey, type MemoryStore } from './types.js';

const log = createChildLogger('memory:in-memory');

interface Entry {
  value: unknown;
  expiresAt?: number;
}

export class InMemoryStore implements MemoryStore {
  private store = new Map<string, Entry>();

  async get<T = unknown>(key: string): Promise<T | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.value as T;
  }

  async set(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    const entry: Entry = { value };
    if (ttlSeconds) {
      entry.expiresAt = Date.now() + ttlSeconds * 1000;
    }
    this.store.set(key, entry);
  }

  async delete(key: string): Promise<boolean> {
    return this.store.delete(key);
  }

  async has(key: string): Promise<boolean> {
    const val = await this.get(key);
    return val !== null;
  }

  async keys(pattern: string): Promise<string[]> {
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    return [...this.store.keys()].filter((k) => regex.test(k));
  }

  async mget<T = unknown>(keys: string[]): Promise<(T | null)[]> {
    return Promise.all(keys.map((k) => this.get<T>(k)));
  }

  async mset(entries: Record<string, unknown>, ttlSeconds?: number): Promise<void> {
    await Promise.all(Object.entries(entries).map(([k, v]) => this.set(k, v, ttlSeconds)));
  }

  async increment(key: string, by = 1): Promise<number> {
    const current = (await this.get<number>(key)) ?? 0;
    const next = current + by;
    await this.set(key, next);
    return next;
  }

  async expire(key: string, ttlSeconds: number): Promise<boolean> {
    const entry = this.store.get(key);
    if (!entry) return false;
    entry.expiresAt = Date.now() + ttlSeconds * 1000;
    return true;
  }

  async disconnect(): Promise<void> {
    this.store.clear();
    log.info('In-memory store cleared');
  }
}

export async function createMemoryStore(redisUrl?: string): Promise<MemoryStore> {
  if (redisUrl) {
    try {
      const { RedisStore } = await import('./redis-store.js');
      const store = new RedisStore(redisUrl);
      await store.ping();
      log.info('Connected to Redis memory store');
      return store;
    } catch (err) {
      log.warn({ err }, 'Redis unavailable, falling back to in-memory store');
    }
  }
  log.info('Using in-memory store');
  return new InMemoryStore();
}

export { buildKey };
