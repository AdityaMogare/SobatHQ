export interface MemoryStore {
  get<T = unknown>(key: string): Promise<T | null>;
  set(key: string, value: unknown, ttlSeconds?: number): Promise<void>;
  delete(key: string): Promise<boolean>;
  has(key: string): Promise<boolean>;
  keys(pattern: string): Promise<string[]>;
  mget<T = unknown>(keys: string[]): Promise<(T | null)[]>;
  mset(entries: Record<string, unknown>, ttlSeconds?: number): Promise<void>;
  increment(key: string, by?: number): Promise<number>;
  expire(key: string, ttlSeconds: number): Promise<boolean>;
  disconnect(): Promise<void>;
}

export function buildKey(namespace: string, ...parts: string[]): string {
  return `sobathq:${namespace}:${parts.join(':')}`;
}

export const MemoryNamespaces = {
  USER_PREFS: 'user:prefs',
  USER_TOKENS: 'user:tokens',
  AGENT_STATE: 'agent:state',
  TASK: 'task',
  APPROVAL: 'approval',
  SESSION: 'session',
  CACHE: 'cache',
} as const;
