import type { Redis } from 'ioredis';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { ValidationError } from '../../../common/errors/index.js';
import {
  CACHE_KEY_PREFIX,
  DEFAULT_TTL_SECONDS,
  MAX_TTL_SECONDS,
  MIN_TTL_SECONDS,
} from '../cache.constants.js';
import { CacheService } from '../cache.service.js';
import { createRedisClient } from '../redis.client.js';

function redisMock() {
  return {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
  };
}

function setup() {
  const redis = redisMock();
  const cache = new CacheService(redis as unknown as Redis);
  return { redis, cache };
}

const balanceSchema = z.object({ balance: z.number() });

describe('keyFor', () => {
  it('builds a namespaced physical key', () => {
    const { cache } = setup();
    expect(cache.keyFor('accounts', '01JABC')).toBe(`${CACHE_KEY_PREFIX}:accounts:01JABC`);
  });

  it('rejects namespaces that would collide with the key structure', () => {
    const { cache } = setup();
    expect(() => cache.keyFor('Accounts:Admin', 'x')).toThrow(ValidationError);
    expect(() => cache.keyFor('', 'x')).toThrow(ValidationError);
  });
});

describe('get', () => {
  it('returns null on a miss', async () => {
    const { redis, cache } = setup();
    redis.get.mockResolvedValue(null);

    await expect(cache.get('accounts', 'missing', balanceSchema)).resolves.toBeNull();
    expect(redis.get).toHaveBeenCalledWith(`${CACHE_KEY_PREFIX}:accounts:missing`);
  });

  it('parses and validates a hit against the caller schema', async () => {
    const { redis, cache } = setup();
    redis.get.mockResolvedValue('{"balance":4200}');

    await expect(cache.get('accounts', 'a1', balanceSchema)).resolves.toStrictEqual({
      balance: 4200,
    });
  });

  it('evicts a stale-shaped entry and answers as a miss', async () => {
    const { redis, cache } = setup();
    redis.get.mockResolvedValue('{"balance":"not-a-number"}');

    await expect(cache.get('accounts', 'a1', balanceSchema)).resolves.toBeNull();
    expect(redis.del).toHaveBeenCalledWith(`${CACHE_KEY_PREFIX}:accounts:a1`);
  });

  it('turns a Redis failure into a miss rather than an error', async () => {
    const { redis, cache } = setup();
    redis.get.mockRejectedValue(new Error('connection refused'));

    await expect(cache.get('accounts', 'a1', balanceSchema)).resolves.toBeNull();
  });
});

describe('set', () => {
  it('writes JSON with the default TTL', async () => {
    const { redis, cache } = setup();

    await cache.set('accounts', 'a1', { balance: 1 });

    expect(redis.set).toHaveBeenCalledWith(
      `${CACHE_KEY_PREFIX}:accounts:a1`,
      '{"balance":1}',
      'EX',
      DEFAULT_TTL_SECONDS,
    );
  });

  it('clamps the TTL into the policy bounds', async () => {
    const { redis, cache } = setup();

    await cache.set('accounts', 'low', 1, 0);
    await cache.set('accounts', 'high', 1, MAX_TTL_SECONDS * 10);

    expect(redis.set).toHaveBeenNthCalledWith(1, expect.any(String), '1', 'EX', MIN_TTL_SECONDS);
    expect(redis.set).toHaveBeenNthCalledWith(2, expect.any(String), '1', 'EX', MAX_TTL_SECONDS);
  });

  it('swallows a Redis failure — the caller can always recompute', async () => {
    const { redis, cache } = setup();
    redis.set.mockRejectedValue(new Error('connection refused'));

    await expect(cache.set('accounts', 'a1', 1)).resolves.toBeUndefined();
  });
});

describe('disabled cache', () => {
  it('is a no-op when no Redis client is bound', async () => {
    const cache = new CacheService(null);

    expect(cache.isEnabled).toBe(false);
    await expect(cache.get('accounts', 'a1', balanceSchema)).resolves.toBeNull();
    await expect(cache.set('accounts', 'a1', 1)).resolves.toBeUndefined();
    await expect(cache.delete('accounts', 'a1')).resolves.toBeUndefined();
  });
});

describe('createRedisClient', () => {
  it('builds a lazily-connecting client', () => {
    const client = createRedisClient('redis://localhost:6479');

    expect(client.options.lazyConnect).toBe(true);
    expect(client.options.enableOfflineQueue).toBe(false);
    client.disconnect();
  });
});
