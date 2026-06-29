import { Redis } from 'ioredis';
import { createChildLogger } from '../utils/logger.js';
import type { MemoryStore } from './types.js';

const log = createChildLogger('memory:redis');

export class RedisStore implements MemoryStore {
  private client: Redis;

  constructor(redisUrl: string) {
    this.client = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });

    this.client.on('error', (err: Error) => {
      log.error({ err }, 'Redis connection error');
    });
  }

  async ping(): Promise<void> {
    await this.client.connect();
    await this.client.ping();
  }

  async get<T = unknown>(key: string): Promise<T | null> {
    const raw = await this.client.get(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return raw as T;
    }
  }

  async set(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    const serialized = JSON.stringify(value);
    if (ttlSeconds) {
      await this.client.setex(key, ttlSeconds, serialized);
    } else {
      await this.client.set(key, serialized);
    }
  }

  async delete(key: string): Promise<boolean> {
    const result = await this.client.del(key);
    return result > 0;
  }

  async has(key: string): Promise<boolean> {
    return (await this.client.exists(key)) === 1;
  }

  async keys(pattern: string): Promise<string[]> {
    return this.client.keys(pattern);
  }

  async mget<T = unknown>(keys: string[]): Promise<(T | null)[]> {
    if (keys.length === 0) return [];
    const values = await this.client.mget(...keys);
    return values.map((raw: string | null) => {
      if (!raw) return null;
      try {
        return JSON.parse(raw) as T;
      } catch {
        return raw as T;
      }
    });
  }

  async mset(entries: Record<string, unknown>, ttlSeconds?: number): Promise<void> {
    const pipeline = this.client.pipeline();
    for (const [key, value] of Object.entries(entries)) {
      const serialized = JSON.stringify(value);
      if (ttlSeconds) {
        pipeline.setex(key, ttlSeconds, serialized);
      } else {
        pipeline.set(key, serialized);
      }
    }
    await pipeline.exec();
  }

  async increment(key: string, by = 1): Promise<number> {
    return this.client.incrby(key, by);
  }

  async expire(key: string, ttlSeconds: number): Promise<boolean> {
    return (await this.client.expire(key, ttlSeconds)) === 1;
  }

  async disconnect(): Promise<void> {
    await this.client.quit();
    log.info('Redis connection closed');
  }
}
