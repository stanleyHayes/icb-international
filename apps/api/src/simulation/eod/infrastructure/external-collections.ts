import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import type { Collection, Connection } from 'mongoose';

/**
 * Collections end-of-day reads and writes but does not own.
 *
 * Loans, statements and AML alerts belong to their own modules, which are free to change their
 * services, mappers and validation without asking the batch. Reaching them through the raw
 * collection rather than through their Mongoose models is deliberate: the batch depends on the
 * *documented shape* of the data (agent_plan.md §5) and on nothing else, so a refactor next door
 * cannot break the nightly run, and the batch cannot accidentally bypass a rule by calling a
 * service method that was never meant for it.
 *
 * Only the fields below are ever touched. Anything else on those documents is none of our
 * business.
 */

/** One row of a loan's amortisation schedule, as the loans module stores it. */
export type ScheduleRow = {
  number: number;
  dueOn: string;
  instalmentMinorUnits: number;
  paidMinorUnits: number;
  status: string;
};

export type LoanRow = {
  _id: string;
  customerId: string;
  status: string;
  currency: string;
  schedule: ScheduleRow[];
  updatedAt?: Date;
};

export type StatementRow = {
  _id: string;
  accountId: string;
  /** `YYYY-MM`. */
  period: string;
  openingBalanceMinorUnits: number;
  closingBalanceMinorUnits: number;
  debitTurnoverMinorUnits: number;
  creditTurnoverMinorUnits: number;
  entryCount: number;
  currency: string;
  fileKey: string | null;
  generatedAt: Date;
};

export type AmlAlertRow = {
  _id: string;
  customerId: string;
  subjectRef: string;
  kind: string;
  severity: string;
  status: string;
  narrative: string;
  assignedTo: string | null;
  /** Marks the alert as raised by the batch, so a re-run recognises its own work. */
  source: string;
  businessDate: string;
  createdAt: Date;
};

@Injectable()
export class ExternalCollections {
  constructor(@InjectConnection() private readonly connection: Connection) {}

  loans(): Collection<LoanRow> {
    return this.connection.collection<LoanRow>('loans');
  }

  statements(): Collection<StatementRow> {
    return this.connection.collection<StatementRow>('statements');
  }

  amlAlerts(): Collection<AmlAlertRow> {
    return this.connection.collection<AmlAlertRow>('aml_alerts');
  }
}
