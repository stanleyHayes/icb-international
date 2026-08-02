import type { ConfigureAutopayRequest, MoneyDto } from '@icb/contracts';

import { DomainError } from '../../../common/errors/domain.error.js';
import { ConflictError, ValidationError } from '../../../common/errors/index.js';
import type { BillerDoc } from '../infrastructure/biller.schemas.js';

/**
 * The rules that decide whether a bill instruction is even coherent, separated from the services
 * that act on them. Each one exists because getting it wrong sends real money somewhere it cannot
 * be recovered from.
 */

/**
 * A meter number is not a policy number.
 *
 * Billers reject an unrecognised reference *after* taking the money, so the shape is checked here
 * first. The pattern comes from the seeded directory and is never client-supplied.
 */
export function assertReferenceMatches(biller: BillerDoc, customerReference: string): void {
  if (!biller.referencePattern) {
    return;
  }

  if (!new RegExp(biller.referencePattern, 'u').test(customerReference)) {
    throw new ValidationError(`Enter a valid ${biller.referenceLabel.toLowerCase()}`, [
      {
        path: 'customerReference',
        message: `${biller.name} expects the format ${biller.referencePattern}`,
      },
    ]);
  }
}

/**
 * Autopay has to be able to work out an amount on the day it fires.
 *
 * "Pay the full balance" is meaningless for a biller that publishes no balance — prepaid vending,
 * a tax payment — so that combination is refused at configuration time rather than silently
 * skipped every night.
 */
export function assertAutopayViable(request: ConfigureAutopayRequest, biller: BillerDoc): void {
  if (request.strategy === 'fixed_amount' && !request.fixedAmount) {
    throw new ValidationError('A fixed-amount autopay needs an amount', [
      { path: 'fixedAmount', message: 'Required when the strategy is fixed_amount' },
    ]);
  }

  if (request.strategy === 'full_balance' && !biller.supportsBalanceEnquiry) {
    throw new ConflictError(
      `${biller.name} does not publish a balance, so autopay must use a fixed amount`,
      { billerId: biller._id },
    );
  }
}

/** The amount and currency a biller will accept, checked before anything is posted. */
export function assertPayable(biller: BillerDoc, amount: MoneyDto): void {
  if (amount.currency !== biller.currency) {
    throw new DomainError('ACCOUNT_CURRENCY_MISMATCH', `${biller.name} is settled in ${biller.currency}`, {
      context: { billerCurrency: biller.currency, requestCurrency: amount.currency },
    });
  }

  const minimum = biller.minimumAmountMinorUnits;
  if (minimum !== null && amount.minorUnits < minimum) {
    throw new DomainError('AMOUNT_BELOW_MINIMUM', `${biller.name} does not accept payments this small`, {
      context: { minimumMinorUnits: minimum, attemptedMinorUnits: amount.minorUnits, currency: biller.currency },
    });
  }
}

/**
 * How much autopay should pay for a bill on the day it fires.
 *
 * The cap is the customer's safety net: it is applied *after* the strategy, so a full-balance rule
 * on a bill that unexpectedly quadruples still cannot empty the account.
 */
export function autopayAmountFor(
  strategy: string,
  outstandingMinorUnits: number | null,
  fixedMinorUnits: number | null,
  capMinorUnits: number | null,
): number {
  const base = strategy === 'fixed_amount' ? (fixedMinorUnits ?? 0) : (outstandingMinorUnits ?? 0);
  return capMinorUnits === null ? base : Math.min(base, capMinorUnits);
}

/** The trigger date for an autopay rule: `daysBeforeDue` calendar days ahead of the due date. */
export function autopayTriggerDate(dueOn: string, daysBeforeDue: number): string {
  const due = new Date(`${dueOn}T00:00:00.000Z`);
  return new Date(due.getTime() - daysBeforeDue * 86_400_000).toISOString().slice(0, 10);
}
