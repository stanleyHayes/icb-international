import type { TransferDestination } from '@icb/contracts';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { NotFoundError, ValidationError } from '../../../common/errors/index.js';
import type { AppConfiguration } from '../../../config/configuration.js';
import type { AccountsService } from '../../accounts/accounts.service.js';
import { BeneficiaryTargetResolver } from '../application/beneficiary-target.resolver.js';
import { ACCOUNT_ID, CUSTOMER_ID } from './fixtures.js';

const ACCOUNT = { _id: ACCOUNT_ID, number: '1234567890', currency: 'GBP' };

function setup() {
  const accounts = {
    loadSpendable: vi.fn().mockResolvedValue(ACCOUNT),
    findByNumber: vi.fn().mockResolvedValue(ACCOUNT),
  };
  const config = { bank: { name: 'Intercontinental Bank' } } as AppConfiguration;
  const resolver = new BeneficiaryTargetResolver(accounts as unknown as AccountsService, config);
  return { resolver, accounts };
}

describe('BeneficiaryTargetResolver.resolve', () => {
  let deps: ReturnType<typeof setup>;

  beforeEach(() => {
    deps = setup();
  });

  it('resolves an own-account destination to the masked internal account', async () => {
    const destination: TransferDestination = { kind: 'own_account', accountId: ACCOUNT_ID };

    const target = await deps.resolver.resolve(destination, CUSTOMER_ID);

    expect(deps.accounts.loadSpendable).toHaveBeenCalledWith(ACCOUNT_ID, CUSTOMER_ID);
    expect(target).toEqual({
      displayIdentifier: '•••• 7890',
      bankName: 'Intercontinental Bank',
      currency: 'GBP',
      icbAccountId: ACCOUNT_ID,
    });
  });

  it('resolves another ICB customer by account number', async () => {
    const destination: TransferDestination = { kind: 'icb_customer', accountNumber: '1234567890' };

    const target = await deps.resolver.resolve(destination, CUSTOMER_ID);

    expect(deps.accounts.findByNumber).toHaveBeenCalledWith('1234567890');
    expect(target.icbAccountId).toBe(ACCOUNT_ID);
    expect(target.currency).toBe('GBP');
  });

  it('rejects an ICB customer number that matches no account', async () => {
    deps.accounts.findByNumber.mockResolvedValue(null);
    const destination: TransferDestination = { kind: 'icb_customer', accountNumber: '9999999999' };

    await expect(deps.resolver.resolve(destination, CUSTOMER_ID)).rejects.toThrow(NotFoundError);
  });

  it('resolves a domestic bank destination as external with no bank name or currency', async () => {
    const destination: TransferDestination = {
      kind: 'domestic_bank',
      accountNumber: '12345678',
      sortCode: '04-06-75',
      accountHolderName: 'Ama Mensah',
    };

    const target = await deps.resolver.resolve(destination, CUSTOMER_ID);

    expect(target).toEqual({
      displayIdentifier: '•••• 5678',
      bankName: null,
      currency: null,
      icbAccountId: null,
    });
  });

  it('keeps the bank name on an international destination when supplied', async () => {
    const destination: TransferDestination = {
      kind: 'international',
      iban: 'GB29NWBK60161331926819',
      bic: 'NWBKGB2L',
      accountHolderName: 'Ama Mensah',
      country: 'GB',
      bankName: 'NatWest',
    };

    const target = await deps.resolver.resolve(destination, CUSTOMER_ID);

    expect(target.bankName).toBe('NatWest');
    expect(target.displayIdentifier).toBe('•••• 6819');
    expect(target.icbAccountId).toBeNull();
  });

  it('defaults the bank name to null on an international destination without one', async () => {
    const destination: TransferDestination = {
      kind: 'international',
      iban: 'GB29NWBK60161331926819',
      bic: 'NWBKGB2L',
      accountHolderName: 'Ama Mensah',
      country: 'GB',
    };

    const target = await deps.resolver.resolve(destination, CUSTOMER_ID);

    expect(target.bankName).toBeNull();
  });

  it('refuses a saved payee that points at another saved payee', async () => {
    const destination: TransferDestination = {
      kind: 'beneficiary',
      beneficiaryId: '01J8ZCQ0R0K3M4N5P6Q7R8S9T1',
    };

    await expect(deps.resolver.resolve(destination, CUSTOMER_ID)).rejects.toThrow(ValidationError);
    expect(deps.accounts.loadSpendable).not.toHaveBeenCalled();
    expect(deps.accounts.findByNumber).not.toHaveBeenCalled();
  });
});
