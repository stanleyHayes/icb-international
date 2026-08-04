import { vi } from 'vitest';

import type { AccountDoc } from '../../accounts/infrastructure/account.schemas.js';
import type { CustomerDoc } from '../../customers/infrastructure/customer.schemas.js';
import type { LedgerEntryDoc } from '../../ledger/infrastructure/ledger.schemas.js';
import type { DisputeDoc } from '../infrastructure/dispute.schemas.js';
import type { RiskAssessmentDoc, RiskCaseDoc } from '../infrastructure/risk-case.schemas.js';
import { DECISION_THRESHOLD_KEY } from '../infrastructure/risk-rule.schemas.js';
import type {
  RiskProfileDoc,
  RiskRuleDoc,
  RiskSettingsDoc,
} from '../infrastructure/risk-rule.schemas.js';

export const NOW = new Date('2026-08-04T10:00:00.000Z');
export const CUSTOMER_ID = '01J8ZCQ0R0K3M4N5P6Q7R8S9C1';
export const ACCOUNT_ID = '01J8ZCQ0R0K3M4N5P6Q7R8S9A1';
export const TRANSACTION_ID = '01J8ZCQ0R0K3M4N5P6Q7R8S9T1';
export const ENTRY_ID = '01J8ZCQ0R0K3M4N5P6Q7R8S9E1';
export const DISPUTE_ID = '01J8ZCQ0R0K3M4N5P6Q7R8S9D1';
export const ASSESSMENT_ID = '01J8ZCQ0R0K3M4N5P6Q7R8S9A2';
export const CASE_ID = '01J8ZCQ0R0K3M4N5P6Q7R8S9C2';
export const RULE_ID = '01J8ZCQ0R0K3M4N5P6Q7R8S9R1';

export const ASSET = {
  provider: 'cloudinary',
  publicId: 'icb/disputes/dsp-1/receipt-a1b2',
  resourceType: 'image',
  format: 'png',
  bytes: 12_345,
  uploadedAt: NOW.toISOString(),
} as const;

/** An individual customer with a display name; tests override the fields they exercise. */
export function customerDoc(overrides: Record<string, unknown> = {}): CustomerDoc {
  return {
    _id: CUSTOMER_ID,
    type: 'individual',
    status: 'active',
    email: 'ama.mensah@example.com',
    individual: { firstName: 'Ama', lastName: 'Mensah' },
    business: null,
    lastActivityAt: NOW,
    ...overrides,
  } as unknown as CustomerDoc;
}

export function accountDoc(overrides: Record<string, unknown> = {}): AccountDoc {
  return { _id: ACCOUNT_ID, customerId: CUSTOMER_ID, ...overrides } as unknown as AccountDoc;
}

/** A posted debit leg on the customer's own account. */
export function ledgerEntryDoc(overrides: Record<string, unknown> = {}): LedgerEntryDoc {
  return {
    _id: ENTRY_ID,
    transactionId: TRANSACTION_ID,
    accountRef: `acct:${ACCOUNT_ID}`,
    direction: 'debit',
    minorUnits: 25_000,
    currency: 'GBP',
    signedMinorUnits: -25_000,
    valueDate: '2026-08-03',
    bookedAt: NOW,
    sequence: 1,
    narrative: 'Shoprite Accra',
    transactionType: 'card_payment',
    transactionStatus: 'posted',
    ...overrides,
  } as unknown as LedgerEntryDoc;
}

export function profileDoc(overrides: Record<string, unknown> = {}): RiskProfileDoc {
  return {
    _id: '01J8ZCQ0R0K3M4N5P6Q7R8S9P1',
    customerId: CUSTOMER_ID,
    knownDeviceIds: ['device-1'],
    knownBeneficiaryIds: ['ben-1'],
    lastCountryCode: 'GB',
    lastCountryAt: NOW,
    lastAssessedAt: NOW,
    assessmentCount: 3,
    ...overrides,
  };
}

export function ruleDoc(overrides: Record<string, unknown> = {}): RiskRuleDoc {
  return {
    _id: RULE_ID,
    code: 'MCC_RISK',
    label: 'High-risk merchant category',
    description: 'Flags watched merchant categories',
    kind: 'mcc_risk',
    enabled: true,
    weight: 14,
    parameters: { highRiskMccs: '7995' },
    updatedBy: null,
    lastChangeReason: null,
    updatedAt: NOW,
    createdAt: NOW,
    ...overrides,
  };
}

export function settingsDoc(overrides: Record<string, unknown> = {}): RiskSettingsDoc {
  return {
    _id: '01J8ZCQ0R0K3M4N5P6Q7R8S9S1',
    key: DECISION_THRESHOLD_KEY,
    challengeAt: 25,
    reviewAt: 50,
    blockAt: 80,
    updatedBy: null,
    ...overrides,
  };
}

/** A review-decision assessment; the dispute and case factories hang off this shape. */
export function assessmentDoc(overrides: Record<string, unknown> = {}): RiskAssessmentDoc {
  return {
    _id: ASSESSMENT_ID,
    subjectType: 'card_authorisation',
    subjectId: 'auth-1',
    customerId: CUSTOMER_ID,
    score: 55,
    decision: 'review',
    firedRules: [
      {
        code: 'MCC_RISK',
        label: 'High-risk merchant category',
        weight: 55,
        contribution: 55,
        observed: 'Merchant category 7995 is on the high-risk list',
        threshold: 'outside the watched merchant categories',
      },
    ],
    narrative: 'Held for review: an analyst must release or block this before value moves.',
    amountMinorUnits: 125_000,
    currency: 'GBP',
    rulesConsidered: 9,
    assessedAt: NOW,
    ...overrides,
  };
}

export function caseDoc(overrides: Record<string, unknown> = {}): RiskCaseDoc {
  return {
    _id: CASE_ID,
    reference: 'CASE-TEST0001',
    customerId: CUSTOMER_ID,
    customerName: 'Ama Mensah',
    assessmentId: ASSESSMENT_ID,
    severity: 'high',
    status: 'open',
    decision: 'review',
    amountMinorUnits: 125_000,
    currency: 'GBP',
    assignedTo: null,
    resolution: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

export function disputeDoc(overrides: Record<string, unknown> = {}): DisputeDoc {
  return {
    _id: DISPUTE_ID,
    reference: 'DSP-TEST0001',
    transactionId: TRANSACTION_ID,
    customerId: CUSTOMER_ID,
    customerName: 'Ama Mensah',
    accountId: ACCOUNT_ID,
    amountMinorUnits: 25_000,
    currency: 'GBP',
    reason: 'unauthorised',
    detail: 'I did not make this payment at all',
    contactedMerchant: false,
    stage: 'submitted',
    outcome: null,
    evidence: [],
    provisionalCredit: null,
    timeline: [{ at: NOW, stage: 'submitted', note: 'Dispute raised against Shoprite Accra' }],
    slaDueAt: new Date('2026-08-18T10:00:00.000Z'),
    resolvedAt: null,
    assignedTo: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

type ChainMock = Record<string, ReturnType<typeof vi.fn>>;

/**
 * A Mongoose query stand-in: every chaining method returns the same object, `lean` resolves.
 * Models are mocked only here — the port boundary — never deeper into the module.
 */
export function chainQuery(result: unknown): ChainMock {
  const chain: ChainMock = {};
  for (const method of ['sort', 'select', 'limit', 'skip', 'session']) {
    chain[method] = vi.fn().mockReturnValue(chain);
  }
  chain['lean'] = vi.fn().mockResolvedValue(result);
  return chain;
}
