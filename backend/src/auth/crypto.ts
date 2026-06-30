import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { env } from '../config/env.js';

const API_KEY_PREFIX = 'sk_sobat_';

export function generateApiKey(): { rawKey: string; prefix: string; keyHash: string } {
  const secret = randomBytes(32).toString('base64url');
  const rawKey = `${API_KEY_PREFIX}${secret}`;
  const prefix = rawKey.slice(0, 16);
  const keyHash = hashApiKey(rawKey);
  return { rawKey, prefix, keyHash };
}

export function hashApiKey(rawKey: string): string {
  return createHmac('sha256', env.SESSION_SECRET).update(rawKey).digest('hex');
}

export function verifyApiKey(rawKey: string, keyHash: string): boolean {
  const computed = hashApiKey(rawKey);
  try {
    return timingSafeEqual(Buffer.from(computed), Buffer.from(keyHash));
  } catch {
    return false;
  }
}

export function isApiKeyFormat(value: string): boolean {
  return value.startsWith(API_KEY_PREFIX) && value.length > API_KEY_PREFIX.length + 16;
}

export const SESSION_COOKIE = 'sobathq_session';
export const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;
