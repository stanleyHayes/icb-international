import type { Model } from 'mongoose';
import { describe, expect, it, vi } from 'vitest';

import { ConflictError, NotFoundError } from '../../../common/errors/index.js';
import { ClockService } from '../../../simulation/clock/clock.service.js';
import { CustomerNotesService } from '../customer-notes.service.js';
import type { CustomersService } from '../customers.service.js';
import type { CustomerNoteDoc } from '../infrastructure/customer-note.schemas.js';
import { chainQuery, NOW } from './fixtures.js';

const AUTHOR = { id: 'staff-1', name: 'ope@icb.example' };

function noteDoc(overrides: Record<string, unknown> = {}): CustomerNoteDoc {
  return {
    _id: 'note-1',
    customerId: '01J8ZCQ0R0K3M4N5P6Q7R8S9T0',
    body: 'Called about a limit increase',
    authorId: 'staff-1',
    authorName: 'ope@icb.example',
    pinned: false,
    createdAt: NOW,
    ...overrides,
  };
}

function setup() {
  const model = {
    find: vi.fn().mockReturnValue(chainQuery([noteDoc()])),
    create: vi.fn().mockResolvedValue([noteDoc()]),
  };
  const profiles = { require: vi.fn().mockResolvedValue({}) };
  const clock = new ClockService();
  clock.freeze(NOW);

  const service = new CustomerNotesService(
    model as unknown as Model<CustomerNoteDoc>,
    profiles as unknown as CustomersService,
    clock,
  );
  return { model, profiles, service };
}

describe('list', () => {
  it('returns mapped notes, pinned first then newest', async () => {
    const { model, service } = setup();

    const notes = await service.list('01J8ZCQ0R0K3M4N5P6Q7R8S9T0');

    expect(model.find).toHaveBeenCalledWith({ customerId: '01J8ZCQ0R0K3M4N5P6Q7R8S9T0' });
    expect(notes).toHaveLength(1);
    expect(notes[0]).toMatchObject({
      id: 'note-1',
      customerId: '01J8ZCQ0R0K3M4N5P6Q7R8S9T0',
      authorId: 'staff-1',
      pinned: false,
      createdAt: NOW.toISOString(),
    });
  });

  it('throws a typed not-found for an unknown customer', async () => {
    const { profiles, service } = setup();
    profiles.require.mockRejectedValue(new NotFoundError('Customer', 'missing'));

    await expect(service.list('missing')).rejects.toThrow(NotFoundError);
  });
});

describe('create', () => {
  it('persists the note attributed to the authenticated staff member', async () => {
    const { model, service } = setup();

    const note = await service.create(
      '01J8ZCQ0R0K3M4N5P6Q7R8S9T0',
      { body: 'Called about a limit increase', pinned: true },
      AUTHOR,
    );

    const [rows] = model.create.mock.calls[0] as [Record<string, unknown>[]];
    expect(rows[0]).toMatchObject({
      customerId: '01J8ZCQ0R0K3M4N5P6Q7R8S9T0',
      body: 'Called about a limit increase',
      pinned: true,
      authorId: 'staff-1',
      authorName: 'ope@icb.example',
      createdAt: NOW,
    });
    expect(typeof rows[0]?.['_id']).toBe('string');
    expect(note.id).toBe('note-1');
  });

  it('throws a typed conflict when the insert yields no document', async () => {
    const { model, service } = setup();
    model.create.mockResolvedValue([]);

    await expect(
      service.create('01J8ZCQ0R0K3M4N5P6Q7R8S9T0', { body: 'x', pinned: false }, AUTHOR),
    ).rejects.toThrow(ConflictError);
  });
});
