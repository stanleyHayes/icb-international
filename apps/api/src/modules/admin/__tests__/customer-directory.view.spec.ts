import type { Model } from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { NotFoundError } from '../../../common/errors/index.js';
import type { AccountDoc } from '../../accounts/infrastructure/account.schemas.js';
import type { CustomerDoc } from '../../customers/infrastructure/customer.schemas.js';
import type { AccountBalanceDoc } from '../../ledger/infrastructure/ledger.schemas.js';
import { CustomerDirectoryService } from '../customer-directory.service.js';
import { KYC_VERIFIED_AT, MEMBER_SINCE, makeCustomerDoc } from './fixtures.js';

const LAST_ACTIVITY = new Date('2026-08-01T08:00:00.000Z');

function makeHarness(customer: CustomerDoc | null, options: { accountIds?: string[]; balances?: { ledgerMinorUnits: number }[] } = {}) {
  const customers = {
    findById: vi.fn().mockReturnValue({ lean: () => Promise.resolve(customer) }),
  };
  const accounts = {
    find: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: () => Promise.resolve((options.accountIds ?? []).map((id) => ({ _id: id }))),
      }),
    }),
  };
  const balances = {
    find: vi.fn().mockReturnValue({ lean: () => Promise.resolve(options.balances ?? []) }),
  };
  const service = new CustomerDirectoryService(
    customers as unknown as Model<CustomerDoc>,
    accounts as unknown as Model<AccountDoc>,
    balances as unknown as Model<AccountBalanceDoc>,
  );
  return { service, customers, accounts, balances };
}

describe('CustomerDirectoryService.getById', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('maps the full admin view, summing USD balances across open accounts', async () => {
    const { service, accounts, balances } = makeHarness(
      makeCustomerDoc({ lastActivityAt: LAST_ACTIVITY }),
      {
        accountIds: ['acct-1', 'acct-2'],
        balances: [{ ledgerMinorUnits: 1_000 }, { ledgerMinorUnits: 2_500 }],
      },
    );

    const view = await service.getById('cust-1');

    expect(accounts.find).toHaveBeenCalledWith({
      customerId: 'cust-1',
      status: { $ne: 'closed' },
    });
    expect(balances.find).toHaveBeenCalledWith({
      accountRef: { $in: ['acct:acct-1', 'acct:acct-2'] },
      currency: 'USD',
    });
    expect(view).toMatchObject({
      id: 'cust-1',
      type: 'individual',
      status: 'active',
      tier: 'standard',
      email: 'ada@example.com',
      phone: '+15551234567',
      individual: { firstName: 'Ada', lastName: 'Lovelace' },
      business: null,
      kyc: {
        level: 'full',
        status: 'verified',
        verifiedAt: KYC_VERIFIED_AT.toISOString(),
        nextReviewAt: null,
      },
      memberSince: MEMBER_SINCE.toISOString(),
      riskRating: 'low',
      flags: [],
      relationshipManager: null,
      totalRelationshipValue: { minorUnits: 3_500, currency: 'USD', scale: 2 },
      accountCount: 2,
      lastActivityAt: LAST_ACTIVITY.toISOString(),
      internalNotes: 0,
    });
  });

  it('nulls unset KYC dates and last activity, and zero-values a customer with no accounts', async () => {
    const { service } = makeHarness(
      makeCustomerDoc({ kycVerifiedAt: null, kycNextReviewAt: null, lastActivityAt: null }),
    );

    const view = await service.getById('cust-1');

    expect(view.kyc.verifiedAt).toBeNull();
    expect(view.kyc.nextReviewAt).toBeNull();
    expect(view.lastActivityAt).toBeNull();
    expect(view.totalRelationshipValue).toEqual({ minorUnits: 0, currency: 'USD', scale: 2 });
    expect(view.accountCount).toBe(0);
  });

  it('maps a business customer with flags and a relationship manager', async () => {
    const flag = {
      code: 'sanctions_review',
      label: 'Sanctions review',
      severity: 'critical',
      raisedAt: '2026-07-01T00:00:00.000Z',
      raisedBy: 'staff-1',
    };
    const { service } = makeHarness(
      makeCustomerDoc({
        type: 'business',
        individual: null,
        business: { legalName: 'Initech Ltd' },
        relationshipManager: 'staff-7',
        flags: [flag],
      }),
    );

    const view = await service.getById('cust-1');

    expect(view.type).toBe('business');
    expect(view.individual).toBeNull();
    expect(view.business).toEqual({ legalName: 'Initech Ltd' });
    expect(view.relationshipManager).toBe('staff-7');
    expect(view.flags).toEqual([flag]);
  });

  it('throws NotFoundError for an unknown customer', async () => {
    const { service } = makeHarness(null);

    await expect(service.getById('cust-missing')).rejects.toBeInstanceOf(NotFoundError);
    await expect(service.getById('cust-missing')).rejects.toMatchObject({
      code: 'NOT_FOUND',
      context: { resource: 'Customer', identifier: 'cust-missing' },
    });
  });
});
