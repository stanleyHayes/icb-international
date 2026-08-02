import { describe, expect, it } from 'vitest';

import {
  ERROR_CODES,
  ERROR_STATUS,
  accountSummarySchema,
  createTransferRequestSchema,
  loginRequestSchema,
  moneySchema,
  passwordSchema,
  problemDetailsSchema,
  transferDestinationSchema,
} from '../index.js';

describe('error taxonomy', () => {
  it('assigns an HTTP status to every code, with no orphans in either direction', () => {
    for (const code of ERROR_CODES) {
      expect(ERROR_STATUS[code], `missing status for ${code}`).toBeGreaterThanOrEqual(200);
    }
    expect(Object.keys(ERROR_STATUS).sort()).toEqual([...ERROR_CODES].sort());
  });

  it('accepts a well-formed problem document', () => {
    const problem = {
      type: 'https://icb.example/problems/insufficient-funds',
      title: 'Insufficient funds',
      status: 422,
      detail: 'The account does not have enough available balance',
      code: 'INSUFFICIENT_FUNDS',
      correlationId: '01KZ1FHZ89WFHPY2XZP4P3E6AK',
    };
    expect(problemDetailsSchema.parse(problem).code).toBe('INSUFFICIENT_FUNDS');
  });
});

describe('money on the wire', () => {
  it('requires integer minor units', () => {
    expect(moneySchema.safeParse({ minorUnits: 100, currency: 'USD', scale: 2 }).success).toBe(true);
    expect(moneySchema.safeParse({ minorUnits: 1.5, currency: 'USD', scale: 2 }).success).toBe(false);
  });

  it('rejects an unknown currency', () => {
    expect(moneySchema.safeParse({ minorUnits: 100, currency: 'XXX', scale: 2 }).success).toBe(false);
  });
});

describe('transfer destination', () => {
  it('discriminates on kind, so a SWIFT payment cannot omit its BIC', () => {
    expect(
      transferDestinationSchema.safeParse({
        kind: 'international',
        iban: 'GH15ICBK1544819806',
        accountHolderName: 'Jane Doe',
        country: 'GH',
      }).success,
    ).toBe(false);

    expect(
      transferDestinationSchema.safeParse({
        kind: 'international',
        iban: 'GH15ICBK1544819806',
        bic: 'ICBKGHAC',
        accountHolderName: 'Jane Doe',
        country: 'GH',
      }).success,
    ).toBe(true);
  });

  it('requires ten digits for an ICB account number', () => {
    expect(
      transferDestinationSchema.safeParse({ kind: 'icb_customer', accountNumber: '123' }).success,
    ).toBe(false);
  });
});

describe('request validation', () => {
  it('enforces the password policy', () => {
    expect(passwordSchema.safeParse('short').success).toBe(false);
    expect(passwordSchema.safeParse('alllowercase123').success).toBe(false);
    expect(passwordSchema.safeParse('NoDigitsAtAllHere').success).toBe(false);
    expect(passwordSchema.safeParse('Demo!2345678').success).toBe(true);
  });

  it('normalises the login email to lower case', () => {
    const parsed = loginRequestSchema.parse({ email: 'Demo@ICB.Example', password: 'whatever' });
    expect(parsed.email).toBe('demo@icb.example');
  });

  it('rejects a zero-value transfer', () => {
    const request = {
      fromAccountId: '01KZ1FHZ89WFHPY2XZP4P3E6AK',
      destination: { kind: 'own_account', accountId: '01KZ1FHZ89WFHPY2XZP4P3E6AL' },
      amount: { minorUnits: 0, currency: 'USD', scale: 2 },
    };
    expect(createTransferRequestSchema.safeParse(request).success).toBe(false);
  });

  it('rejects a malformed identifier', () => {
    const request = {
      fromAccountId: 'not-a-ulid',
      destination: { kind: 'own_account', accountId: '01KZ1FHZ89WFHPY2XZP4P3E6AL' },
      amount: { minorUnits: 100, currency: 'USD', scale: 2 },
    };
    expect(createTransferRequestSchema.safeParse(request).success).toBe(false);
  });
});

describe('response shapes', () => {
  it('parses the account summary the API actually returns', () => {
    const summary = {
      id: '01KZ1FHZ89WFHPY2XZP4P3E6AK',
      kind: 'current',
      productCode: 'ICB-CURRENT',
      productName: 'ICB Everyday Current',
      nickname: null,
      currency: 'USD',
      status: 'active',
      balances: {
        ledger: { minorUnits: 1_676_827, currency: 'USD', scale: 2 },
        holds: { minorUnits: 0, currency: 'USD', scale: 2 },
        available: { minorUnits: 1_726_827, currency: 'USD', scale: 2 },
        overdraftLimit: { minorUnits: 50_000, currency: 'USD', scale: 2 },
        asOf: '2026-08-02T14:58:39.092Z',
      },
      identifiers: {
        number: '1544819806',
        iban: 'GH15ICBK1544819806',
        bic: 'ICBKGHAC',
        sortCode: '60-16-13',
      },
      primary: true,
      openedAt: '2026-08-02T14:58:39.092Z',
    };
    expect(accountSummarySchema.parse(summary).identifiers.iban).toBe('GH15ICBK1544819806');
  });
});
