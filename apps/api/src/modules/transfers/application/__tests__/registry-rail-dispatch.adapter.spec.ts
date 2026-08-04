import type { RailProfile } from '@icb/contracts';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { RailRejectedError } from '../../../../common/errors/index.js';
import type { RailRegistry } from '../../../../simulation/rails/rail.registry.js';
import type {
  RailAccepted,
  RailRejected,
  RailSubmission,
} from '../../../../simulation/rails/rail.types.js';
import { RegistryRailDispatchAdapter } from '../registry-rail-dispatch.adapter.js';

const NOW = new Date('2026-08-04T10:00:00.000Z');
const SETTLES_AT = new Date('2026-08-05T10:00:00.000Z');

const SUBMISSION = {
  sourceId: 'tr-1',
  amount: { minorUnits: 10_000, currency: 'GBP' },
} as unknown as RailSubmission;

function accepted(): RailAccepted {
  return {
    accepted: true,
    rail: 'ach',
    railReference: 'TRACE-1',
    settlesAt: SETTLES_AT,
    latencyMs: 12,
    payload: {},
  };
}

function rejected(): RailRejected {
  return {
    accepted: false,
    rail: 'ach',
    code: 'R01',
    label: 'Insufficient funds at the far bank',
    latencyMs: 5,
    payload: {},
  };
}

function profile(cutOffTime: string | null): RailProfile {
  return { rail: 'ach', cutOffTime } as unknown as RailProfile;
}

function setup() {
  const dispatch = vi.fn().mockResolvedValue(accepted());
  const profileFor = vi.fn().mockResolvedValue(profile('14:30'));
  const settlementFor = vi.fn().mockReturnValue({ settlesAt: SETTLES_AT, pastCutOff: false });
  const registry = { dispatch, profileFor, settlementFor } as unknown as RailRegistry;
  return {
    dispatch,
    profileFor,
    settlementFor,
    adapter: new RegistryRailDispatchAdapter(registry),
  };
}

describe('RegistryRailDispatchAdapter.dispatch', () => {
  let context: ReturnType<typeof setup>;

  beforeEach(() => {
    context = setup();
  });

  it('returns the rail reference and settlement instant on acceptance', async () => {
    const outcome = await context.adapter.dispatch('ach', SUBMISSION);

    expect(context.dispatch).toHaveBeenCalledWith('ach', SUBMISSION);
    expect(outcome).toEqual({ railReference: 'TRACE-1', settlesAt: SETTLES_AT });
  });

  it('turns a rail rejection into a RailRejectedError', async () => {
    context.dispatch.mockResolvedValue(rejected());

    const failure = await context.adapter.dispatch('ach', SUBMISSION).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(RailRejectedError);
    expect((failure as RailRejectedError).code).toBe('RAIL_REJECTED');
    expect((failure as RailRejectedError).message).toBe('Insufficient funds at the far bank');
  });
});

describe('RegistryRailDispatchAdapter.estimate', () => {
  let context: ReturnType<typeof setup>;

  beforeEach(() => {
    context = setup();
  });

  it('combines the registry timing with the cut-off pinned onto the UTC day', async () => {
    const estimate = await context.adapter.estimate('ach', NOW);

    expect(context.profileFor).toHaveBeenCalledWith('ach');
    expect(context.settlementFor).toHaveBeenCalledWith(profile('14:30'), NOW);
    expect(estimate.settlesAt).toEqual(SETTLES_AT);
    expect(estimate.cutOffAt).toEqual(new Date('2026-08-04T14:30:00.000Z'));
    expect(estimate.pastCutOff).toBe(false);
  });

  it('reports no cut-off for a rail that has none', async () => {
    context.profileFor.mockResolvedValue(profile(null));

    const estimate = await context.adapter.estimate('ach', NOW);

    expect(estimate.cutOffAt).toBeNull();
  });

  it('handles a single-digit cut-off hour and passes pastCutOff through', async () => {
    context.profileFor.mockResolvedValue(profile('9:05'));
    context.settlementFor.mockReturnValue({
      settlesAt: SETTLES_AT,
      pastCutOff: true,
    });

    const estimate = await context.adapter.estimate('ach', NOW);

    expect(estimate.cutOffAt).toEqual(new Date('2026-08-04T09:05:00.000Z'));
    expect(estimate.pastCutOff).toBe(true);
  });
});
