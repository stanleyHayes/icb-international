import { idSchema } from '@icb/contracts';
import { describe, expect, it } from 'vitest';

import { createFactoryContext } from '../core/context.js';

const ID_BATCH = 200;

describe('createFactoryContext', () => {
  it('generates schema-valid ULIDs', () => {
    const ctx = createFactoryContext({ seed: 1 });
    for (let index = 0; index < ID_BATCH; index += 1) {
      expect(idSchema.safeParse(ctx.nextId()).success).toBe(true);
    }
  });

  it('never repeats an id within a run', () => {
    const ctx = createFactoryContext({ seed: 1 });
    const ids = new Set(Array.from({ length: ID_BATCH }, () => ctx.nextId()));
    expect(ids.size).toBe(ID_BATCH);
  });

  it('is deterministic: same seed, same ids and same faker output', () => {
    const first = createFactoryContext({ seed: 7 });
    const second = createFactoryContext({ seed: 7 });
    expect(first.nextId()).toBe(second.nextId());
    expect(first.faker.person.fullName()).toBe(second.faker.person.fullName());
    expect(first.reference('TRF')).toBe(second.reference('TRF'));
  });

  it('diverges across seeds', () => {
    const first = createFactoryContext({ seed: 1 });
    const second = createFactoryContext({ seed: 2 });
    expect(first.nextId()).not.toBe(second.nextId());
  });

  it('builds human-facing references in the API shape', () => {
    const ctx = createFactoryContext({ seed: 3 });
    expect(ctx.reference('TRF')).toMatch(/^TRF-[0-9A-HJKMNP-TV-Z]{8}$/);
  });

  it('provides bounded integers, picks, chances, and digit strings', () => {
    const ctx = createFactoryContext({ seed: 5 });
    expect(ctx.intBetween(3, 3)).toBe(3);
    expect(['a', 'b']).toContain(ctx.pick(['a', 'b'] as const));
    expect(ctx.chance(1)).toBe(true);
    expect(ctx.chance(0)).toBe(false);
    expect(ctx.digits(10)).toMatch(/^[1-9]\d{9}$/);
  });

  it('respects an injected clock', () => {
    const ctx = createFactoryContext({ seed: 1 });
    ctx.clock.advanceDays(1);
    const laterId = ctx.nextId();
    const earlierCtx = createFactoryContext({ seed: 1 });
    const earlierId = earlierCtx.nextId();
    // ULIDs are time-ordered: advancing the clock must sort after.
    expect(laterId > earlierId).toBe(true);
  });
});
