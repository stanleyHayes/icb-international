import type { DatedInstalment } from '../domain/quote-builder.js';
import { outstandingOn } from './loan.mapper.js';
import type { InstalmentSub } from './loan.schemas.js';

/**
 * Schedule persistence.
 *
 * Every function returns a *new* array. Mutating a schedule in place is how a partial failure
 * leaves a loan claiming payments it never received, so the caller always writes a whole,
 * consistent schedule or none of it.
 */

const SCHEDULED = 'scheduled';
const PAID = 'paid';
const PARTIALLY_PAID = 'partially_paid';
const OVERDUE = 'overdue';
const DUE = 'due';

/** Turn a freshly amortised schedule into storable rows: nothing paid, nothing yet due. */
export function toInstalmentSubs(rows: readonly DatedInstalment[]): InstalmentSub[] {
  return rows.map((row) => ({
    number: row.number,
    dueOn: row.dueOn,
    instalmentMinorUnits: row.instalment.minorUnits,
    principalMinorUnits: row.principal.minorUnits,
    interestMinorUnits: row.interest.minorUnits,
    feesMinorUnits: 0,
    openingBalanceMinorUnits: row.openingBalance.minorUnits,
    closingBalanceMinorUnits: row.closingBalance.minorUnits,
    status: SCHEDULED,
    paidAt: null,
    paidMinorUnits: 0,
  }));
}

/**
 * Apply a payment across the schedule oldest-first.
 *
 * Order matters: crediting the newest instalment would leave an older one open and the loan
 * permanently ageing in arrears while the customer paid every month.
 */
export function applyPaymentToSchedule(
  schedule: readonly InstalmentSub[],
  amountMinorUnits: number,
  paidAt: Date,
): InstalmentSub[] {
  let remaining = Math.max(0, amountMinorUnits);

  return schedule.map((instalment) => {
    const owed = outstandingOn(instalment);
    if (remaining <= 0 || owed <= 0) {
      return instalment;
    }
    const applied = Math.min(remaining, owed);
    remaining -= applied;
    const paidMinorUnits = instalment.paidMinorUnits + applied;
    return {
      ...instalment,
      paidMinorUnits,
      paidAt,
      status: paidMinorUnits >= instalment.instalmentMinorUnits ? PAID : PARTIALLY_PAID,
    };
  });
}

/** Close out every remaining row. Used when a settlement clears the loan in full. */
export function markAllPaid(schedule: readonly InstalmentSub[], paidAt: Date): InstalmentSub[] {
  return schedule.map((instalment) =>
    outstandingOn(instalment) <= 0
      ? instalment
      : {
          ...instalment,
          paidMinorUnits: instalment.instalmentMinorUnits,
          paidAt,
          status: PAID,
        },
  );
}

/**
 * Re-derive each row's status from the calendar. Cheap enough to run on every read, which is why
 * a loan never has to be "refreshed" by a batch job before it tells the truth.
 */
export function ageSchedule(schedule: readonly InstalmentSub[], today: string): InstalmentSub[] {
  return schedule.map((instalment) => ({ ...instalment, status: statusFor(instalment, today) }));
}

function statusFor(instalment: InstalmentSub, today: string): string {
  if (instalment.status === 'written_off') {
    return instalment.status;
  }
  if (outstandingOn(instalment) <= 0) {
    return PAID;
  }
  if (instalment.dueOn < today) {
    return OVERDUE;
  }
  if (instalment.dueOn === today) {
    return DUE;
  }
  return instalment.paidMinorUnits > 0 ? PARTIALLY_PAID : SCHEDULED;
}
