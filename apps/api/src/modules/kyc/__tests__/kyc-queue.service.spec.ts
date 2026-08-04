import type { KycQueueQuery } from '@icb/contracts';
import type { Model } from 'mongoose';
import { describe, expect, it, vi } from 'vitest';

import { NotFoundError } from '../../../common/errors/index.js';
import { ClockService } from '../../../simulation/clock/clock.service.js';
import type { KycCaseDoc } from '../infrastructure/kyc.schemas.js';
import { KycQueueService } from '../application/kyc-queue.service.js';
import { CASE_ID, CUSTOMER_ID, NOW, chainQuery, kycCaseDoc } from './fixtures.js';

function setup(rows: KycCaseDoc[] = [kycCaseDoc()], total = 1) {
  const findChain = chainQuery(rows);
  const cases = {
    find: vi.fn().mockReturnValue(findChain),
    findById: vi.fn().mockReturnValue(chainQuery(rows[0] ?? null)),
    countDocuments: vi.fn().mockResolvedValue(total),
  };
  const clock = new ClockService();
  clock.freeze(NOW);

  const service = new KycQueueService(cases as unknown as Model<KycCaseDoc>, clock);
  return { service, cases, findChain };
}

function filterPassedTo(cases: ReturnType<typeof setup>['cases']): Record<string, unknown> {
  return cases.find.mock.calls[0]?.[0] as Record<string, unknown>;
}

describe('KycQueueService.list', () => {
  it('pages by SLA deadline ascending over the actionable statuses by default', async () => {
    const { service, cases, findChain } = setup([kycCaseDoc()], 7);

    const page = await service.list({ page: 2, limit: 3 });

    expect(filterPassedTo(cases)).toEqual({
      status: { $in: ['pending_review', 'more_info_required'] },
    });
    expect(findChain['sort']).toHaveBeenCalledWith({ slaDueAt: 1, createdAt: 1 });
    expect(findChain['skip']).toHaveBeenCalledWith(3);
    expect(findChain['limit']).toHaveBeenCalledWith(3);
    expect(cases.countDocuments).toHaveBeenCalledWith(filterPassedTo(cases));
    expect(page).toMatchObject({ page: 2, limit: 3, total: 7, totalPages: 3 });
    expect(page.items).toHaveLength(1);
    expect(page.items[0]?.id).toBe(CASE_ID);
  });

  it('applies every filter the staff console offers', async () => {
    const { service, cases } = setup();
    const query: KycQueueQuery = {
      page: 1,
      limit: 25,
      status: ['approved', 'rejected'],
      level: 'tier_3',
      riskRating: 'high',
      assignedTo: 'staff-1',
      overdueOnly: true,
    };

    await service.list(query);

    expect(filterPassedTo(cases)).toEqual({
      status: { $in: ['approved', 'rejected'] },
      requestedLevel: 'tier_3',
      riskRating: 'high',
      assignedTo: 'staff-1',
      slaDueAt: { $lt: NOW },
    });
  });

  it('leaves optional filters out of the query entirely', async () => {
    const { service, cases } = setup([], 0);

    const page = await service.list({ page: 1, limit: 25 });

    const filter = filterPassedTo(cases);
    expect(filter).not.toHaveProperty('requestedLevel');
    expect(filter).not.toHaveProperty('riskRating');
    expect(filter).not.toHaveProperty('assignedTo');
    expect(filter).not.toHaveProperty('slaDueAt');
    expect(page).toMatchObject({ total: 0, totalPages: 0, items: [] });
  });
});

describe('KycQueueService.byId', () => {
  it('returns the case row for the reviewer detail pane', async () => {
    const { service, cases } = setup([kycCaseDoc({ customerId: CUSTOMER_ID })]);

    const row = await service.byId(CASE_ID);

    expect(cases.findById).toHaveBeenCalledWith(CASE_ID);
    expect(row._id).toBe(CASE_ID);
    expect(row.customerId).toBe(CUSTOMER_ID);
  });

  it('propagates the typed not-found for an unknown case', async () => {
    const { service, cases } = setup([]);
    cases.findById.mockReturnValue(chainQuery(null));

    await expect(service.byId(CASE_ID)).rejects.toThrow(NotFoundError);
  });
});
