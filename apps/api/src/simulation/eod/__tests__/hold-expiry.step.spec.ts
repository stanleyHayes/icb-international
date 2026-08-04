import { describe, expect, it, vi } from 'vitest';

import { HoldExpiryStep } from '../steps/hold-expiry.step.js';
import { CONTEXT } from './fixtures.js';

describe('HoldExpiryStep', () => {
  it('returns the number of holds released', async () => {
    const holds = { expireDue: vi.fn().mockResolvedValue(3) };
    const step = new HoldExpiryStep(holds as never);

    expect(await step.run(CONTEXT)).toBe(3);
    expect(holds.expireDue).toHaveBeenCalledTimes(1);
  });

  it('is a quiet no-op when nothing is due', async () => {
    const holds = { expireDue: vi.fn().mockResolvedValue(0) };
    const step = new HoldExpiryStep(holds as never);

    expect(await step.run(CONTEXT)).toBe(0);
  });
});
