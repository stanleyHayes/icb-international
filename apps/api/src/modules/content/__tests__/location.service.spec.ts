import type { Model } from 'mongoose';
import { describe, expect, it, vi } from 'vitest';

import { NotFoundError } from '../../../common/errors/index.js';
import { ClockService } from '../../../simulation/clock/clock.service.js';
import { LocationService } from '../application/location.service.js';
import type { ContentLocationDoc } from '../infrastructure/content.schemas.js';

const NOW = new Date('2026-08-02T12:00:00.000Z');

function locationDoc(overrides: Partial<ContentLocationDoc> = {}): ContentLocationDoc {
  return {
    _id: 'loc-1',
    name: 'Osu Branch',
    type: 'branch',
    address: {
      line1: '12 Oxford Street',
      line2: null,
      city: 'Accra',
      region: 'Greater Accra',
      postalCode: null,
      country: 'GH',
    },
    latitude: 5.555,
    longitude: -0.183,
    hours: 'Mon–Fri 08:30–16:00',
    services: ['cash', 'foreign exchange'],
    active: true,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function setup() {
  const locations = {
    find: vi.fn(() => ({
      sort: vi.fn(() => ({ lean: vi.fn().mockResolvedValue([locationDoc()]) })),
    })),
    findOneAndUpdate: vi.fn(() => ({ lean: vi.fn().mockResolvedValue(locationDoc()) })),
    create: vi.fn((docs: unknown[]) => Promise.resolve(docs)),
    deleteOne: vi.fn().mockResolvedValue({ deletedCount: 1 }),
  };
  const clock = new ClockService();
  clock.freeze(NOW);
  const service = new LocationService(locations as unknown as Model<ContentLocationDoc>, clock);
  return { service, locations };
}

const CREATE_INPUT = {
  name: 'Osu Branch',
  type: 'branch' as const,
  address: { line1: '12 Oxford Street', city: 'Accra', country: 'GH' },
  hours: 'Mon–Fri 08:30–16:00',
  services: ['cash'],
  active: true,
};

describe('LocationService', () => {
  it('lists active locations for the public site only', async () => {
    const { service, locations } = setup();
    const views = await service.listActive();
    expect(locations.find).toHaveBeenCalledWith({ active: true });
    expect(views[0]?.address.city).toBe('Accra');
    expect(views[0]?.services).toEqual(['cash', 'foreign exchange']);
  });

  it('normalises absent coordinates to null on create', async () => {
    const { service, locations } = setup();
    await service.create(CREATE_INPUT);
    const written = locations.create.mock.calls[0]?.[0] as Record<string, unknown>[];
    expect(written[0]?.['latitude']).toBeNull();
    expect(written[0]?.['longitude']).toBeNull();
    expect(written[0]?.['createdAt']).toEqual(NOW);
  });

  it('updates and stamps the simulation clock', async () => {
    const { service, locations } = setup();
    const view = await service.update('loc-1', { active: false });
    const [, update] = locations.findOneAndUpdate.mock.calls[0] as unknown as [
      unknown,
      { $set: Record<string, unknown> },
    ];
    expect(update.$set['active']).toBe(false);
    expect(update.$set['updatedAt']).toEqual(NOW);
    expect(view.id).toBe('loc-1');
  });

  it('throws NotFoundError when updating a missing location', async () => {
    const { service, locations } = setup();
    locations.findOneAndUpdate.mockReturnValue({ lean: vi.fn().mockResolvedValue(null) });
    await expect(service.update('missing', { name: 'New name' })).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it('throws NotFoundError when deleting a missing location', async () => {
    const { service, locations } = setup();
    locations.deleteOne.mockResolvedValue({ deletedCount: 0 });
    await expect(service.remove('missing')).rejects.toBeInstanceOf(NotFoundError);
  });
});
