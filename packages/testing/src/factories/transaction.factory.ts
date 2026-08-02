import type { Posting, TransactionDetail, TransactionSummary } from '@icb/contracts';
import type { CurrencyCode } from '@icb/money';

import type { FactoryContext } from '../core/context.js';
import { moneyDto, randomMoney } from './helpers.js';

export interface TransactionOptions extends Partial<TransactionDetail> {
  readonly currency?: CurrencyCode;
}

/**
 * Customer-facing transaction factory (the contracts' view of a posting).
 *
 * Default: a posted incoming transfer (credit) with a known running balance — the row an
 * activity-feed or contract test renders. For the double-entry persistence shape, use
 * `ledgerTransaction` from the ledger factory instead.
 */
export function transactionSummary(
  ctx: FactoryContext,
  options: TransactionOptions = {},
): TransactionSummary {
  const { currency = 'GHS', ...overrides } = options;
  const amount = randomMoney(ctx, currency);
  const base: TransactionSummary = {
    id: ctx.nextId(),
    accountId: ctx.nextId(),
    reference: ctx.reference('TXN'),
    type: 'transfer_in',
    status: 'posted',
    direction: 'credit',
    amount,
    runningBalance: moneyDto(amount.minorUnits, currency),
    description: 'Transfer received',
    category: 'transfer',
    merchant: null,
    counterparty: {
      name: ctx.faker.person.fullName(),
      accountNumberMasked: `••••${ctx.digits(4)}`,
      bank: null,
      logoUrl: null,
    },
    bookedAt: ctx.clock.iso(),
    valueDate: ctx.clock.today(),
    pending: false,
  };
  return { ...base, ...overrides };
}

export function transactionDetail(
  ctx: FactoryContext,
  options: TransactionOptions = {},
): TransactionDetail {
  const { currency = 'GHS', ...overrides } = options;
  const summary = transactionSummary(ctx, options);
  const base: TransactionDetail = {
    ...summary,
    postings: [posting(ctx, summary, currency)],
    fees: [],
    fx: null,
    note: null,
    tags: [],
    attachmentCount: 0,
    relatedTransferId: null,
    relatedCardId: null,
    reversalOfId: null,
    reversedById: null,
    disputeId: null,
    metadata: undefined,
    settledAt: ctx.clock.iso(),
  };
  return { ...base, ...overrides };
}

function posting(
  ctx: FactoryContext,
  summary: TransactionSummary,
  currency: CurrencyCode,
): Posting {
  return {
    id: ctx.nextId(),
    accountLabel: 'Everyday Current Account',
    direction: summary.direction,
    amount: moneyDto(summary.amount.minorUnits, currency),
    valueDate: summary.valueDate,
    sequence: 0,
  };
}
