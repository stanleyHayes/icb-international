import type { AccountDetail, AccountSummary, OpenAccountRequest } from '@icb/contracts';
import { describe, expect, it, vi } from 'vitest';

import { NotFoundError } from '../../../common/errors/index.js';
import { AccountOpeningService } from '../application/account-opening.service.js';
import {
  AccountCurrencyMismatchError,
  AccountLimitExceededError,
} from '../domain/account.errors.js';

const DETAIL = { id: 'acct_new' } as unknown as AccountDetail;
const SUMMARY = { id: 'acct_new' } as unknown as AccountSummary;

function harness(existing: Record<string, unknown>[]) {
  const model = { find: vi.fn(() => ({ lean: () => Promise.resolve(existing) })) };
  const core = {
    open: vi.fn(() => Promise.resolve(SUMMARY)),
    getForCustomer: vi.fn(() => Promise.resolve(DETAIL)),
  };
  const ledger = { post: vi.fn((_command: unknown) => Promise.resolve({})) };
  const service = new AccountOpeningService(model as never, core as never, ledger as never);
  return { model, core, ledger, service };
}

function request(patch: Partial<OpenAccountRequest> = {}): OpenAccountRequest {
  return { productCode: 'ICB-CURRENT', currency: 'USD', ...patch };
}

describe('AccountOpeningService.openForCustomer', () => {
  it('opens with the product catalogue defaults, not client-supplied terms', async () => {
    const { core, service } = harness([]);

    const result = await service.openForCustomer('cust_1', request({ nickname: 'Everyday' }));

    expect(result).toBe(DETAIL);
    expect(core.open).toHaveBeenCalledWith(
      expect.objectContaining({
        customerId: 'cust_1',
        productCode: 'ICB-CURRENT',
        productName: 'ICB Everyday Current',
        kind: 'current',
        currency: 'USD',
        overdraftMinorUnits: 50_000,
        interestRate: 0.25,
        nickname: 'Everyday',
      }),
    );
  });

  it('rejects an unknown product code', async () => {
    const { core, service } = harness([]);

    await expect(
      service.openForCustomer('cust_1', request({ productCode: 'NOPE-1' })),
    ).rejects.toThrow(NotFoundError);
    expect(core.open).not.toHaveBeenCalled();
  });

  it('enforces one account per product and currency', async () => {
    const { core, service } = harness([
      { productCode: 'ICB-CURRENT', currency: 'USD', status: 'active' },
    ]);

    await expect(service.openForCustomer('cust_1', request())).rejects.toThrow(
      AccountLimitExceededError,
    );
    expect(core.open).not.toHaveBeenCalled();
  });

  it('lets a closed account free its slot', async () => {
    const { core, service } = harness([
      { productCode: 'ICB-CURRENT', currency: 'USD', status: 'closed' },
    ]);

    await service.openForCustomer('cust_1', request());

    expect(core.open).toHaveBeenCalled();
  });

  it('enforces the relationship-wide cap', async () => {
    const existing = Array.from({ length: 10 }, (_unused, index) => ({
      productCode: index % 2 === 0 ? 'ICB-CURRENT' : 'ICB-SAVINGS',
      currency: `C${index}`,
      status: 'active',
    }));
    const { service } = harness(existing);

    await expect(
      service.openForCustomer('cust_1', request({ productCode: 'ICB-SAVINGS' })),
    ).rejects.toThrow(AccountLimitExceededError);
  });

  it('posts the opening deposit through the ledger', async () => {
    const { core, ledger, service } = harness([]);

    await service.openForCustomer(
      'cust_1',
      request({ initialDeposit: { minorUnits: 10_000, currency: 'USD', scale: 2 } }),
    );

    expect(core.open).toHaveBeenCalled();
    const command = ledger.post.mock.calls[0]?.[0] as {
      type: string;
      lines: { accountRef: string; direction: string }[];
    };
    expect(command.type).toBe('deposit');
    expect(command.lines).toEqual([
      { accountRef: 'gl:1000', direction: 'debit', amount: expect.objectContaining({ minorUnits: 10_000 }) },
      { accountRef: 'acct:acct_new', direction: 'credit', amount: expect.objectContaining({ minorUnits: 10_000 }) },
    ]);
  });

  it('rejects an opening deposit in another currency', async () => {
    const { core, service } = harness([]);

    await expect(
      service.openForCustomer(
        'cust_1',
        request({ initialDeposit: { minorUnits: 10_000, currency: 'GHS', scale: 2 } }),
      ),
    ).rejects.toThrow(AccountCurrencyMismatchError);
    expect(core.open).not.toHaveBeenCalled();
  });
});
