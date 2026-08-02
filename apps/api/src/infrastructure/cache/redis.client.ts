import { Redis } from 'ioredis';

import { MAX_RETRIES_PER_REQUEST } from './cache.constants.js';

export const REDIS_CLIENT = Symbol('ICB_REDIS_CLIENT');

/**
 * Build the shared Redis connection.
 *
 * `lazyConnect` keeps boot resilient: the process starts even while Redis is down, and the
 * first command triggers the connection. `enableOfflineQueue: false` plus a bounded
 * `maxRetriesPerRequest` means a dead Redis fails commands fast — CacheService turns that
 * failure into a cache miss rather than a hanging request.
 */
export function createRedisClient(url: string): Redis {
  return new Redis(url, {
    lazyConnect: true,
    enableOfflineQueue: false,
    maxRetriesPerRequest: MAX_RETRIES_PER_REQUEST,
  });
}
