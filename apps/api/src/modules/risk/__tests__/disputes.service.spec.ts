import type { CreateDisputeRequest } from '@icb/contracts';
import type { Model } from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ConflictError, NotFoundError } from '../../../common/errors/index.js';
import { encodeCursor } from '../../../common/pagination/cursor.js';
import { ClockService } from '../../../simulation/clock/clock.service.js';
import { DisputesService } from '../disputes.service.js';
import type { DisputeDoc } from '../infrastructure/dispute.schemas.js';
import {
  CUSTOMER_ID,
  DISPUTE_ID,
  NOW,
  TRANSACTION_ID,
  chainQuery,
  disputeDoc,
} from './fixtures.js';

function frozenClock(): ClockService {
  const clock = new ClockService();
  clock.freeze(NOW);
  return clock;
}

const SUBJECT = {
  accountId: 'acct-1',
  amountMinorUnits: 25_000,
  currency: 'GBP',
  customerName: 'Ama Mensah',
  description: 'Shoprite Accra',
};

function raiseRequest(overrides: Record<string, unknown> = {}): CreateDisputeRequest {
  return {
    transactionId: TRANSACTION_ID,
    reason: 'unauthorised',
    detail: 'I did not make this payment',
    contactedMerchant: false,
    evidence: [],
    ...overrides,
  };
}

function setup(found: DisputeDoc | null = disputeDoc()) {
  const model = {
    exists: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockImplementation(([doc]: [DisputeDoc]) => Promise.resolve([doc])),
    find: vi.fn().mockReturnValue(chainQuery([disputeDoc()])),
    findOne: vi.fn().mockReturnValue(chainQuery(found)),
    findById: vi.fn().mockReturnValue(chainQuery(found)),
    updateOne: vi.fn().mockResolvedValue({}),
  };
  const subjects = { resolve: vi.fn().mockResolvedValue(SUBJECT) };
  const stages = { advance: vi.fn().mockResolvedValue(disputeDoc()) };
  const service = new DisputesService(
    model as unknown as Model<DisputeDoc>,
    subjects as never,
    stages as never,
    frozenClock(),
  );
  return { service, model, subjects, stages, found };
}

describe('DisputesService.raise', () => {
  let deps: ReturnType<typeof setup>;

  beforeEach(() => {
    deps = setup();
  });

  it('stores the claim with the initial stage, SLA and opening timeline entry', async () => {
    const dispute = await deps.service.raise(CUSTOMER_ID, raiseRequest());

    expect(deps.subjects.resolve).toHaveBeenCalledWith(CUSTOMER_ID, TRANSACTION_ID);
    expect(deps.model.create).toHaveBeenCalledWith([
      expect.objectContaining({
        customerId: CUSTOMER_ID,
        stage: 'submitted',
        outcome: null,
        slaDueAt: expect.any(Date),
      }),
    ]);
    expect(dispute.id).toEqual(expect.any(String));
  });

  it('rejects a transaction already under dispute', async () => {
    deps.model.exists.mockResolvedValue({ _id: DISPUTE_ID });
    await expect(deps.service.raise(CUSTOMER_ID, raiseRequest())).rejects.toBeInstanceOf(
      ConflictError,
    );
  });

  it('fails the call when the insert returns nothing', async () => {
    deps.model.create.mockResolvedValue([]);
    await expect(deps.service.raise(CUSTOMER_ID, raiseRequest())).rejects.toBeInstanceOf(
      ConflictError,
    );
  });
});

describe('DisputesService.listForCustomer', () => {
  it('scopes to the owner and asks for limit + 1', async () => {
    const { service, model } = setup();
    await service.listForCustomer(CUSTOMER_ID, { limit: 10 });

    expect(model.find).toHaveBeenCalledWith({ customerId: CUSTOMER_ID });
    const query = model.find.mock.results[0]?.value as ReturnType<typeof chainQuery>;
    expect(query.limit).toHaveBeenCalledWith(11);
  });

  it('applies cursor, stage and reason filters when given', async () => {
    const { service, model } = setup();
    await service.listForCustomer(CUSTOMER_ID, {
      limit: 5,
      cursor: encodeCursor('some-id'),
      stage: ['submitted'],
      reason: ['unauthorised'],
    });

    expect(model.find).toHaveBeenCalledWith({
      customerId: CUSTOMER_ID,
      _id: { $lt: 'some-id' },
      stage: { $in: ['submitted'] },
      reason: { $in: ['unauthorised'] },
    });
  });
});

describe('DisputesService.queue', () => {
  it('sorts most overdue first and filters overdue rows when asked', async () => {
    const { service, model } = setup();
    await service.queue({ limit: 10, overdueOnly: true });

    expect(model.find).toHaveBeenCalledWith({
      slaDueAt: { $lt: NOW },
      stage: { $ne: 'resolved' },
    });
  });

  it('pages by (deadline, id) keyset when a cursor is present', async () => {
    const { service, model } = setup();
    const cursor = encodeCursor(`2026-08-10T00:00:00.000Z|abc`);
    await service.queue({ limit: 10, cursor });

    expect(model.find).toHaveBeenCalledWith({
      $or: [
        { slaDueAt: { $gt: new Date('2026-08-10T00:00:00.000Z') } },
        { slaDueAt: new Date('2026-08-10T00:00:00.000Z'), _id: { $gt: 'abc' } },
      ],
    });
  });
});

describe('DisputesService.getForCustomer and byIdForStaff', () => {
  it('throws NotFoundError when the dispute is not the caller\'s', async () => {
    const { service } = setup(null);
    await expect(service.getForCustomer(DISPUTE_ID, CUSTOMER_ID)).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it('throws NotFoundError for a staff lookup of a missing dispute', async () => {
    const { service } = setup(null);
    await expect(service.byIdForStaff(DISPUTE_ID)).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe('DisputesService.attachEvidence', () => {
  it('pushes new evidence and re-reads the dispute', async () => {
    const { service, model } = setup();
    await service.attachEvidence(DISPUTE_ID, CUSTOMER_ID, [
      { label: 'Receipt', asset: { provider: 'cloudinary', publicId: 'p1' } },
    ] as never);

    expect(model.updateOne).toHaveBeenCalledWith(
      { _id: DISPUTE_ID, customerId: CUSTOMER_ID },
      expect.objectContaining({
        $push: { evidence: { $each: [expect.objectContaining({ label: 'Receipt', uploadedBy: 'customer' })] } },
      }),
    );
  });

  it('refuses evidence on a closed dispute', async () => {
    const { service } = setup(disputeDoc({ stage: 'resolved' }));
    await expect(
      service.attachEvidence(DISPUTE_ID, CUSTOMER_ID, []),
    ).rejects.toBeInstanceOf(ConflictError);
  });
});

describe('DisputesService.advance', () => {
  it('delegates the stage transition to the stage service', async () => {
    const { service, stages } = setup();
    const staff = { id: 'staff-1', label: 'Analyst' };
    const request = { stage: 'under_review', note: 'Looking' } as never;

    await service.advance(DISPUTE_ID, staff, request);
    expect(stages.advance).toHaveBeenCalledWith(DISPUTE_ID, staff, request);
  });
});
