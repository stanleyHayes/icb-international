import { Injectable } from '@nestjs/common';
import type { ZodType } from 'zod';

import { ValidationError } from '../../common/errors/index.js';
import { ClockService } from '../../simulation/clock/clock.service.js';
import {
  CACHE_KEY_PREFIX,
  DEFAULT_TTL_SECONDS,
  MAX_ENTRIES,
  MAX_TTL_SECONDS,
  MIN_TTL_SECONDS,
} from './cache.constants.js';

const NAMESPACE_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

interface Entry {
  readonly value: string;
  readonly expiresAtMs: number;
}

/**
 * Typed cache held in the API process.
 *
 * Every read is validated against the caller's Zod schema before it is trusted — an entry can
 * outlive the code that wrote it, and after a hot reload the stored shape can be stale. An entry
 * that fails validation is evicted and reported as a miss, which is the only safe answer.
 *
 * Scope is one process. That is exact for this deployment: the API runs as a single instance,
 * the chat gateway fans out in-process, and KeyedMutex is per-process for the same reason. A
 * multi-instance deployment would see per-instance caches — correct, because every caller treats
 * the cache as a hint and can recompute, but no longer shared.
 *
 * Values are stored as JSON strings rather than live objects so a caller cannot mutate another
 * caller's cached value through a shared reference.
 *
 * TTLs are measured on the simulation clock, not wall time, so a simulated jump forward expires
 * cached rates exactly as it ages everything else.
 */
@Injectable()
export class CacheService {
  private readonly entries = new Map<string, Entry>();

  constructor(private readonly clock: ClockService) {}

  get isEnabled(): boolean {
    return true;
  }

  /** Namespaced physical key, e.g. `icb:content:rate-table`. */
  keyFor(namespace: string, key: string): string {
    if (!NAMESPACE_PATTERN.test(namespace)) {
      throw new ValidationError('Invalid cache namespace', [
        { path: 'namespace', message: 'must be lowercase alphanumeric with dashes' },
      ]);
    }
    return `${CACHE_KEY_PREFIX}:${namespace}:${key}`;
  }

  /**
   * Promise-returning despite the store being synchronous: every caller awaits it, and keeping
   * the seam asynchronous means swapping the backing store again costs no call-site changes.
   */
  get<T>(namespace: string, key: string, schema: ZodType<T>): Promise<T | null> {
    const physical = this.keyFor(namespace, key);
    const entry = this.entries.get(physical);

    if (entry === undefined) {
      return Promise.resolve(null);
    }
    if (entry.expiresAtMs <= this.clock.epochMs()) {
      this.entries.delete(physical);
      return Promise.resolve(null);
    }
    return Promise.resolve(this.parse(physical, entry.value, schema));
  }

  set(
    namespace: string,
    key: string,
    value: unknown,
    ttlSeconds: number = DEFAULT_TTL_SECONDS,
  ): Promise<void> {
    const physical = this.keyFor(namespace, key);
    // Typed wider than the lib signature on purpose: JSON.stringify really does return undefined
    // for undefined and for a lone function, which the built-in `string` return type hides.
    const serialised: string | undefined = JSON.stringify(value);

    // A value that will not serialise cannot be cached; that is a miss next read, not an error.
    if (typeof serialised !== 'string') {
      return Promise.resolve();
    }

    // Re-inserting moves the key to the end of the map's insertion order, which is what makes
    // the eviction below oldest-first.
    this.entries.delete(physical);
    this.entries.set(physical, {
      value: serialised,
      expiresAtMs: this.clock.epochMs() + clampTtl(ttlSeconds) * 1_000,
    });
    this.evictIfOverCapacity();
    return Promise.resolve();
  }

  delete(namespace: string, key: string): Promise<void> {
    this.entries.delete(this.keyFor(namespace, key));
    return Promise.resolve();
  }

  private parse<T>(physical: string, raw: string, schema: ZodType<T>): T | null {
    try {
      return schema.parse(JSON.parse(raw));
    } catch {
      // Stale or corrupted entry: evict it and answer as a miss so the caller recomputes.
      this.entries.delete(physical);
      return null;
    }
  }

  /**
   * Drop expired entries first — they are free to lose — and only then the oldest live ones.
   * Without the expiry sweep a burst of short-TTL keys would evict long-lived entries that are
   * still valid.
   */
  private evictIfOverCapacity(): void {
    if (this.entries.size <= MAX_ENTRIES) {
      return;
    }
    const nowMs = this.clock.epochMs();
    for (const [physical, entry] of this.entries) {
      if (entry.expiresAtMs <= nowMs) {
        this.entries.delete(physical);
      }
    }
    for (const physical of this.entries.keys()) {
      if (this.entries.size <= MAX_ENTRIES) {
        break;
      }
      this.entries.delete(physical);
    }
  }
}

function clampTtl(ttlSeconds: number): number {
  return Math.min(Math.max(Math.floor(ttlSeconds), MIN_TTL_SECONDS), MAX_TTL_SECONDS);
}
