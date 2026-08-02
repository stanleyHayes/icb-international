import { Injectable, Logger } from '@nestjs/common';

import { ExternalCollections, type LoanRow, type ScheduleRow } from '../infrastructure/external-collections.js';
import type { EodContext } from '../eod.context.js';

const SCHEDULED = 'scheduled';
const OVERDUE = 'overdue';

/**
 * Step 5 — age loan arrears.
 *
 * A loan is not simply "late": how late decides the collections queue it enters and the provision
 * held against it. This step does the one thing that must happen nightly and cannot happen on
 * read — it moves instalments whose due date has passed from `scheduled` to `overdue`, so the
 * loan's own servicing logic and every report downstream see a consistent picture.
 *
 * Idempotent because the transition is one-way and conditional: an instalment already `overdue`,
 * `paid`, or partially paid to zero outstanding is never selected again.
 */
@Injectable()
export class ArrearsAgeingStep {
  private readonly logger = new Logger(ArrearsAgeingStep.name);

  constructor(private readonly external: ExternalCollections) {}

  async run(context: EodContext): Promise<number> {
    const loans = await this.external
      .loans()
      .find({ status: 'active', 'schedule.dueOn': { $lt: context.businessDate } })
      .toArray();

    let aged = 0;
    for (const loan of loans) {
      aged += await this.ageOne(loan, context);
    }

    if (aged > 0) {
      this.logger.log({ businessDate: context.businessDate, loans: aged }, 'Loan arrears aged');
    }
    return aged;
  }

  /** Returns 1 when the loan actually changed, so the report counts loans and not instalments. */
  private async ageOne(loan: LoanRow, context: EodContext): Promise<number> {
    const overdue = (loan.schedule ?? []).filter((row) => isNewlyOverdue(row, context.businessDate));

    if (overdue.length === 0) {
      return 0;
    }

    const numbers = overdue.map((row) => row.number);
    const result = await this.external.loans().updateOne(
      { _id: loan._id },
      {
        $set: { 'schedule.$[late].status': OVERDUE, updatedAt: context.asOf },
      },
      { arrayFilters: [{ 'late.number': { $in: numbers }, 'late.status': SCHEDULED }] },
    );

    return result.modifiedCount > 0 ? 1 : 0;
  }
}

/** Due before today, still marked scheduled, and not settled by a payment against it. */
function isNewlyOverdue(row: ScheduleRow, businessDate: string): boolean {
  return (
    row.status === SCHEDULED
    && row.dueOn < businessDate
    && row.paidMinorUnits < row.instalmentMinorUnits
  );
}
