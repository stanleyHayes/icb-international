import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { ValidationError } from '../../../common/errors/index.js';
import type { ClockService } from '../../../simulation/clock/clock.service.js';
import {
  CACHE_KEY_PREFIX,
  DEFAULT_TTL_SECONDS,
  MAX_ENTRIES,
  MAX_TTL_SECONDS,
  MIN_TTL_SECONDS,
} from '../cache.constants.js';
import { CacheService } from '../cache.service.js';

/** A clock the test drives by hand, so TTL expiry is asserted rather than waited on. */
function stubClock(startMs = 1_000_000) {
  let nowMs = startMs;
  return {
    clock: { epochMs: () => nowMs } as unknown as ClockService,
    advanceSeconds: (seconds: number) => {
      nowMs += seconds * 1_000;
    },
  };
}

function setup() {
  const { clock, advanceSeconds } = stubClock();
  return { cache: new CacheService(clock), advanceSeconds };
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
    const { cache } = setup();
    await expect(cache.get('accounts', 'missing', balanceSchema)).resolves.toBeNull();
  });

  it('parses and validates a hit against the caller schema', async () => {
    const { cache } = setup();
    await cache.set('accounts', 'a1', { balance: 4200 });

    await expect(cache.get('accounts', 'a1', balanceSchema)).resolves.toStrictEqual({
      balance: 4200,
    });
  });

  it('evicts a stale-shaped entry and answers as a miss', async () => {
    const { cache } = setup();
    await cache.set('accounts', 'a1', { balance: 'not-a-number' });

    await expect(cache.get('accounts', 'a1', balanceSchema)).resolves.toBeNull();
    // Evicted, not merely rejected: a second read must not re-parse the same bad entry.
    await expect(cache.get('accounts', 'a1', z.unknown())).resolves.toBeNull();
  });

  it('returns a copy, so a caller cannot mutate the cached value in place', async () => {
    const { cache } = setup();
    await cache.set('accounts', 'a1', { balance: 10 });

    const first = await cache.get('accounts', 'a1', balanceSchema);
    first!.balance = 999;

    await expect(cache.get('accounts', 'a1', balanceSchema)).resolves.toStrictEqual({
      balance: 10,
    });
  });
});

describe('ttl', () => {
  it('expires an entry once the default TTL has passed on the simulation clock', async () => {
    const { cache, advanceSeconds } = setup();
    await cache.set('accounts', 'a1', { balance: 1 });

    advanceSeconds(DEFAULT_TTL_SECONDS - 1);
    await expect(cache.get('accounts', 'a1', balanceSchema)).resolves.toStrictEqual({ balance: 1 });

    advanceSeconds(1);
    await expect(cache.get('accounts', 'a1', balanceSchema)).resolves.toBeNull();
  });

  it('clamps the TTL into the policy bounds', async () => {
    const { cache, advanceSeconds } = setup();
    await cache.set('accounts', 'low', 1, 0);
    await cache.set('accounts', 'high', 1, MAX_TTL_SECONDS * 10);

    advanceSeconds(MIN_TTL_SECONDS);
    await expect(cache.get('accounts', 'low', z.number())).resolves.toBeNull();

    advanceSeconds(MAX_TTL_SECONDS - MIN_TTL_SECONDS - 1);
    await expect(cache.get('accounts', 'high', z.number())).resolves.toBe(1);

    advanceSeconds(1);
    await expect(cache.get('accounts', 'high', z.number())).resolves.toBeNull();
  });
});

describe('delete', () => {
  it('removes an entry', async () => {
    const { cache } = setup();
    await cache.set('accounts', 'a1', { balance: 1 });

    await cache.delete('accounts', 'a1');

    await expect(cache.get('accounts', 'a1', balanceSchema)).resolves.toBeNull();
  });
});

describe('capacity', () => {
  it('reclaims an expired entry rather than the oldest live one', async () => {
    const { cache, advanceSeconds } = setup();

    // Written first, so insertion order alone would make it the eviction candidate anyway —
    // what is asserted is that being *expired* is what gets it dropped.
    await cache.set('accounts', 'short', 1, MIN_TTL_SECONDS);
    advanceSeconds(MIN_TTL_SECONDS);
    // The oldest live entry. Filling to exactly the bound leaves one entry to reclaim, and the
    // expired one must be it.
    await cache.set('accounts', 'long', 2, MAX_TTL_SECONDS);
    for (let i = 0; i < MAX_ENTRIES - 1; i += 1) {
      await cache.set('accounts', `filler-${String(i)}`, i, MAX_TTL_SECONDS);
    }

    await expect(cache.get('accounts', 'short', z.number())).resolves.toBeNull();
    await expect(cache.get('accounts', 'long', z.number())).resolves.toBe(2);
  });

  it('evicts oldest-first once every entry is live', async () => {
    const { cache } = setup();

    await cache.set('accounts', 'oldest', 1, MAX_TTL_SECONDS);
    for (let i = 0; i < MAX_ENTRIES; i += 1) {
      await cache.set('accounts', `filler-${String(i)}`, i, MAX_TTL_SECONDS);
    }

    // Nothing has expired, so the bound is held by dropping the oldest insertion.
    await expect(cache.get('accounts', 'oldest', z.number())).resolves.toBeNull();
    await expect(cache.get('accounts', 'filler-0', z.number())).resolves.toBe(0);
    await expect(cache.get('accounts', `filler-${String(MAX_ENTRIES - 1)}`, z.number())).resolves.toBe(
      MAX_ENTRIES - 1,
    );
  });
});

describe('isEnabled', () => {
  it('is always on — the cache no longer depends on an external store', () => {
    const { cache } = setup();
    expect(cache.isEnabled).toBe(true);
  });
});
