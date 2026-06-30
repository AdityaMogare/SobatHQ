import { v4 as uuidv4 } from 'uuid';
import { createChildLogger } from '../utils/logger.js';
import { buildKey, MemoryNamespaces, type MemoryStore } from '../memory/types.js';
import { generateApiKey, verifyApiKey } from './crypto.js';
import type { ApiKeyRecord } from './types.js';
import { AuthError } from './errors.js';

const log = createChildLogger('auth:api-keys');

export class ApiKeyService {
  constructor(private store: MemoryStore) {}

  private key(id: string): string {
    return buildKey(MemoryNamespaces.API_KEY, id);
  }

  private userIndexKey(userId: string): string {
    return buildKey(MemoryNamespaces.API_KEY, 'user', userId);
  }

  async create(params: {
    userId: string;
    name: string;
    scopes?: string[];
    expiresInDays?: number;
  }): Promise<{ apiKey: ApiKeyRecord; rawKey: string }> {
    const { rawKey, prefix, keyHash } = generateApiKey();
    const now = new Date();
    const id = uuidv4();

    const record: ApiKeyRecord = {
      id,
      userId: params.userId,
      name: params.name,
      prefix,
      keyHash,
      scopes: params.scopes ?? ['read', 'write'],
      createdAt: now.toISOString(),
      expiresAt: params.expiresInDays
        ? new Date(now.getTime() + params.expiresInDays * 86400000).toISOString()
        : undefined,
    };

    await this.store.set(this.key(id), record);
    await this.store.increment(this.userIndexKey(params.userId));
    log.info({ userId: params.userId, keyId: id, prefix }, 'API key created');

    return { apiKey: record, rawKey };
  }

  async listByUser(userId: string): Promise<ApiKeyRecord[]> {
    const pattern = buildKey(MemoryNamespaces.API_KEY, '*');
    const keys = await this.store.keys(pattern);
    const keyIds = keys.filter((k) => !k.includes(':user:'));

    const records = await this.store.mget<ApiKeyRecord>(keyIds);
    return records
      .filter((r): r is ApiKeyRecord => r !== null && r.userId === userId && !r.revokedAt)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async authenticate(rawKey: string): Promise<ApiKeyRecord> {
    const pattern = buildKey(MemoryNamespaces.API_KEY, '*');
    const keys = await this.store.keys(pattern);
    const keyIds = keys.filter((k) => !k.includes(':user:'));

    for (const id of keyIds) {
      const record = await this.store.get<ApiKeyRecord>(id);
      if (!record || record.revokedAt) continue;
      if (record.expiresAt && new Date(record.expiresAt) < new Date()) continue;
      if (!verifyApiKey(rawKey, record.keyHash)) continue;

      record.lastUsedAt = new Date().toISOString();
      await this.store.set(this.key(record.id), record);
      return record;
    }

    throw new AuthError('Invalid API key', 'INVALID_API_KEY');
  }

  async revoke(userId: string, keyId: string): Promise<boolean> {
    const record = await this.store.get<ApiKeyRecord>(this.key(keyId));
    if (!record || record.userId !== userId) return false;

    record.revokedAt = new Date().toISOString();
    await this.store.set(this.key(keyId), record);
    log.info({ userId, keyId }, 'API key revoked');
    return true;
  }
}
