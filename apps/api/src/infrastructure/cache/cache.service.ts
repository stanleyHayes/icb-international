import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Redis } from 'ioredis';
import type { ZodType } from 'zod';

import { ValidationError } from '../../common/errors/index.js';
import {
  CACHE_KEY_PREFIX,
  DEFAULT_TTL_SECONDS,
  MAX_TTL_SECONDS,
  MIN_TTL_SECONDS,
} from './cache.constants.js';
import { REDIS_CLIENT } from './redis.client.js';

const NAMESPACE_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

/**
 * Typed cache over Redis.
 *
 * Every read is validated against the caller's Zod schema before it is trusted — a cache entry
 * outlives the code that wrote it, so after a deploy the stored shape can be stale. An entry
 * that fails validation is evicted and reported as a miss, which is the only safe answer.
 *
 * The service degrades rather than fails: with no Redis configured it is a silent no-op, and a
 * Redis error mid-request becomes a miss, never a 500. Callers must therefore always treat the
 * cache as a hint and be able to recompute.
 */
@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);

  constructor(@Inject(REDIS_CLIENT) private readonly client: Redis | null) {}

  get isEnabled(): boolean {
    return this.client !== null;
  }

  /** Namespaced physical key, e.g. `icb:accounts:summary:01J…`. */
  keyFor(namespace: string, key: string): string {
    if (!NAMESPACE_PATTERN.test(namespace)) {
      throw new ValidationError('Invalid cache namespace', [
        { path: 'namespace', message: 'must be lowercase alphanumeric with dashes' },
      ]);
    }
    return `${CACHE_KEY_PREFIX}:${namespace}:${key}`;
  }

  async get<T>(namespace: string, key: string, schema: ZodType<T>): Promise<T | null> {
    if (this.client === null) {
      return null;
    }
    try {
      const raw = await this.client.get(this.keyFor(namespace, key));
      return raw === null ? null : await this.parse(namespace, key, raw, schema);
    } catch (error) {
      this.logger.warn({ err: error, namespace, key }, 'Cache read failed; treating as a miss');
      return null;
    }
  }

  async set(
    namespace: string,
    key: string,
    value: unknown,
    ttlSeconds: number = DEFAULT_TTL_SECONDS,
  ): Promise<void> {
    if (this.client === null) {
      return;
    }
    try {
      const ttl = clampTtl(ttlSeconds);
      await this.client.set(this.keyFor(namespace, key), JSON.stringify(value), 'EX', ttl);
    } catch (error) {
      this.logger.warn({ err: error, namespace, key }, 'Cache write failed; continuing uncached');
    }
  }

  async delete(namespace: string, key: string): Promise<void> {
    if (this.client === null) {
      return;
    }
    try {
      await this.client.del(this.keyFor(namespace, key));
    } catch (error) {
      this.logger.warn({ err: error, namespace, key }, 'Cache eviction failed');
    }
  }

  private async parse<T>(
    namespace: string,
    key: string,
    raw: string,
    schema: ZodType<T>,
  ): Promise<T | null> {
    try {
      return schema.parse(JSON.parse(raw));
    } catch {
      // Stale or corrupted entry: evict it and answer as a miss so the caller recomputes.
      await this.delete(namespace, key);
      return null;
    }
  }
}

function clampTtl(ttlSeconds: number): number {
  return Math.min(Math.max(Math.floor(ttlSeconds), MIN_TTL_SECONDS), MAX_TTL_SECONDS);
}
