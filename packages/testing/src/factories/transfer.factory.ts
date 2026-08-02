import type { MoneyDto, TransferDetail, TransferDestination } from '@icb/contracts';
import type { CurrencyCode } from '@icb/money';

import type { FactoryContext } from '../core/context.js';
import { accountNumber, moneyDto, randomMoney, zeroMoney } from './helpers.js';

/** Not exported by `@icb/contracts` directly; derived from the detail shape it does export. */
type TransferTimelineEvent = TransferDetail['timeline'][number];

const MASK_VISIBLE_DIGITS = 4;
const ESTIMATED_ARRIVAL_DAYS = 0;

export interface TransferOptions extends Partial<TransferDetail> {
  readonly currency?: CurrencyCode;
}

/**
 * Transfer factory.
 *
 * Default: a completed internal transfer to another ICB customer, no fees, no FX — the state a
 * "transfer succeeded" assertion wants. The timeline matches the summary fields.
 */
export function transferDetail(ctx: FactoryContext, options: TransferOptions = {}): TransferDetail {
  const { currency = 'GHS', ...overrides } = options;
  const amount = randomMoney(ctx, currency);
  const destination = transferDestination(ctx);
  const recipientNumber = destination.kind === 'icb_customer' ? destination.accountNumber : '0000000000';
  const base: TransferDetail = {
    id: ctx.nextId(),
    reference: ctx.reference('TRF'),
    status: 'completed',
    rail: 'internal',
    fromAccountId: ctx.nextId(),
    fromAccountLabel: 'Everyday Current Account',
    recipientName: ctx.faker.person.fullName(),
    recipientMasked: `••••${recipientNumber.slice(-MASK_VISIBLE_DIGITS)}`,
    debitAmount: amount,
    creditAmount: amount,
    createdAt: ctx.clock.iso(),
    executeAt: ctx.clock.iso(),
    completedAt: ctx.clock.iso(),
    recurring: false,
    destination,
    fees: [],
    totalFees: zeroMoney(currency),
    fx: null,
    note: null,
    schedule: null,
    nextOccurrenceAt: null,
    transactionId: ctx.nextId(),
    estimatedArrival: ctx.clock.isoPlusDays(ESTIMATED_ARRIVAL_DAYS),
    timeline: timeline(ctx),
    failureCode: null,
    failureReason: null,
    cancellable: false,
  };
  return { ...base, ...overrides };
}

export function transferDestination(
  ctx: FactoryContext,
  overrides: Partial<Extract<TransferDestination, { kind: 'icb_customer' }>> = {},
): TransferDestination {
  return { kind: 'icb_customer', accountNumber: accountNumber(ctx), ...overrides };
}

function timeline(ctx: FactoryContext): TransferTimelineEvent[] {
  return [
    { at: ctx.clock.iso(), status: 'processing', label: 'Transfer initiated', detail: null },
    { at: ctx.clock.iso(), status: 'completed', label: 'Transfer completed', detail: null },
  ];
}

/** Amount helper for transfer requests: a positive money DTO. */
export function transferAmount(ctx: FactoryContext, currency: CurrencyCode = 'GHS'): MoneyDto {
  return moneyDto(ctx.intBetween(100, 100_000), currency);
}
