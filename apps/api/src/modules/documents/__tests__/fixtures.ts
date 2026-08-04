import type { AccountDetail, AssetRef } from '@icb/contracts';

import type { DocumentBranding } from '../domain/pdf-layout.js';
import type { BankDocumentDoc, StatementDoc } from '../infrastructure/document.schemas.js';

export const NOW = new Date('2026-08-04T10:00:00.000Z');
export const TODAY = '2026-08-04';
export const CUSTOMER_ID = 'cust-1';
export const ACCOUNT_ID = 'acct-1';
export const ACCOUNT_NUMBER = '1234564321';

export const BRANDING: DocumentBranding = {
  bankName: 'International Commercial Bank',
  bic: 'ICBKGHAC',
  sortCode: '12-34-56',
  country: 'Ghana',
};

export const ASSET: AssetRef = {
  provider: 'cloudinary',
  publicId: 'icb/statements/acct-1/statement-a1b2',
  resourceType: 'raw',
  format: 'pdf',
  bytes: 54_321,
  uploadedAt: NOW.toISOString(),
};

export function statementDoc(overrides: Partial<StatementDoc> = {}): StatementDoc {
  return {
    _id: 'stmt-1',
    customerId: CUSTOMER_ID,
    accountId: ACCOUNT_ID,
    accountLabel: 'Everyday Current ····4321',
    period: '2026-07',
    from: '2026-07-01',
    to: '2026-07-31',
    currency: 'GBP',
    openingMinorUnits: 500_000,
    closingMinorUnits: 515_000,
    totalCreditsMinorUnits: 20_000,
    totalDebitsMinorUnits: 5_000,
    transactionCount: 2,
    asset: ASSET,
    documentId: 'doc-1',
    generatedAt: NOW,
    ...overrides,
  };
}

export function bankDocumentDoc(overrides: Partial<BankDocumentDoc> = {}): BankDocumentDoc {
  return {
    _id: 'doc-1',
    customerId: CUSTOMER_ID,
    kind: 'statement',
    title: 'Statement 2026-07 for account 1234564321',
    accountId: ACCOUNT_ID,
    asset: ASSET,
    sizeBytes: 4_096,
    createdAt: NOW,
    ...overrides,
  };
}

export function accountDetail(overrides: Partial<AccountDetail> = {}): AccountDetail {
  return {
    id: ACCOUNT_ID,
    kind: 'current',
    productCode: 'CUR-STD',
    productName: 'Everyday Current',
    nickname: null,
    currency: 'GBP',
    status: 'active',
    balances: {
      ledger: { minorUnits: 515_000, currency: 'GBP', scale: 2 },
      holds: { minorUnits: 0, currency: 'GBP', scale: 2 },
      available: { minorUnits: 515_000, currency: 'GBP', scale: 2 },
      overdraftLimit: { minorUnits: 0, currency: 'GBP', scale: 2 },
      asOf: NOW.toISOString(),
    },
    identifiers: {
      number: ACCOUNT_NUMBER,
      iban: 'GH11ICBK12345678904321',
      bic: 'ICBKGHAC',
      sortCode: '12-34-56',
    },
    primary: true,
    openedAt: '2024-01-15T00:00:00.000Z',
    customerId: CUSTOMER_ID,
    interestRate: null,
    minimumBalance: null,
    monthlyFee: null,
    closedAt: null,
    closureReason: null,
    statementDay: 1,
    lastStatementAt: null,
    ...overrides,
  };
}

/** A resolved mongoose query chain ending in `.lean()`. */
export function leanOf<T>(value: T): { lean: () => Promise<T> } {
  return { lean: () => Promise.resolve(value) };
}
