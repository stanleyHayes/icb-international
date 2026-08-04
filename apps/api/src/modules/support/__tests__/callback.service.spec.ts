import type { Model } from 'mongoose';
import { describe, expect, it, vi } from 'vitest';

import { NotFoundError } from '../../../common/errors/index.js';
import { ClockService } from '../../../simulation/clock/clock.service.js';
import type { AccessTokenClaims } from '../../auth/application/token.service.js';
import type { CustomerDoc } from '../../customers/infrastructure/customer.schemas.js';
import { CallbackService } from '../application/callback.service.js';
import { CallbackAlreadyHandledError } from '../domain/support-errors.js';
import type { SupportCallbackDoc } from '../infrastructure/support.schemas.js';
import { CALLBACK_LIST_LIMIT } from '../support.constants.js';

const NOW = new Date('2026-08-04T10:00:00.000Z');

const AGENT: AccessTokenClaims = {
  sub: 'st-9',
  customerId: null,
  email: 'agent@icb.example',
  roles: ['support'],
  sessionId: 'ses-1',
};

function callbackDoc(overrides: Partial<SupportCallbackDoc> = {}): SupportCallbackDoc {
  return {
    _id: 'cb-1',
    reference: 'CB-8F3K2M9Q',
    customerId: 'cus-1',
    customerName: 'Amara Mensah',
    phone: '+233201234567',
    reason: 'Card declined twice',
    preferredWindow: 'morning',
    ticketId: null,
    status: 'pending',
    requestedAt: NOW,
    handledBy: null,
    handledAt: null,
    notes: null,
    ...overrides,
  };
}

function customerDoc(): CustomerDoc {
  return {
    _id: 'cus-1',
    type: 'individual',
    email: 'amara@example.com',
    individual: { firstName: 'Amara', middleName: '', lastName: 'Mensah' },
  } as unknown as CustomerDoc;
}

function setup(
  options: {
    customer?: CustomerDoc | null;
    rows?: SupportCallbackDoc[];
    handleResult?: SupportCallbackDoc | null;
    existing?: SupportCallbackDoc | null;
  } = {},
) {
  const lean = vi.fn().mockResolvedValue(options.rows ?? [callbackDoc()]);
  const limit = vi.fn(() => ({ lean }));
  const sort = vi.fn(() => ({ limit }));
  const callbacks = {
    create: vi.fn((docs: unknown[]) => Promise.resolve(docs)),
    find: vi.fn(() => ({ sort })),
    findOneAndUpdate: vi.fn(() => ({
      lean: vi.fn().mockResolvedValue(
        options.handleResult === undefined
          ? callbackDoc({ status: 'completed', handledBy: 'st-9', handledAt: NOW })
          : options.handleResult,
      ),
    })),
    findById: vi.fn(() => ({
      lean: vi.fn().mockResolvedValue(
        options.existing === undefined ? callbackDoc({ status: 'completed' }) : options.existing,
      ),
    })),
  };
  const customers = {
    findById: vi.fn(() => ({
      lean: vi.fn().mockResolvedValue(options.customer === undefined ? customerDoc() : options.customer),
    })),
  };
  const clock = new ClockService();
  clock.freeze(NOW);

  const service = new CallbackService(
    callbacks as unknown as Model<SupportCallbackDoc>,
    customers as unknown as Model<CustomerDoc>,
    clock,
  );
  return { service, callbacks, customers, sort, limit };
}

describe('CallbackService.request', () => {
  it('files a pending request denormalised with the customer display name', async () => {
    const { service, callbacks } = setup();

    const view = await service.request('cus-1', {
      phone: '+233201234567',
      reason: 'Card declined twice',
      preferredWindow: 'morning',
    });

    const sent = callbacks.create.mock.calls[0]?.[0]?.[0] as Record<string, unknown>;
    expect(sent).toMatchObject({
      customerId: 'cus-1',
      customerName: 'Amara Mensah',
      phone: '+233201234567',
      preferredWindow: 'morning',
      ticketId: null,
      status: 'pending',
      requestedAt: NOW,
      handledBy: null,
      handledAt: null,
      notes: null,
    });
    expect(view.status).toBe('pending');
    expect(view.requestedAt).toBe(NOW.toISOString());
  });

  it('keeps the originating ticket when one is given', async () => {
    const { service, callbacks } = setup();

    await service.request('cus-1', {
      phone: '+233201234567',
      reason: 'Follow-up on open ticket',
      preferredWindow: 'any',
      ticketId: 't-1',
    });

    const sent = callbacks.create.mock.calls[0]?.[0]?.[0] as Record<string, unknown>;
    expect(sent['ticketId']).toBe('t-1');
  });

  it('rejects a customer that does not exist', async () => {
    const { service, callbacks } = setup({ customer: null });

    await expect(
      service.request('cus-x', {
        phone: '+233201234567',
        reason: 'Card declined twice',
        preferredWindow: 'any',
      }),
    ).rejects.toThrow(NotFoundError);
    expect(callbacks.create).not.toHaveBeenCalled();
  });
});

describe('CallbackService.listForCustomer', () => {
  it('returns the newest requests first, capped at the list limit', async () => {
    const { service, callbacks, sort, limit } = setup();

    const views = await service.listForCustomer('cus-1');

    expect(callbacks.find).toHaveBeenCalledWith({ customerId: 'cus-1' });
    expect(sort).toHaveBeenCalledWith({ requestedAt: -1 });
    expect(limit).toHaveBeenCalledWith(CALLBACK_LIST_LIMIT);
    expect(views[0]).toMatchObject({ id: 'cb-1', reference: 'CB-8F3K2M9Q' });
  });
});

describe('CallbackService.listForStaff', () => {
  function findFilter(callbacks: { find: ReturnType<typeof vi.fn> }): unknown {
    return (callbacks.find.mock.calls[0] as unknown[])[0];
  }

  it('serves the queue oldest first', async () => {
    const { service, callbacks, sort } = setup();

    await service.listForStaff({ status: 'pending' });

    expect(findFilter(callbacks)).toEqual({ status: 'pending' });
    expect(sort).toHaveBeenCalledWith({ requestedAt: 1 });
  });

  it('lists every status when no filter is given', async () => {
    const { service, callbacks } = setup();

    await service.listForStaff({});

    expect(findFilter(callbacks)).toEqual({});
  });
});

describe('CallbackService.complete', () => {
  it('marks the request completed by the agent with notes and the frozen time', async () => {
    const { service, callbacks } = setup();

    const view = await service.complete('cb-1', AGENT, 'Resolved over the phone');

    expect(callbacks.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: 'cb-1', status: 'pending' },
      {
        $set: {
          status: 'completed',
          handledBy: 'st-9',
          handledAt: NOW,
          notes: 'Resolved over the phone',
        },
      },
      { new: true },
    );
    expect(view.status).toBe('completed');
    expect(view.handledBy).toBe('st-9');
    expect(view.handledAt).toBe(NOW.toISOString());
  });
});

describe('CallbackService.cancel', () => {
  it('marks the request cancelled without notes', async () => {
    const { service, callbacks } = setup({
      handleResult: callbackDoc({ status: 'cancelled', handledBy: 'st-9', handledAt: NOW }),
    });

    const view = await service.cancel('cb-1', AGENT);

    expect(callbacks.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: 'cb-1', status: 'pending' },
      { $set: { status: 'cancelled', handledBy: 'st-9', handledAt: NOW, notes: null } },
      { new: true },
    );
    expect(view.status).toBe('cancelled');
    expect(view.notes).toBeNull();
  });
});

describe('CallbackService double-handling', () => {
  it('rejects a second handling with a conflict', async () => {
    const { service } = setup({ handleResult: null });

    await expect(service.complete('cb-1', AGENT, null)).rejects.toThrow(
      CallbackAlreadyHandledError,
    );
  });

  it('reports not found when the request does not exist at all', async () => {
    const { service } = setup({ handleResult: null, existing: null });

    await expect(service.cancel('cb-x', AGENT)).rejects.toThrow(NotFoundError);
  });
});
