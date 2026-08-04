import type { Model } from 'mongoose';
import { describe, expect, it, vi } from 'vitest';

import { ClockService } from '../../../simulation/clock/clock.service.js';
import { DUPLICATE_KEY_CODE } from '../../database/database.constants.js';
import { MongoIdempotencyStore } from '../idempotency-store.service.js';
import { IDEMPOTENCY_STATES, type IdempotencyRecordDoc } from '../idempotency.schemas.js';

const NOW = new Date('2026-08-02T12:00:00.000Z');
const RECORD = { scope: 'cust-1:POST:/v1/transfers', key: 'key-1', statusCode: 201, body: { ok: true } };

function setup() {
  const exec = vi.fn();
  const model = {
    create: vi.fn(),
    updateOne: vi.fn().mockResolvedValue({ matchedCount: 0 }),
    deleteOne: vi.fn().mockResolvedValue({ deletedCount: 1 }),
    findOne: vi.fn(() => ({ lean: () => ({ exec }) })),
  };
  const clock = new ClockService();
  clock.freeze(NOW);
  const store = new MongoIdempotencyStore(
    model as unknown as Model<IdempotencyRecordDoc>,
    clock,
  );
  return { exec, model, store };
}

const duplicateKey = () => Object.assign(new Error('dup'), { code: DUPLICATE_KEY_CODE });

describe('find', () => {
  it('returns the stored response for a matching scope and key', async () => {
    const { exec, model, store } = setup();
    exec.mockResolvedValue({ ...RECORD, state: IDEMPOTENCY_STATES.COMPLETED, _id: 'rec-1', createdAt: NOW });

    const found = await store.find(RECORD.scope, RECORD.key);

    expect(model.findOne).toHaveBeenCalledWith({ scope: RECORD.scope, key: RECORD.key });
    expect(found).toEqual(RECORD);
  });

  it('returns null when nothing was stored under the key', async () => {
    const { exec, store } = setup();
    exec.mockResolvedValue(null);

    await expect(store.find(RECORD.scope, RECORD.key)).resolves.toBeNull();
  });

  it('reads a pending claim as absent — it holds no replayable response yet', async () => {
    const { exec, store } = setup();
    exec.mockResolvedValue({
      scope: RECORD.scope,
      key: RECORD.key,
      state: IDEMPOTENCY_STATES.PENDING,
      statusCode: null,
      body: null,
      createdAt: NOW,
    });

    await expect(store.find(RECORD.scope, RECORD.key)).resolves.toBeNull();
  });
});

describe('claim', () => {
  it('inserts a pending record with a clock-derived timestamp and reports the win', async () => {
    const { model, store } = setup();
    model.create.mockResolvedValue([{ _id: 'rec-1' }]);

    await expect(store.claim(RECORD.scope, RECORD.key)).resolves.toEqual({ outcome: 'claimed' });
    expect(model.create).toHaveBeenCalledWith({
      scope: RECORD.scope,
      key: RECORD.key,
      state: IDEMPOTENCY_STATES.PENDING,
      statusCode: null,
      body: null,
      createdAt: NOW,
    });
  });

  it('loses the insert race to a completed record and hands it back for replay', async () => {
    const { exec, model, store } = setup();
    model.create.mockRejectedValue(duplicateKey());
    exec.mockResolvedValue({ ...RECORD, state: IDEMPOTENCY_STATES.COMPLETED, createdAt: NOW });

    await expect(store.claim(RECORD.scope, RECORD.key)).resolves.toEqual({
      outcome: 'completed',
      record: RECORD,
    });
  });

  it('loses the insert race to a pending record and reports the key in flight', async () => {
    const { exec, model, store } = setup();
    model.create.mockRejectedValue(duplicateKey());
    exec.mockResolvedValue({
      scope: RECORD.scope,
      key: RECORD.key,
      state: IDEMPOTENCY_STATES.PENDING,
      statusCode: null,
      body: null,
      createdAt: NOW,
    });

    await expect(store.claim(RECORD.scope, RECORD.key)).resolves.toEqual({ outcome: 'pending' });
  });

  it('propagates any other write failure', async () => {
    const { model, store } = setup();
    model.create.mockRejectedValue(new Error('connection lost'));

    await expect(store.claim(RECORD.scope, RECORD.key)).rejects.toThrow('connection lost');
  });
});

describe('save', () => {
  it('completes the caller\'s pending claim instead of inserting a second row', async () => {
    const { model, store } = setup();
    model.updateOne.mockResolvedValue({ matchedCount: 1 });

    await store.save(RECORD);

    expect(model.updateOne).toHaveBeenCalledWith(
      { scope: RECORD.scope, key: RECORD.key, state: IDEMPOTENCY_STATES.PENDING },
      { $set: { ...RECORD, state: IDEMPOTENCY_STATES.COMPLETED, createdAt: NOW } },
    );
    expect(model.create).not.toHaveBeenCalled();
  });

  it('inserts the record with a clock-derived timestamp when no claim exists', async () => {
    const { model, store } = setup();
    model.create.mockResolvedValue([{ _id: 'rec-1' }]);

    await store.save(RECORD);

    expect(model.create).toHaveBeenCalledWith({
      ...RECORD,
      state: IDEMPOTENCY_STATES.COMPLETED,
      createdAt: NOW,
    });
  });

  it('treats a duplicate-key loss as first-write-wins, not a failure', async () => {
    const { model, store } = setup();
    model.create.mockRejectedValue(duplicateKey());

    await expect(store.save(RECORD)).resolves.toBeUndefined();
  });

  it('propagates any other write failure', async () => {
    const { model, store } = setup();
    model.create.mockRejectedValue(new Error('connection lost'));

    await expect(store.save(RECORD)).rejects.toThrow('connection lost');
  });
});

describe('release', () => {
  it('deletes only a still-pending claim, never a stored response', async () => {
    const { model, store } = setup();

    await store.release(RECORD.scope, RECORD.key);

    expect(model.deleteOne).toHaveBeenCalledWith({
      scope: RECORD.scope,
      key: RECORD.key,
      state: IDEMPOTENCY_STATES.PENDING,
    });
  });
});
