import type { Loan, RepaymentFrequency } from '@icb/contracts';
import { fromMinorUnits, type CurrencyCode, type Money } from '@icb/money';
import { Injectable, Logger } from '@nestjs/common';
import type { ClientSession } from 'mongoose';

import { ConflictError } from '../../common/errors/index.js';
import { newId, newReference } from '../../infrastructure/database/identifier.js';
import { TransactionManager } from '../../infrastructure/database/transaction.manager.js';
import { ClockService } from '../../simulation/clock/clock.service.js';
import { AccountsService } from '../accounts/accounts.service.js';
import { customerRef, glRef } from '../ledger/domain/account-ref.js';
import { GL_LOANS_RECEIVABLE } from '../ledger/domain/chart-of-accounts.js';
import type { PostingActor, PostingLine } from '../ledger/domain/posting.types.js';
import { LedgerService } from '../ledger/ledger.service.js';
import { buildDatedSchedule, type DatedSchedule } from './domain/quote-builder.js';
import type {
  LoanApplicationDoc,
  StoredOffer,
} from './infrastructure/loan-application.schemas.js';
import { toLoan } from './infrastructure/loan.mapper.js';
import type { LoanDoc } from './infrastructure/loan.schemas.js';
import { LoansRepository } from './infrastructure/loans.repository.js';
import { toInstalmentSubs } from './infrastructure/schedule.builder.js';

const LOAN_SOURCE_TYPE = 'loan';

interface BookingInput {
  readonly application: LoanApplicationDoc;
  readonly offer: StoredOffer;
  readonly schedule: DatedSchedule;
  readonly now: Date;
}

interface DrawdownInput {
  readonly loan: LoanDoc;
  readonly principal: Money;
  readonly schedule: DatedSchedule;
  readonly actor: PostingActor;
  readonly now: Date;
  readonly session: ClientSession;
}

function buildLoanDocument(input: BookingInput): LoanDoc {
  const { application, offer, schedule, now } = input;
  return {
    _id: newId(),
    reference: newReference('LN'),
    applicationId: application._id,
    customerId: application.customerId,
    accountId: application.disbursementAccountId,
    repaymentAccountId: application.repaymentAccountId,
    productCode: application.productCode,
    productName: application.productName,
    status: 'approved',
    currency: application.currency,
    principalMinorUnits: offer.amountMinorUnits,
    outstandingPrincipalMinorUnits: 0,
    accruedInterestMinorUnits: 0,
    feesOutstandingMinorUnits: 0,
    rate: offer.rate,
    termMonths: application.termMonths,
    frequency: application.frequency,
    instalmentMinorUnits: schedule.instalment.minorUnits,
    schedule: toInstalmentSubs(schedule.rows),
    lastAccrualOn: null,
    maturesOn: schedule.maturesOn,
    disbursedAt: null,
    disbursementTransactionId: null,
    settledAt: null,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Drawdown is the moment the bank acquires an asset: it debits loans receivable (GL 1100) and
 * credits the customer's account. Two legs, one transaction — the customer's balance and the
 * bank's books move together or neither moves.
 */
function drawdownLines(loan: LoanDoc, principal: Money): PostingLine[] {
  return [
    {
      accountRef: glRef(GL_LOANS_RECEIVABLE),
      direction: 'debit',
      amount: principal,
      narrative: `Loan ${loan.reference} advanced`,
    },
    {
      accountRef: customerRef(loan.accountId),
      direction: 'credit',
      amount: principal,
      narrative: `Loan ${loan.reference} drawdown`,
    },
  ];
}

/**
 * Booking and drawdown.
 *
 * Acceptance and disbursement are deliberately separate steps. An accepted offer is a contract;
 * a drawdown is a movement of money that an operator authorises, and keeping them apart is what
 * lets a bank hold funds back on a file that needs one more check.
 */
@Injectable()
export class LoanDisbursementService {
  private readonly logger = new Logger(LoanDisbursementService.name);

  constructor(
    private readonly repository: LoansRepository,
    private readonly accounts: AccountsService,
    private readonly ledger: LedgerService,
    private readonly transactionManager: TransactionManager,
    private readonly clock: ClockService,
  ) {}

  /** Turn an accepted offer into a loan, scheduled but not yet drawn. */
  async book(application: LoanApplicationDoc): Promise<LoanDoc> {
    const offer = application.offer;
    if (!offer?.acceptedAt) {
      throw new ConflictError('A loan cannot be booked before its offer is accepted');
    }

    const now = this.clock.now();
    const document = buildLoanDocument({
      application,
      offer,
      schedule: this.scheduleFor(application, offer, now),
      now,
    });

    await this.repository.loans.create([document], { ordered: true });
    return document;
  }

  /** Advance the money and start the clock on the schedule. */
  async disburse(loanId: string, actor: PostingActor): Promise<Loan> {
    const loan = await this.repository.requireLoan(loanId);
    if (loan.status !== 'approved' || loan.disbursedAt !== null) {
      throw new ConflictError('This loan is not awaiting drawdown', { status: loan.status });
    }

    // Refuses a frozen or closed destination before any money moves.
    await this.accounts.loadSpendable(loan.accountId, loan.customerId);

    const now = this.clock.now();
    const principal = fromMinorUnits(loan.principalMinorUnits, loan.currency as CurrencyCode);
    // The calendar only becomes real at drawdown, so the schedule is re-anchored to today.
    const schedule = buildDatedSchedule({
      principal,
      annualRatePercent: loan.rate,
      termMonths: loan.termMonths,
      frequency: loan.frequency as RepaymentFrequency,
      anchor: now,
    });

    const updated = await this.transactionManager.withTransaction((session) =>
      this.postDrawdown({ loan, principal, schedule, actor, now, session }),
    );

    this.logger.log({ loanId, reference: loan.reference }, 'Loan disbursed');
    return toLoan(updated, null);
  }

  private scheduleFor(
    application: LoanApplicationDoc,
    offer: StoredOffer,
    anchor: Date,
  ): DatedSchedule {
    return buildDatedSchedule({
      principal: fromMinorUnits(offer.amountMinorUnits, application.currency as CurrencyCode),
      annualRatePercent: offer.rate,
      termMonths: application.termMonths,
      frequency: application.frequency as RepaymentFrequency,
      anchor,
    });
  }

  /** The unit of work: one balanced posting plus the servicing state it justifies. */
  private async postDrawdown(input: DrawdownInput): Promise<LoanDoc> {
    const { loan, principal, schedule, now, session } = input;

    const transaction = await this.ledger.postWithin(
      {
        type: 'loan_disbursement',
        description: `Drawdown of loan ${loan.reference}`,
        actor: input.actor,
        lines: drawdownLines(loan, principal),
        reference: newReference('DSB'),
        sourceType: LOAN_SOURCE_TYPE,
        sourceId: loan._id,
      },
      session,
    );

    const patch = {
      status: 'active',
      outstandingPrincipalMinorUnits: principal.minorUnits,
      instalmentMinorUnits: schedule.instalment.minorUnits,
      schedule: toInstalmentSubs(schedule.rows),
      maturesOn: schedule.maturesOn,
      lastAccrualOn: this.clock.toIsoDate(now),
      disbursedAt: now,
      disbursementTransactionId: transaction.id,
      updatedAt: now,
    };

    await this.repository.loans.updateOne({ _id: loan._id }, { $set: patch }, { session });
    await this.repository.applications.updateOne(
      { _id: loan.applicationId },
      { $set: { status: 'active', updatedAt: now } },
      { session },
    );

    return { ...loan, ...patch };
  }
}
