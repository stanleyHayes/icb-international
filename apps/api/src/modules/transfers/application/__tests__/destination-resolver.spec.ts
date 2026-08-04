import { fromMinorUnits } from '@icb/money';
import { describe, expect, it, vi } from 'vitest';

import type { AccountsService } from '../../../accounts/accounts.service.js';
import type { BeneficiariesService } from '../../../beneficiaries/beneficiaries.service.js';
import { DestinationResolver } from '../destination-resolver.js';
import {
  describeDestination,
  maskIdentifier,
  recipientNameFor,
} from '../../domain/recipient.js';

const AMOUNT = fromMinorUnits(10_000, 'USD');

function setup() {
  const beneficiaries = {
    loadOwned: vi.fn().mockResolvedValue({
      _id: 'ben-1',
      name: 'Mum',
      nickname: null,
      displayIdentifier: '•••• 3192',
      destination: { kind: 'domestic_bank', accountNumber: '6016133192' },
    }),
    assertUsable: vi.fn().mockResolvedValue(undefined),
    create: vi.fn().mockResolvedValue({}),
  };
  const accounts = {
    loadSpendable: vi.fn().mockResolvedValue({ nickname: 'Everyday', productName: 'Current' }),
    findByNumber: vi.fn().mockResolvedValue({ nickname: null, productName: 'Savings' }),
  };
  const service = new DestinationResolver(
    beneficiaries as unknown as BeneficiariesService,
    accounts as unknown as AccountsService,
  );
  return { service, beneficiaries, accounts };
}

describe('DestinationResolver.resolve', () => {
  it('passes external destinations through untouched', async () => {
    const { service, beneficiaries, accounts } = setup();
    const destination = { kind: 'domestic_bank', accountNumber: '6016133192' } as const;

    const resolved = await service.resolve(destination as never, 'cust-1');

    expect(resolved).toEqual({
      destination,
      beneficiaryId: null,
      beneficiaryName: null,
      beneficiaryMasked: null,
    });
    expect(beneficiaries.loadOwned).not.toHaveBeenCalled();
    expect(accounts.loadSpendable).not.toHaveBeenCalled();
  });

  it('ownership-checks an own_account destination against the caller', async () => {
    const { service, accounts } = setup();
    const destination = { kind: 'own_account', accountId: 'acct-2' } as const;

    const resolved = await service.resolve(destination, 'cust-1');

    expect(accounts.loadSpendable).toHaveBeenCalledWith('acct-2', 'cust-1');
    expect(resolved).toEqual({
      destination,
      beneficiaryId: null,
      beneficiaryName: null,
      beneficiaryMasked: null,
    });
  });

  it('rejects an own_account destination that belongs to someone else', async () => {
    const { service, accounts } = setup();
    accounts.loadSpendable.mockRejectedValue(
      Object.assign(new Error('not found'), { code: 'NOT_FOUND' }),
    );

    await expect(
      service.resolve({ kind: 'own_account', accountId: 'acct-stranger' }, 'cust-1'),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('expands a beneficiary reference to the saved destination', async () => {
    const { service, beneficiaries } = setup();

    const resolved = await service.resolve(
      { kind: 'beneficiary', beneficiaryId: 'ben-1' },
      'cust-1',
    );

    expect(beneficiaries.loadOwned).toHaveBeenCalledWith('ben-1', 'cust-1');
    expect(resolved.destination).toEqual({
      kind: 'domestic_bank',
      accountNumber: '6016133192',
    });
    expect(resolved.beneficiaryId).toBe('ben-1');
    expect(resolved.beneficiaryName).toBe('Mum'); // nickname ?? name
    expect(resolved.beneficiaryMasked).toBe('•••• 3192');
  });
});

describe('DestinationResolver.assertPayable', () => {
  it('checks cooling-off caps only for saved payees', async () => {
    const { service, beneficiaries } = setup();

    await service.assertPayable(
      { destination: { kind: 'own_account', accountId: 'a' }, beneficiaryId: null } as never,
      AMOUNT,
      'cust-1',
    );
    expect(beneficiaries.assertUsable).not.toHaveBeenCalled();

    await service.assertPayable(
      { destination: { kind: 'domestic_bank' }, beneficiaryId: 'ben-1' } as never,
      AMOUNT,
      'cust-1',
    );
    expect(beneficiaries.assertUsable).toHaveBeenCalledWith('ben-1', AMOUNT, 'cust-1');
  });
});

describe('DestinationResolver.savePayee', () => {
  it('does not save own-account or beneficiary destinations', async () => {
    const { service, beneficiaries } = setup();

    await service.savePayee('cust-1', { kind: 'own_account', accountId: 'a' } as never, 'Me');
    await service.savePayee('cust-1', { kind: 'beneficiary', beneficiaryId: 'b' } as never, 'Mum');

    expect(beneficiaries.create).not.toHaveBeenCalled();
  });

  it('saves a new external payee, including the nickname when given', async () => {
    const { service, beneficiaries } = setup();
    const destination = { kind: 'domestic_bank', accountNumber: '6016133192' };

    await service.savePayee('cust-1', destination as never, 'Mum', 'Family');

    expect(beneficiaries.create).toHaveBeenCalledWith('cust-1', {
      name: 'Mum',
      destination,
      favourite: false,
      nickname: 'Family',
    });
  });

  it('swallows duplicate-save failures so a completed transfer never fails', async () => {
    const { service, beneficiaries } = setup();
    beneficiaries.create.mockRejectedValue(new Error('duplicate'));

    await expect(
      service.savePayee('cust-1', { kind: 'domestic_bank' } as never, 'Mum'),
    ).resolves.toBeUndefined();
  });
});

describe('DestinationResolver.describe', () => {
  it('uses the saved payee name and mask for beneficiaries', async () => {
    const { service } = setup();

    const display = await service.describe(
      {
        destination: { kind: 'domestic_bank', accountNumber: '6016133192' },
        beneficiaryId: 'ben-1',
        beneficiaryName: 'Mum',
        beneficiaryMasked: '•••• 3192',
      } as never,
      'cust-1',
    );

    expect(display).toEqual({ name: 'Mum', masked: '•••• 3192' });
  });

  it('uses the account holder name for external bank destinations', async () => {
    const { service } = setup();

    const display = await service.describe(
      {
        destination: {
          kind: 'domestic_bank',
          accountNumber: '6016133192',
          accountHolderName: 'A. Person',
        },
        beneficiaryId: null,
        beneficiaryName: null,
        beneficiaryMasked: null,
      } as never,
      'cust-1',
    );

    expect(display).toEqual({ name: 'A. Person', masked: '•••• 3192' });
  });

  it('names own accounts from the account record', async () => {
    const { service, accounts } = setup();

    const display = await service.describe(
      {
        destination: { kind: 'own_account', accountId: 'acct-2' },
        beneficiaryId: null,
        beneficiaryName: null,
        beneficiaryMasked: null,
      } as never,
      'cust-1',
    );

    expect(accounts.loadSpendable).toHaveBeenCalledWith('acct-2', 'cust-1');
    expect(display.name).toBe('Everyday');
  });

  it('falls back to the product name, then a generic label', async () => {
    const { service, accounts } = setup();
    accounts.loadSpendable.mockResolvedValue({ nickname: null, productName: 'Savings' });

    const named = await service.describe(
      {
        destination: { kind: 'own_account', accountId: 'acct-3' },
        beneficiaryId: null,
        beneficiaryName: null,
        beneficiaryMasked: null,
      } as never,
      'cust-1',
    );
    expect(named.name).toBe('Savings');

    accounts.findByNumber.mockResolvedValue(null);
    const generic = await service.describe(
      {
        destination: { kind: 'icb_customer', accountNumber: '6016133192' },
        beneficiaryId: null,
        beneficiaryName: null,
        beneficiaryMasked: null,
      } as never,
      'cust-1',
    );
    expect(generic.name).toBe('ICB account');
  });
});

describe('recipient domain helpers', () => {
  it('describes each destination kind by its identifier', () => {
    expect(describeDestination({ kind: 'own_account', accountId: 'a1' } as never)).toBe('a1');
    expect(
      describeDestination({ kind: 'icb_customer', accountNumber: '1234' } as never),
    ).toBe('1234');
    expect(describeDestination({ kind: 'international', iban: 'GH29' } as never)).toBe('GH29');
    expect(describeDestination({ kind: 'beneficiary', beneficiaryId: 'b1' } as never)).toBe('b1');
  });

  it('names only external-bank destinations directly', () => {
    expect(
      recipientNameFor({ kind: 'international', accountHolderName: 'J. Doe' } as never),
    ).toBe('J. Doe');
    expect(recipientNameFor({ kind: 'own_account', accountId: 'a1' } as never)).toBe('');
  });

  it('masks all but the last four characters', () => {
    expect(maskIdentifier('6016133192')).toBe('•••• 3192');
    expect(maskIdentifier('3192')).toBe('3192');
  });
});
