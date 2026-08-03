import { describe, expect, it } from 'vitest';

import { KeyedMutex } from '../keyed-mutex.js';

/** Resolve on a later macrotask, so interleaving is actually possible if the lock is broken. */
const yieldTurn = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 1));

describe('KeyedMutex', () => {
  it('serialises work sharing a key', async () => {
    const mutex = new KeyedMutex();
    let inFlight = 0;
    let peak = 0;

    await Promise.all(
      Array.from({ length: 50 }, () =>
        mutex.withKeys(['account:1'], async () => {
          inFlight += 1;
          peak = Math.max(peak, inFlight);
          await yieldTurn();
          inFlight -= 1;
        }),
      ),
    );

    expect(peak).toBe(1);
  });

  it('lets different keys run at the same time', async () => {
    const mutex = new KeyedMutex();
    let inFlight = 0;
    let peak = 0;

    await Promise.all(
      Array.from({ length: 8 }, (_unused, index) =>
        mutex.withKeys([`account:${index}`], async () => {
          inFlight += 1;
          peak = Math.max(peak, inFlight);
          await yieldTurn();
          inFlight -= 1;
        }),
      ),
    );

    expect(peak).toBe(8);
  });

  it('preserves arrival order for one key', async () => {
    const mutex = new KeyedMutex();
    const order: number[] = [];

    await Promise.all(
      Array.from({ length: 10 }, (_unused, index) =>
        mutex.withKeys(['ledger'], async () => {
          await yieldTurn();
          order.push(index);
        }),
      ),
    );

    expect(order).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it('releases the key when the work throws, so the queue keeps moving', async () => {
    const mutex = new KeyedMutex();

    await expect(
      mutex.withKeys(['account:1'], () => Promise.reject(new Error('posting rejected'))),
    ).rejects.toThrow('posting rejected');

    await expect(mutex.withKeys(['account:1'], () => Promise.resolve('next'))).resolves.toBe(
      'next',
    );
    expect(mutex.activeKeys).toBe(0);
  });

  it('does not deadlock when two callers want the same pair in opposite orders', async () => {
    const mutex = new KeyedMutex();

    const both = await Promise.all([
      mutex.withKeys(['a', 'b'], async () => {
        await yieldTurn();
        return 'first';
      }),
      mutex.withKeys(['b', 'a'], async () => {
        await yieldTurn();
        return 'second';
      }),
    ]);

    expect(both).toEqual(['first', 'second']);
  });

  it('runs unkeyed work without touching the queue', async () => {
    const mutex = new KeyedMutex();

    await expect(mutex.withKeys([], () => Promise.resolve(7))).resolves.toBe(7);
    expect(mutex.activeKeys).toBe(0);
  });

  it('forgets keys once nobody holds them, so the map cannot grow without bound', async () => {
    const mutex = new KeyedMutex();

    await Promise.all(
      Array.from({ length: 200 }, (_unused, index) =>
        mutex.withKeys([`account:${index}`], () => Promise.resolve()),
      ),
    );

    expect(mutex.activeKeys).toBe(0);
  });
});
