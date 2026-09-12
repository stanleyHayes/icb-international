import type { AccountDetail, Product } from '@icb/contracts';
import type { Model } from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { NotFoundError, ValidationError } from '../../../common/errors/index.js';
import type { HoldService } from '../../ledger/hold.service.js';
import type { HoldDoc } from '../../ledger/infrastructure/ledger.schemas.js';
import type { ProductsService } from '../../products/products.service.js';
import type { AccountsService } from '../accounts.service.js';
import { AccountTermsService } from '../application/account-terms.service.js';
import type { AccountDoc } from '../infrastructure/account.schemas.js';

const ACCOUNT_ID = 'acct-1';
const DETAIL = { id: ACCOUNT_ID } as unknown as AccountDetail;

const account = (overrides: Partial<AccountDoc> = {}) =>
  ({
    _id: ACCOUNT_ID,
    customerId: 'cust-1',
    kind: 'savings',
    currency: 'USD',
    productCode: 'ICB-SAVINGS',
    interestRate: 4.15,
    ...overrides,
  }) as AccountDoc;

const product = (overrides: Partial<Product> = {}) =>
  ({
    code: 'ICB-SAVINGS-PLUS',
    name: 'ICB Savings Plus',
    kind: 'savings',
    currencies: ['USD'],
    interestRate: 5.25,
    minimumBalance: { minorUnits: 10_000, currency: 'USD', scale: 2 },
    monthlyFee: null,
    ...overrides,
  }) as unknown as Product;

function makeService(doc: AccountDoc | null = account()) {
  const accounts = {
    findOne: vi.fn().mockReturnValue({ lean: () => Promise.resolve(doc) }),
    updateOne: vi.fn().mockResolvedValue({ matchedCount: 1 }),
  };
  const holds = { findOne: vi.fn().mockReturnValue({ lean: () => Promise.resolve(null) }) };
  const core = { getForStaff: vi.fn().mockResolvedValue(DETAIL) };
  const products = { getByCode: vi.fn().mockResolvedValue(product()) };
  const holdService = { release: vi.fn().mockResolvedValue(undefined) };
  const service = new AccountTermsService(
    accounts as unknown as Model<AccountDoc>,
    holds as unknown as Model<HoldDoc>,
    core as unknown as AccountsService,
    products as unknown as ProductsService,
    holdService as unknown as HoldService,
  );
  return { service, accounts, holds, core, products, holdService };
}

/** The `$set` payload of the last account update. */
const lastSet = (accounts: { updateOne: ReturnType<typeof vi.fn> }) =>
  accounts.updateOne.mock.calls.at(-1)?.[1].$set as Record<string, unknown>;

describe('AccountTermsService.changeProduct', () => {
  beforeEach(() => vi.clearAllMocks());

  it('carries the new product’s pricing onto the account', async () => {
    // Accrual and fee collection read the account's copy, not the product, so a product change
    // that left these behind would price the customer on their old product indefinitely.
    const { service, accounts } = makeService();

    await service.changeProduct(ACCOUNT_ID, 'ICB-SAVINGS-PLUS');

    expect(lastSet(accounts)).toEqual({
      productCode: 'ICB-SAVINGS-PLUS',
      productName: 'ICB Savings Plus',
      interestRate: 5.25,
      minimumBalanceMinorUnits: 10_000,
      monthlyFeeMinorUnits: null,
    });
  });

  it('refuses a product for a different kind of account', async () => {
    const { service, products, accounts } = makeService(account({ kind: 'current' }));
    products.getByCode.mockResolvedValue(product({ kind: 'savings' }));

    await expect(service.changeProduct(ACCOUNT_ID, 'ICB-SAVINGS-PLUS')).rejects.toBeInstanceOf(
      ValidationError,
    );
    expect(accounts.updateOne).not.toHaveBeenCalled();
  });

  it('refuses a product not offered in the account’s currency', async () => {
    const { service, products, accounts } = makeService(account({ currency: 'GHS' }));
    products.getByCode.mockResolvedValue(product({ currencies: ['USD', 'EUR'] }));

    await expect(service.changeProduct(ACCOUNT_ID, 'ICB-SAVINGS-PLUS')).rejects.toBeInstanceOf(
      ValidationError,
    );
    expect(accounts.updateOne).not.toHaveBeenCalled();
  });

  it('throws for an unknown product code', async () => {
    const { service, products } = makeService();
    products.getByCode.mockRejectedValue(new NotFoundError('Product', 'NOPE'));

    await expect(service.changeProduct(ACCOUNT_ID, 'NOPE')).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe('AccountTermsService.setInterestOverride', () => {
  beforeEach(() => vi.clearAllMocks());

  it('writes the rate an operator entered', async () => {
    const { service, accounts } = makeService();

    await service.setInterestOverride(ACCOUNT_ID, 3.5);

    expect(lastSet(accounts)).toEqual({ interestRate: 3.5 });
  });

  it('clearing writes the product’s rate, not null', async () => {
    // Interest accrual reads `account.interestRate` and falls back to a flat house rate when it
    // is null — so blanking the field would quietly move the customer off product terms rather
    // than back onto them.
    const { service, accounts, products } = makeService();
    products.getByCode.mockResolvedValue(product({ interestRate: 4.15 }));

    await service.setInterestOverride(ACCOUNT_ID, null);

    expect(lastSet(accounts)).toEqual({ interestRate: 4.15 });
  });

  it('falls back to null when the product itself has no rate', async () => {
    const { service, accounts, products } = makeService();
    products.getByCode.mockResolvedValue(product({ interestRate: null }));

    await service.setInterestOverride(ACCOUNT_ID, null);

    expect(lastSet(accounts)).toEqual({ interestRate: null });
  });

  it('keeps a zero rate rather than reading it as "clear"', async () => {
    const { service, accounts } = makeService();

    await service.setInterestOverride(ACCOUNT_ID, 0);

    expect(lastSet(accounts)).toEqual({ interestRate: 0 });
  });
});

describe('AccountTermsService.releaseHold', () => {
  beforeEach(() => vi.clearAllMocks());

  it('releases a hold that belongs to the account', async () => {
    const { service, holds, holdService } = makeService();
    holds.findOne.mockReturnValue({
      lean: () => Promise.resolve({ accountRef: `acct:${ACCOUNT_ID}` }),
    });

    await service.releaseHold(ACCOUNT_ID, 'hold-1', 'Merchant abandoned the sale');

    expect(holdService.release).toHaveBeenCalledWith('hold-1', 'Merchant abandoned the sale');
  });

  it('refuses a hold belonging to another account', async () => {
    // `HoldService.release` takes an id alone, so without this an operator on one account could
    // free value on another.
    const { service, holds, holdService } = makeService();
    holds.findOne.mockReturnValue({ lean: () => Promise.resolve({ accountRef: 'acct:someone-else' }) });

    await expect(
      service.releaseHold(ACCOUNT_ID, 'hold-1', 'Merchant abandoned the sale'),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(holdService.release).not.toHaveBeenCalled();
  });

  it('throws for a hold that does not exist', async () => {
    const { service, holdService } = makeService();

    await expect(service.releaseHold(ACCOUNT_ID, 'nope', 'reason')).rejects.toBeInstanceOf(
      NotFoundError,
    );
    expect(holdService.release).not.toHaveBeenCalled();
  });
});
