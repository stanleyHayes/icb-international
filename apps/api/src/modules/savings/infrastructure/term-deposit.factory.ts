import type { TermDeposit } from '@icb/contracts';
import type { Money } from '@icb/money';

import { addMonths } from '../domain/date-maths.js';
import type { TermDepositDoc } from './term-deposit.schemas.js';

/**
 * Everything needed to bring a term deposit into existence.
 *
 * Shared by the customer-initiated open and by an automatic rollover at maturity, so the two
 * paths cannot produce subtly different contracts — a rollover is a new deposit on the same
 * terms, not a special case with its own defaults.
 */
export interface CreateDepositInput {
  readonly customerId: string;
  readonly fundingAccountId: string;
  readonly principal: Money;
  readonly termMonths: number;
  readonly rate: number;
  readonly maturityInstruction: TermDeposit['maturityInstruction'];
  readonly rolloverAccountId: string | null;
  readonly rolledFromDepositId: string | null;
}

/** Identifiers allocated before the document is written, so the postings can reference them. */
export interface DepositIdentity {
  readonly id: string;
  readonly reference: string;
  readonly accountId: string;
}

export function buildDepositDocument(
  input: CreateDepositInput,
  identity: DepositIdentity,
  openedAt: Date,
): TermDepositDoc {
  const openedOn = openedAt.toISOString().slice(0, 10);

  return {
    _id: identity.id,
    customerId: input.customerId,
    accountId: identity.accountId,
    fundingAccountId: input.fundingAccountId,
    reference: identity.reference,
    principalMinorUnits: input.principal.minorUnits,
    currency: input.principal.currency,
    rate: input.rate,
    termMonths: input.termMonths,
    openedOn,
    maturesOn: addMonths(openedOn, input.termMonths),
    maturityInstruction: input.maturityInstruction,
    rolloverAccountId: input.rolloverAccountId,
    status: 'active',
    interestPaidMinorUnits: 0,
    // Interest has been posted "up to" the opening date, which is to say none has been posted.
    accruedTo: openedOn,
    breakQuote: null,
    rolledFromDepositId: input.rolledFromDepositId,
    openedAt,
    maturedAt: null,
    brokenAt: null,
  };
}
