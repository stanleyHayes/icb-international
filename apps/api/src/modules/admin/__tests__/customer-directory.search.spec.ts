import type { CustomerSearchQuery, OffsetQuery } from '@icb/contracts';
import type { Model } from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AccountDoc } from '../../accounts/infrastructure/account.schemas.js';
import type { CustomerDoc } from '../../customers/infrastructure/customer.schemas.js';
import type { AccountBalanceDoc } from '../../ledger/infrastructure/ledger.schemas.js';
import { CustomerDirectoryService } from '../customer-directory.service.js';
import { makeCustomerDoc } from './fixtures.js';

type Filter = Record<string, unknown>;

function makeHarness(customerRows: CustomerDoc[] = []) {
  const searchQuery = {
    sort: vi.fn().mockReturnThis(),
    skip: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    lean: vi.fn().mockResolvedValue(customerRows),
  };
  const customers = {
    find: vi.fn().mockReturnValue(searchQuery),
    countDocuments: vi.fn().mockResolvedValue(customerRows.length),
  };
  const accounts = {
    find: vi.fn().mockImplementation((filter: Filter) => {
      if ('number' in filter) {
        // Account-number lookup: .select('customerId').limit(25).lean()
        return {
          select: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({ lean: () => Promise.resolve([]) }),
          }),
        };
      }
      // toAdminView's open-accounts lookup: .select('_id').lean()
      return { select: vi.fn().mockReturnValue({ lean: () => Promise.resolve([]) }) };
    }),
  };
  const balances = { find: vi.fn().mockReturnValue({ lean: () => Promise.resolve([]) }) };
  const service = new CustomerDirectoryService(
    customers as unknown as Model<CustomerDoc>,
    accounts as unknown as Model<AccountDoc>,
    balances as unknown as Model<AccountBalanceDoc>,
  );
  return { service, customers, accounts, searchQuery };
}

function query(overrides: Partial<CustomerSearchQuery & OffsetQuery> = {}) {
  return { page: 1, limit: 20, ...overrides };
}

describe('CustomerDirectoryService.search', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns a page envelope with mapped views and ceiling-computed totalPages', async () => {
    const { service, customers } = makeHarness([makeCustomerDoc()]);
    customers.countDocuments.mockResolvedValue(21);

    const page = await service.search(query({ page: 2, limit: 10 }));

    expect(page.total).toBe(21);
    expect(page.totalPages).toBe(3);
    expect(page.page).toBe(2);
    expect(page.limit).toBe(10);
    expect(page.items).toHaveLength(1);
    expect(page.items[0]?.id).toBe('cust-1');
  });

  it('sorts newest first and skips whole pages', async () => {
    const { service, searchQuery } = makeHarness();

    await service.search(query({ page: 3, limit: 10 }));

    expect(searchQuery.sort).toHaveBeenCalledWith({ createdAt: -1 });
    expect(searchQuery.skip).toHaveBeenCalledWith(20);
    expect(searchQuery.limit).toHaveBeenCalledWith(10);
  });

  it('applies equality filters for status, tier, risk rating and KYC status', async () => {
    const { service, customers } = makeHarness();

    await service.search(
      query({ status: 'suspended', tier: 'premier', riskRating: 'high', kycStatus: 'approved' }),
    );

    const filter = customers.find.mock.calls[0]?.[0] as Filter;
    expect(filter).toMatchObject({
      status: 'suspended',
      tier: 'premier',
      riskRating: 'high',
      kycStatus: 'approved',
    });
    expect(filter['$or']).toBeUndefined();
  });

  it('builds an empty filter when nothing is given', async () => {
    const { service, customers } = makeHarness();

    await service.search(query());

    expect(customers.find).toHaveBeenCalledWith({});
    expect(customers.countDocuments).toHaveBeenCalledWith({});
  });

  it('searches free text across contact and name fields with escaped, case-insensitive regex', async () => {
    const { service, customers, accounts } = makeHarness();

    await service.search(query({ q: 'ada.lovelace' }));

    const filter = customers.find.mock.calls[0]?.[0] as Filter;
    const or = filter['$or'] as Filter[];
    const pattern = { $regex: 'ada\\.lovelace', $options: 'i' };
    expect(or).toEqual([
      { email: pattern },
      { phone: pattern },
      { 'individual.firstName': pattern },
      { 'individual.lastName': pattern },
      { 'business.legalName': pattern },
    ]);
    // Not an account-number fragment, so the accounts collection is never queried for ids.
    expect(accounts.find).not.toHaveBeenCalledWith(
      expect.objectContaining({ number: expect.anything() }),
    );
  });

  it('adds matching customer ids when the term looks like an account-number fragment', async () => {
    const { service, customers, accounts } = makeHarness();
    accounts.find.mockImplementation((filter: Filter) => {
      if ('number' in filter) {
        return {
          select: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              lean: () => Promise.resolve([{ customerId: 'cust-9' }]),
            }),
          }),
        };
      }
      return { select: vi.fn().mockReturnValue({ lean: () => Promise.resolve([]) }) };
    });

    await service.search(query({ q: '123456' }));

    expect(accounts.find).toHaveBeenCalledWith({ number: { $regex: '123456$' } });
    const or = (customers.find.mock.calls[0]?.[0] as Filter)['$or'] as Filter[];
    expect(or).toContainEqual({ _id: { $in: ['cust-9'] } });
  });

  it('omits the id clause when no account number matches the numeric term', async () => {
    const { service, customers, accounts } = makeHarness();

    await service.search(query({ q: '9999' }));

    expect(accounts.find).toHaveBeenCalledWith({ number: { $regex: '9999$' } });
    const or = (customers.find.mock.calls[0]?.[0] as Filter)['$or'] as Filter[];
    expect(or).toHaveLength(5);
  });
});
