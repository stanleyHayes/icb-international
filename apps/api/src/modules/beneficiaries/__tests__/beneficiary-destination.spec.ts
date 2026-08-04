import type { TransferDestination } from '@icb/contracts';
import { describe, expect, it } from 'vitest';

import {
  destinationHolderName,
  destinationIdentifier,
  destinationKey,
  isInternalDestination,
  maskIdentifier,
} from '../domain/beneficiary-destination.js';

const OWN_ACCOUNT: TransferDestination = {
  kind: 'own_account',
  accountId: '01J8ZCQ0R0K3M4N5P6Q7R8S9T3',
};
const ICB_CUSTOMER: TransferDestination = { kind: 'icb_customer', accountNumber: '1234567890' };
const DOMESTIC: TransferDestination = {
  kind: 'domestic_bank',
  accountNumber: '12345678',
  sortCode: '04-06-75',
  accountHolderName: 'Ama Mensah',
};
const INTERNATIONAL: TransferDestination = {
  kind: 'international',
  iban: 'GB29 NWBK 6016 1331 9268 19',
  bic: 'NWBKGB2L',
  accountHolderName: 'Ama Mensah',
  country: 'GB',
};
const SAVED: TransferDestination = {
  kind: 'beneficiary',
  beneficiaryId: '01J8ZCQ0R0K3M4N5P6Q7R8S9T1',
};

describe('destinationIdentifier', () => {
  it('addresses each destination shape by its natural key', () => {
    expect(destinationIdentifier(OWN_ACCOUNT)).toBe(OWN_ACCOUNT.accountId);
    expect(destinationIdentifier(ICB_CUSTOMER)).toBe('1234567890');
    expect(destinationIdentifier(DOMESTIC)).toBe('04-06-7512345678');
    expect(destinationIdentifier(INTERNATIONAL)).toBe('GB29 NWBK 6016 1331 9268 19');
    expect(destinationIdentifier(SAVED)).toBe(SAVED.beneficiaryId);
  });
});

describe('destinationKey', () => {
  it('prefixes the kind so different rails never collide', () => {
    expect(destinationKey(ICB_CUSTOMER)).toBe('icb_customer:1234567890');
  });

  it('normalises case and separators so retyping is not a second payee', () => {
    const spaced: TransferDestination = { ...INTERNATIONAL, iban: 'gb29-nwbk 6016' };
    const compact: TransferDestination = { ...INTERNATIONAL, iban: 'GB29NWBK6016' };
    expect(destinationKey(spaced)).toBe(destinationKey(compact));
    expect(destinationKey(compact)).toBe('international:GB29NWBK6016');
  });
});

describe('maskIdentifier', () => {
  it('returns short identifiers unchanged', () => {
    expect(maskIdentifier('1234')).toBe('1234');
    expect(maskIdentifier('ab')).toBe('ab');
  });

  it('masks everything but the last four characters', () => {
    expect(maskIdentifier('1234567890')).toBe('•••• 7890');
    expect(maskIdentifier('12345')).toBe('•••• 2345');
  });
});

describe('destinationHolderName', () => {
  it('reads the holder name where the shape carries one', () => {
    expect(destinationHolderName(DOMESTIC)).toBe('Ama Mensah');
    expect(destinationHolderName(INTERNATIONAL)).toBe('Ama Mensah');
  });

  it('is null where the shape has no holder name', () => {
    expect(destinationHolderName(OWN_ACCOUNT)).toBeNull();
    expect(destinationHolderName(ICB_CUSTOMER)).toBeNull();
    expect(destinationHolderName(SAVED)).toBeNull();
  });
});

describe('isInternalDestination', () => {
  it('is true only for accounts ICB itself holds', () => {
    expect(isInternalDestination(OWN_ACCOUNT)).toBe(true);
    expect(isInternalDestination(ICB_CUSTOMER)).toBe(true);
    expect(isInternalDestination(DOMESTIC)).toBe(false);
    expect(isInternalDestination(INTERNATIONAL)).toBe(false);
    expect(isInternalDestination(SAVED)).toBe(false);
  });
});
