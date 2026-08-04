import type { Model } from 'mongoose';
import { describe, expect, it, vi } from 'vitest';

import { NotFoundError } from '../../../common/errors/index.js';
import { ClockService } from '../../../simulation/clock/clock.service.js';
import { DEFAULT_FEATURE_FLAGS } from '../domain/feature-flags.constants.js';
import { FeatureFlagsService } from '../feature-flags.service.js';
import type { SimFeatureFlagDoc } from '../infrastructure/simulation.schemas.js';
import { NOW, featureFlagDoc } from './fixtures.js';

function setup(stored: SimFeatureFlagDoc[] = [], found: SimFeatureFlagDoc | null = null) {
  const lean = vi.fn().mockResolvedValue(stored);
  const model = {
    find: vi.fn().mockReturnValue({ sort: vi.fn().mockReturnValue({ lean }), lean }),
    findOne: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue(found) }),
    updateOne: vi.fn().mockResolvedValue({ matchedCount: 1 }),
    insertMany: vi.fn().mockResolvedValue([]),
  };
  const clock = new ClockService();
  clock.freeze(NOW);

  const service = new FeatureFlagsService(model as unknown as Model<SimFeatureFlagDoc>, clock);
  return { service, model, lean };
}

describe('FeatureFlagsService.list', () => {
  it('seeds the shipped defaults into an empty store, stamped with the clock', async () => {
    const { service, model } = setup();

    const flags = await service.list();

    expect(model.insertMany).toHaveBeenCalledTimes(1);
    const [documents, options] = model.insertMany.mock.calls[0] as [SimFeatureFlagDoc[], object];
    expect(documents).toHaveLength(DEFAULT_FEATURE_FLAGS.length);
    expect(documents.map((doc) => doc.key)).toEqual(DEFAULT_FEATURE_FLAGS.map((seed) => seed.key));
    expect(documents[0]).toMatchObject({
      key: 'instant_card_issuance',
      enabled: true,
      rolloutPercentage: 100,
      audience: 'all',
      updatedAt: NOW,
    });
    expect(options).toEqual({ ordered: false });
    expect(flags).toEqual([]);
  });

  it('seeds only the flags the store has never seen', async () => {
    const stored = DEFAULT_FEATURE_FLAGS.slice(0, 3).map((seed) =>
      featureFlagDoc({ key: seed.key, label: seed.label, description: seed.description }),
    );
    const { service, model } = setup(stored);

    const flags = await service.list();

    const [documents] = model.insertMany.mock.calls[0] as [SimFeatureFlagDoc[]];
    expect(documents).toHaveLength(DEFAULT_FEATURE_FLAGS.length - 3);
    expect(documents.map((doc) => doc.key)).not.toContain('instant_card_issuance');
    expect(flags).toHaveLength(3);
    expect(flags[0]).toMatchObject({ key: 'instant_card_issuance', updatedAt: NOW.toISOString() });
  });

  it('does not touch the store when every shipped flag is already there', async () => {
    const stored = DEFAULT_FEATURE_FLAGS.map((seed) =>
      featureFlagDoc({ key: seed.key, label: seed.label, description: seed.description }),
    );
    const { service, model } = setup(stored);

    await service.list();

    expect(model.insertMany).not.toHaveBeenCalled();
  });
});

describe('FeatureFlagsService.get', () => {
  it('returns the mapped flag', async () => {
    const { service } = setup([], featureFlagDoc());

    await expect(service.get('spend_insights')).resolves.toEqual({
      key: 'spend_insights',
      label: 'Spending insights',
      description: 'Categorised spending analysis and month-on-month comparisons.',
      enabled: true,
      rolloutPercentage: 100,
      audience: 'beta',
      updatedAt: NOW.toISOString(),
    });
  });

  it('throws the typed not-found for an unknown key', async () => {
    const { service } = setup();

    await expect(service.get('nope')).rejects.toThrow(NotFoundError);
  });
});

describe('FeatureFlagsService.update', () => {
  it('applies only the patched fields and stamps the change with the clock', async () => {
    const { service, model } = setup([], featureFlagDoc());

    await service.update('spend_insights', { enabled: false });

    expect(model.updateOne).toHaveBeenCalledWith(
      { key: 'spend_insights' },
      {
        $set: {
          enabled: false,
          rolloutPercentage: 100,
          audience: 'beta',
          updatedAt: NOW,
        },
      },
    );
  });

  it('refuses to patch a flag that does not exist', async () => {
    const { service, model } = setup();

    await expect(service.update('nope', { enabled: true })).rejects.toThrow(NotFoundError);
    expect(model.updateOne).not.toHaveBeenCalled();
  });
});

describe('FeatureFlagsService.isEnabled', () => {
  it('is off for a flag the store does not know', async () => {
    const { service } = setup();

    await expect(service.isEnabled('nope', 'customer-1')).resolves.toBe(false);
  });

  it('is off for everyone while the kill switch is off, whatever the rollout says', async () => {
    const { service } = setup([], featureFlagDoc({ enabled: false, rolloutPercentage: 100 }));

    await expect(service.isEnabled('spend_insights', 'customer-1')).resolves.toBe(false);
  });

  it('is on for everyone at full rollout', async () => {
    const { service } = setup([], featureFlagDoc({ enabled: true, rolloutPercentage: 100 }));

    await expect(service.isEnabled('spend_insights', 'customer-1')).resolves.toBe(true);
  });

  it('buckets each subject stably against a partial rollout', async () => {
    const { service } = setup([], featureFlagDoc({ enabled: true, rolloutPercentage: 50 }));

    // FNV-1a of `spend_insights:<subject>` folds these into buckets 3 and 87.
    await expect(service.isEnabled('spend_insights', 'cust-alpha')).resolves.toBe(true);
    await expect(service.isEnabled('spend_insights', 'cust-beta')).resolves.toBe(false);
    // And the draw is stable: the same subject gets the same answer again.
    await expect(service.isEnabled('spend_insights', 'cust-alpha')).resolves.toBe(true);
  });
});
