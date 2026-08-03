import { customerRef, glRef, type AccountRef } from '../../../ledger/domain/account-ref.js';
import { GL_FEE_INCOME } from '../../../ledger/domain/chart-of-accounts.js';
import type { PostingLine } from '../../../ledger/domain/posting.types.js';
import type { FxConversionService } from '../../../fx/fx-conversion.service.js';
import type { PreparedTransfer } from '../transfer-pipeline.types.js';

/**
 * The posting lines every rail shares.
 *
 * The value legs debit the sender and credit wherever the rail lands the money; the fee legs
 * debit the sender again and credit fee income (4000). Cross-currency transfers route the value
 * through the FX module's balanced four-leg construction, so no rail ever hand-rolls a
 * conversion — and every currency in the result still nets to zero.
 */
export function buildValueLines(
  prepared: PreparedTransfer,
  creditRef: AccountRef,
  fxConversion: FxConversionService,
  narrative: string,
): PostingLine[] {
  const sourceRef = customerRef(prepared.source._id);

  if (prepared.fx !== null) {
    return fxConversion.buildPostingLines({
      sourceRef,
      targetRef: creditRef,
      from: prepared.debit,
      to: prepared.credit,
      roundingDelta: prepared.fx.roundingDelta,
      narrative,
    });
  }

  return [
    { accountRef: sourceRef, direction: 'debit', amount: prepared.debit, narrative },
    { accountRef: creditRef, direction: 'credit', amount: prepared.credit, narrative },
  ];
}

/** The fee legs: customer out, fee income in. Empty for a free rail. */
export function buildFeeLines(prepared: PreparedTransfer, narrative: string): PostingLine[] {
  return prepared.fees.map((fee) => [
    feeLeg(prepared, fee.amount.minorUnits, 'debit', `${narrative} — ${fee.label}`),
    feeLeg(prepared, fee.amount.minorUnits, 'credit', `${narrative} — ${fee.label}`),
  ]).flat();
}

function feeLeg(
  prepared: PreparedTransfer,
  minorUnits: number,
  direction: 'debit' | 'credit',
  narrative: string,
): PostingLine {
  const isCustomer = direction === 'debit';
  return {
    accountRef: isCustomer ? customerRef(prepared.source._id) : glRef(GL_FEE_INCOME),
    direction,
    amount: { minorUnits, currency: prepared.debit.currency },
    narrative,
  };
}
