import { beforeEach, describe, expect, it } from 'vitest';

import { ConflictError, ForbiddenError, NotFoundError } from '../../../common/errors/index.js';
import { ClockService } from '../../../simulation/clock/clock.service.js';
import { StaffService } from '../staff.service.js';
import { InMemoryStaffStore, staffDoc } from './fakes.js';

const START = new Date('2026-01-05T09:00:00.000Z');

describe('StaffService', () => {
  let store: InMemoryStaffStore;
  let clock: ClockService;
  let service: StaffService;

  beforeEach(() => {
    store = new InMemoryStaffStore();
    clock = new ClockService();
    clock.freeze(START);
    service = new StaffService(store, clock);
  });

  const createInput = {
    email: 'ADA@icb.example',
    firstName: 'Ada',
    lastName: 'Admin',
    roles: ['admin' as const],
  };

  it('creates a staff user with policy defaults and a normalised email', async () => {
    const created = await service.createStaff(createInput);

    expect(created.email).toBe('ada@icb.example');
    expect(created.active).toBe(true);
    expect(created.lastLoginAt).toBeNull();
    expect(created.createdAt).toBe(START.toISOString());
    expect(created.roles).toEqual(['admin']);
  });

  it('rejects a duplicate email regardless of case', async () => {
    await service.createStaff(createInput);
    await expect(service.createStaff({ ...createInput, email: 'ada@ICB.example' })).rejects.toBeInstanceOf(
      ConflictError,
    );
  });

  it('lists staff sorted by name', async () => {
    await service.createStaff(createInput);
    await service.createStaff({ ...createInput, email: 'zed@icb.example', firstName: 'Zed', lastName: 'Zyler' });
    const listed = await service.listStaff();
    expect(listed.map((user) => user.lastName)).toEqual(['Admin', 'Zyler']);
  });

  it('returns a staff user by id and throws NOT_FOUND for a stranger', async () => {
    const created = await service.createStaff(createInput);
    expect((await service.getStaff(created.id)).id).toBe(created.id);
    await expect(service.getStaff(staffDoc()._id)).rejects.toBeInstanceOf(NotFoundError);
  });

  it('updates roles', async () => {
    const created = await service.createStaff(createInput);
    const updated = await service.updateStaff(
      created.id,
      { roles: ['admin', 'compliance'] },
      'someone-else',
    );
    expect(updated.roles).toEqual(['admin', 'compliance']);
  });

  it('refuses to leave a staff user with no roles', async () => {
    const created = await service.createStaff(createInput);
    await expect(
      service.updateStaff(created.id, { roles: [] }, 'someone-else'),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it('blocks an operator deactivating their own account', async () => {
    const created = await service.createStaff(createInput);
    await expect(
      service.updateStaff(created.id, { active: false }, created.id),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('allows deactivating a different operator', async () => {
    const created = await service.createStaff(createInput);
    const updated = await service.updateStaff(created.id, { active: false }, 'actor-2');
    expect(updated.active).toBe(false);
  });

  it('records the login instant from the clock, not the wall', async () => {
    const created = await service.createStaff(createInput);
    clock.advance(60_000);
    await service.recordLogin(created.id);
    expect((await service.getStaff(created.id)).lastLoginAt).toBe(
      new Date(START.getTime() + 60_000).toISOString(),
    );
  });

  it('exposes held roles for guard-side permission resolution', async () => {
    const created = await service.createStaff(createInput);
    await expect(service.rolesOf(created.id)).resolves.toEqual(['admin']);
  });
});
