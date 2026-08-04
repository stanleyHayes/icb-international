import type { Connection } from 'mongoose';

import { encryptField, fingerprint } from '../../../src/modules/cards/domain/pan-cipher.js';
import { FIXED_NOW } from './identities.js';
import { insertDoc, CURRENCY } from './resources.js';

const TEST_PAN = '4242424242424242';
const TEST_CVV = '123';

function encryptionKey(): string {
  const key = process.env['FIELD_ENCRYPTION_KEY'];
  if (!key) {
    throw new Error('FIELD_ENCRYPTION_KEY is not set; the API under test would refuse to boot too.');
  }
  return key;
}

export interface MoneySeedContext {
  readonly customerId: string;
  readonly accountId: string;
  readonly secondAccountId: string;
}

/** A completed internal transfer between the customer's own accounts. */
export async function seedTransfer(connection: Connection, ctx: MoneySeedContext): Promise<string> {
  return insertDoc(connection, 'transfers', {
    reference: 'TRF-SEC02A',
    customerId: ctx.customerId,
    fromAccountId: ctx.accountId,
    destination: { kind: 'own_account', accountId: ctx.secondAccountId },
    rail: 'internal',
    status: 'completed',
    debitMinorUnits: 10_000,
    creditMinorUnits: 10_000,
    currency: CURRENCY,
    creditCurrency: null,
    feeMinorUnits: 0,
    feeBreakdown: [],
    fx: null,
    recipientName: 'Second Current',
    recipientMasked: '****0001',
    customerReference: null,
    note: null,
    transactionId: null,
    railReference: null,
    estimatedArrival: FIXED_NOW,
    executeAt: null,
    schedule: null,
    standingOrderId: null,
    nextOccurrenceAt: null,
    recurring: false,
    timeline: [{ at: FIXED_NOW, status: 'completed', label: 'Completed', detail: null }],
    createdAt: FIXED_NOW,
    completedAt: FIXED_NOW,
    failureCode: null,
    failureReason: null,
  });
}

export async function seedTransferTemplate(connection: Connection, ctx: MoneySeedContext): Promise<string> {
  return insertDoc(connection, 'transfer_templates', {
    customerId: ctx.customerId,
    name: 'Rent',
    fromAccountId: ctx.accountId,
    destination: { kind: 'own_account', accountId: ctx.secondAccountId },
    amountMinorUnits: 100_000,
    currency: CURRENCY,
    reference: null,
    lastUsedAt: null,
    useCount: 0,
  });
}

export async function seedStandingOrder(connection: Connection, ctx: MoneySeedContext): Promise<string> {
  return insertDoc(connection, 'standing_orders', {
    customerId: ctx.customerId,
    name: 'Monthly sweep',
    fromAccountId: ctx.accountId,
    destination: { kind: 'own_account', accountId: ctx.secondAccountId },
    amountMinorUnits: 50_000,
    currency: CURRENCY,
    reference: null,
    note: null,
    schedule: { rrule: null, startsOn: '2024-01-02', endsOn: null, maxOccurrences: null },
    nextRunAt: null,
    status: 'active',
    createdAt: FIXED_NOW,
  });
}

const DEBIT_CONTROLS = {
  channels: { online: true, contactless: true, atm: true, international: false, in_store: true },
  blockedCategories: [] as string[],
  allowedCountries: null,
};

const DEBIT_LIMITS = {
  perTransactionMinorUnits: 200_000,
  dailyMinorUnits: 500_000,
  monthlyMinorUnits: 5_000_000,
  atmDailyMinorUnits: 100_000,
  contactlessMinorUnits: 10_000,
};

/** An active debit card whose PAN/CVV decrypt under the app's field key (PAN reveal control). */
export async function seedCard(connection: Connection, ctx: MoneySeedContext): Promise<string> {
  const key = encryptionKey();
  return insertDoc(connection, 'cards', {
    customerId: ctx.customerId,
    accountId: ctx.accountId,
    kind: 'debit',
    network: 'visa',
    status: 'active',
    nickname: null,
    cardholderName: 'Ada Owner',
    panEncrypted: encryptField(TEST_PAN, key),
    panFingerprint: fingerprint(TEST_PAN, key),
    panLast4: TEST_PAN.slice(-4),
    cvvEncrypted: encryptField(TEST_CVV, key),
    expiryMonth: 12,
    expiryYear: 2030,
    currency: CURRENCY,
    issuingCountry: 'GH',
    frozen: false,
    contactlessEnabled: true,
    pinHash: null,
    pinSetAt: null,
    controls: DEBIT_CONTROLS,
    limits: DEBIT_LIMITS,
    ...cardLifecycleFields(),
  });
}

function cardLifecycleFields(): Record<string, unknown> {
  return {
    deliveryAddressId: 'residential',
    issuedAt: FIXED_NOW,
    activatedAt: FIXED_NOW,
    cancelledAt: null,
    cancellationReason: null,
    replacedCardId: null,
    replacedByCardId: null,
    travelNoticeFrom: null,
    travelNoticeUntil: null,
    travelCountries: [],
    reportedReason: null,
    reportedAt: null,
    blockedReason: null,
    blockedBy: null,
    blockedAt: null,
  };
}
