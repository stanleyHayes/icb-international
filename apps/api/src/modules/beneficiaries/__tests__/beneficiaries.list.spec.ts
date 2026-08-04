import type { BeneficiaryQuery } from '@icb/contracts';
import type { Model } from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { encodeCursor } from '../../../common/pagination/cursor.js';
import { ClockService } from '../../../simulation/clock/clock.service.js';
import type { BeneficiaryTargetResolver } from '../application/beneficiary-target.resolver.js';
import { BeneficiariesService } from '../beneficiaries.service.js';
import type { BeneficiaryDoc } from '../infrastructure/beneficiary.schemas.js';
import { CUSTOMER_ID, NOW, beneficiaryDoc, chainQuery } from './fixtures.js';

function setup(rows: BeneficiaryDoc[]) {
  const chain = chainQuery(rows);
  const model = { find: vi.fn().mockReturnValue(chain) };
  const targets = { resolve: vi.fn() };
  const clock = new ClockService();
  clock.freeze(NOW);

  const service = new BeneficiariesService(
    model as unknown as Model<BeneficiaryDoc>,
    targets as unknown as BeneficiaryTargetResolver,
    clock,
  );
  return { service, model, chain };
}

describe('BeneficiariesService.list', () => {
  let query: BeneficiaryQuery;

  beforeEach(() => {
    query = { limit: 2 };
  });

  it('pages by id, fetching one row past the limit as the hasMore signal', async () => {
    const rows = [beneficiaryDoc({ _id: 'b1' }), beneficiaryDoc({ _id: 'b2' }), beneficiaryDoc({ _id: 'b3' })];
    const { service, model, chain } = setup(rows);

    const page = await service.list(CUSTOMER_ID, query);

    expect(model.find).toHaveBeenCalledWith({ customerId: CUSTOMER_ID });
    expect(chain.sort).toHaveBeenCalledWith({ _id: 1 });
    expect(chain.limit).toHaveBeenCalledWith(3);
    expect(page.items).toHaveLength(2);
    expect(page.hasMore).toBe(true);
    expect(page.nextCursor).toBe(encodeCursor('b2'));
  });

  it('returns an empty page with no cursor when there is nothing to show', async () => {
    const { service } = setup([]);

    const page = await service.list(CUSTOMER_ID, query);

    expect(page).toEqual({ items: [], hasMore: false, nextCursor: null });
  });

  it('applies the cursor, favourites, and verified flags to the filter', async () => {
    const { service, model } = setup([]);
    query = { limit: 10, cursor: encodeCursor('b9'), favouritesOnly: true, verifiedOnly: true };

    await service.list(CUSTOMER_ID, query);

    expect(model.find).toHaveBeenCalledWith({
      customerId: CUSTOMER_ID,
      _id: { $gt: 'b9' },
      favourite: true,
      verified: true,
    });
  });

  it('searches name, nickname, and identifier with metacharacters escaped', async () => {
    const { service, model } = setup([]);
    query = { limit: 10, q: 'a.b*' };

    await service.list(CUSTOMER_ID, query);

    const pattern = { $regex: 'a\\.b\\*', $options: 'i' };
    expect(model.find).toHaveBeenCalledWith({
      customerId: CUSTOMER_ID,
      $or: [
        { name: pattern },
        { nickname: pattern },
        { displayIdentifier: pattern },
      ],
    });
  });
});
