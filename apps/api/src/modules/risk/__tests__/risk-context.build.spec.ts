import type { Model } from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { NotFoundError } from '../../../common/errors/index.js';
import { ClockService } from '../../../simulation/clock/clock.service.js';
import type { AccountDoc } from '../../accounts/infrastructure/account.schemas.js';
import type { CustomerDoc } from '../../customers/infrastructure/customer.schemas.js';
import type { LedgerEntryDoc } from '../../ledger/infrastructure/ledger.schemas.js';
import {
  RiskContextService,
  type ContextRequest,
} from '../application/risk-context.service.js';
import type { RiskProfileDoc } from '../infrastructure/risk-rule.schemas.js';
import {
  ACCOUNT_ID,
  CUSTOMER_ID,
  NOW,
  accountDoc,
  chainQuery,
  customerDoc,
  ledgerEntryDoc,
  profileDoc,
} from './fixtures.js';

const LOOKBACK_START = new Date(NOW.getTime() - 90 * 86_400_000);

function request(signals: ContextRequest['signals'] = {}): ContextRequest {
  return { customerId: CUSTOMER_ID, amountMinorUnits: 125_000, currency: 'GBP', signals };
}

interface SetupOptions {
  readonly customer?: CustomerDoc | null;
  readonly accounts?: AccountDoc[];
  readonly entries?: LedgerEntryDoc[];
  readonly profile?: RiskProfileDoc | null;
}

function setup(options: SetupOptions = {}) {
  const customer = options.customer === undefined ? customerDoc() : options.customer;
  const accounts = options.accounts ?? [accountDoc()];
  const entries = options.entries ?? [ledgerEntryDoc()];
  const profile = options.profile === undefined ? profileDoc() : options.profile;

  const entryQuery = chainQuery(entries);
  const entryModel = { find: vi.fn().mockReturnValue(entryQuery) };
  const accountQuery = chainQuery(accounts);
  const accountModel = { find: vi.fn().mockReturnValue(accountQuery) };
  const customerModel = { findById: vi.fn().mockReturnValue(chainQuery(customer)) };
  const profileModel = { findOne: vi.fn().mockReturnValue(chainQuery(profile)) };

  const clock = new ClockService();
  clock.freeze(NOW);

  const service = new RiskContextService(
    accountModel as unknown as Model<AccountDoc>,
    entryModel as unknown as Model<LedgerEntryDoc>,
    customerModel as unknown as Model<CustomerDoc>,
    profileModel as unknown as Model<RiskProfileDoc>,
    clock,
  );
  return { service, entryModel, entryQuery, accountModel, customerModel, profileModel };
}

describe('RiskContextService.build', () => {
  let deps: ReturnType<typeof setup>;

  beforeEach(() => {
    deps = setup();
  });

  it('assembles the context from the customer, their debit history and their baseline', async () => {
    const { context, customerName } = await deps.service.build(request());

    expect(customerName).toBe('Ama Mensah');
    expect(context).toEqual({
      customerId: CUSTOMER_ID,
      amountMinorUnits: 125_000,
      currency: 'GBP',
      at: NOW,
      history: [{ minorUnits: 25_000, at: NOW }],
      beneficiaryId: null,
      countryCode: null,
      deviceId: null,
      mcc: null,
      knownBeneficiaryIds: ['ben-1'],
      knownDeviceIds: ['device-1'],
      lastCountryCode: 'GB',
      lastCountryAt: NOW,
      lastActivityAt: NOW,
    });
  });

  it('queries settled debits on the customer accounts inside the ninety-day window', async () => {
    await deps.service.build(request());

    expect(deps.entryModel.find).toHaveBeenCalledWith({
      accountRef: { $in: [`acct:${ACCOUNT_ID}`] },
      direction: 'debit',
      transactionStatus: { $in: ['posted', 'settled'] },
      bookedAt: { $gte: LOOKBACK_START },
    });
    expect(deps.entryQuery.sort).toHaveBeenCalledWith({ bookedAt: -1 });
    expect(deps.entryQuery.limit).toHaveBeenCalledWith(250);
  });

  it('passes the caller-supplied signals through untouched', async () => {
    const { context } = await deps.service.build(
      request({ deviceId: 'device-9', countryCode: 'NG', beneficiaryId: 'ben-9', mcc: '7995' }),
    );

    expect(context.deviceId).toBe('device-9');
    expect(context.countryCode).toBe('NG');
    expect(context.beneficiaryId).toBe('ben-9');
    expect(context.mcc).toBe('7995');
  });

  it('starts from an empty baseline when the customer has no profile yet', async () => {
    deps = setup({ profile: null });

    const { context } = await deps.service.build(request());

    expect(context.knownBeneficiaryIds).toEqual([]);
    expect(context.knownDeviceIds).toEqual([]);
    expect(context.lastCountryCode).toBeNull();
    expect(context.lastCountryAt).toBeNull();
  });

  it('skips the ledger entirely when the customer holds no accounts', async () => {
    deps = setup({ accounts: [] });

    const { context } = await deps.service.build(request());

    expect(deps.entryModel.find).not.toHaveBeenCalled();
    expect(context.history).toEqual([]);
    expect(context.lastActivityAt).toBe(NOW);
  });

  it('falls back to the latest history point when the customer has no recorded activity', async () => {
    const earlier = new Date('2026-07-20T08:00:00.000Z');
    deps = setup({
      customer: customerDoc({ lastActivityAt: null }),
      entries: [ledgerEntryDoc({ bookedAt: earlier })],
    });

    const { context } = await deps.service.build(request());

    expect(context.lastActivityAt).toBe(earlier);
  });

  it('reports no last activity when neither the customer nor the history has any', async () => {
    deps = setup({ customer: customerDoc({ lastActivityAt: null }), accounts: [] });

    const { context } = await deps.service.build(request());

    expect(context.lastActivityAt).toBeNull();
  });

  it('rejects as not-found for an unknown customer without touching history', async () => {
    deps = setup({ customer: null });

    await expect(deps.service.build(request())).rejects.toThrow(NotFoundError);
    expect(deps.accountModel.find).not.toHaveBeenCalled();
    expect(deps.entryModel.find).not.toHaveBeenCalled();
  });
});
