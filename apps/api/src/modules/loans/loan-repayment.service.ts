import { makeRepaymentRequestSchema, type LoanDetail, type PayoffQuote } from '@icb/contracts';
import {
  add,
  format,
  fromMinorUnits,
  isGreaterThan,
  isLessThan,
  sum,
  type CurrencyCode,
  type Money,
} from '@icb/money';
import { Injectable, Logger } from '@nestjs/common';
import type { ClientSession } from 'mongoose';

import { DomainError } from '../../common/errors/domain.error.js';
import {
  ConflictError,
  InsufficientFundsError,
  ValidationError,
} from '../../common/errors/index.js';
import { newReference } from '../../infrastructure/database/identifier.js';
import { TransactionManager } from '../../infrastructure/database/transaction.manager.js';
import { ClockService } from '../../simulation/clock/clock.service.js';
import { AccountsService } from '../accounts/accounts.service.js';
import { customerRef, glRef } from '../ledger/domain/account-ref.js';
import {
  GL_FEE_INCOME,
  GL_INTEREST_INCOME,
  GL_LOANS_RECEIVABLE,
} from '../ledger/domain/chart-of-accounts.js';
import type { PostingLine } from '../ledger/domain/posting.types.js';
import { LedgerService } from '../ledger/ledger.service.js';
import { ageArrears } from './domain/arrears.js';
import { getLoanProduct } from './domain/loan-products.js';
import { accrueInterest, buildPayoffQuote, earlyRepaymentFee } from './domain/payoff.js';
import {
  allocateRepayment,
  totalOutstanding,
  type OutstandingBalances,
  type RepaymentAllocation,
} from './domain/repayment-allocation.js';
import { daysBetweenIso } from './domain/schedule-dates.js';
import { outstandingOn, toAgeable, toLoanDetail } from './infrastructure/loan.mapper.js';
import type { LoanDoc } from './infrastructure/loan.schemas.js';
import { LIVE_LOAN_STATUSES, LoansRepository } from './infrastructure/loans.repository.js';
import {
  ageSchedule,
  applyPaymentToSchedule,
  markAllPaid,
} from './infrastructure/schedule.builder.js';

/**
 * The contract publishes `makeRepaymentRequestSchema` but no inferred alias for it, so the type
 * is taken from the schema itself rather than hand-written — there is still exactly one
 * definition of the shape.
 */
export type RepaymentRequest = ReturnType<typeof makeRepaymentRequestSchema.parse>;

/** A payoff figure is only good while the interest it assumes is still accurate. */
const PAYOFF_VALIDITY_MS = 7 * 86_400_000;
const LOAN_SOURCE_TYPE = 'loan';

interface Position {
  readonly outstanding: OutstandingBalances;
  readonly remainingScheduledInterest: Money;
}

interface PostingInput {
  readonly loan: LoanDoc;
  readonly source: { _id: string; number: string };
  readonly allocation: RepaymentAllocation;
  readonly outstanding: OutstandingBalances;
  readonly today: string;
  readonly session: ClientSession;
}

/**
 * One debit against the customer, and one credit per component of the waterfall: principal
 * retires the receivable at GL 1100, interest becomes income at GL 4100, and charges become fee
 * income at GL 4000. Zero components are omitted rather than posted as empty legs.
 */
function repaymentLines(accountId: string, allocation: RepaymentAllocation): PostingLine[] {
  const credits: readonly [Money, string, string][] = [
    [allocation.fees, GL_FEE_INCOME, 'Loan charges'],
    [allocation.interest, GL_INTEREST_INCOME, 'Loan interest'],
    [allocation.principal, GL_LOANS_RECEIVABLE, 'Loan principal'],
  ];

  const lines: PostingLine[] = [
    {
      accountRef: customerRef(accountId),
      direction: 'debit',
      amount: allocation.applied,
      narrative: 'Loan repayment',
    },
  ];

  for (const [amount, code, narrative] of credits) {
    if (amount.minorUnits > 0) {
      lines.push({ accountRef: glRef(code), direction: 'credit', amount, narrative });
    }
  }
  return lines;
}

function statusAfter(settled: boolean, inArrears: boolean): string {
  if (settled) return 'settled';
  return inArrears ? 'in_arrears' : 'active';
}

/**
 * Servicing a live loan.
 *
 * Interest accrues ACT/365 on the outstanding principal from the last accrual date, so a customer
 * who pays early pays less and one who pays late pays more — without a nightly batch having to
 * have run first.
 */
@Injectable()
export class LoanRepaymentService {
  private readonly logger = new Logger(LoanRepaymentService.name);

  constructor(
    private readonly repository: LoansRepository,
    private readonly accounts: AccountsService,
    private readonly ledger: LedgerService,
    private readonly transactionManager: TransactionManager,
    private readonly clock: ClockService,
  ) {}

  async payoffQuote(loanId: string, customerId: string): Promise<PayoffQuote> {
    const loan = this.requireLive(await this.repository.requireLoan(loanId, customerId));
    const today = this.clock.today();
    const position = this.positionAt(loan, today);

    return buildPayoffQuote({
      loanId: loan._id,
      asOf: today,
      outstandingPrincipal: position.outstanding.principal,
      accruedInterest: position.outstanding.interest,
      outstandingFees: position.outstanding.fees,
      earlyRepaymentFeePercent: getLoanProduct(loan.productCode).earlyRepaymentFeePercent,
      remainingScheduledInterest: position.remainingScheduledInterest,
      validUntil: new Date(this.clock.epochMs() + PAYOFF_VALIDITY_MS),
    });
  }

  async repay(
    loanId: string,
    customerId: string,
    request: RepaymentRequest,
  ): Promise<LoanDetail> {
    const loan = this.requireLive(await this.repository.requireLoan(loanId, customerId));
    const currency = loan.currency as CurrencyCode;
    const source = await this.accounts.loadSpendable(request.fromAccountId, customerId);
    assertSameCurrency(source.currency, request.amount.currency, currency);

    const amount = fromMinorUnits(request.amount.minorUnits, currency);
    const today = this.clock.today();
    const outstanding = this.outstandingFor(loan, today, request.kind);
    const allocation = this.plan(amount, outstanding, request.kind);

    await this.assertFunded(source._id, currency, amount);

    const updated = await this.transactionManager.withTransaction((session) =>
      this.postRepayment({ loan, source, allocation, outstanding, today, session }),
    );

    this.logger.log({ loanId, kind: request.kind }, 'Loan repayment posted');
    return toLoanDetail(updated, ageArrears(toAgeable(updated.schedule), today, currency));
  }

  /** Where the loan stands right now, with interest brought up to `today`. */
  private positionAt(loan: LoanDoc, today: string): Position {
    const currency = loan.currency as CurrencyCode;
    const principal = fromMinorUnits(loan.outstandingPrincipalMinorUnits, currency);
    const elapsed = loan.lastAccrualOn ? Math.max(0, daysBetweenIso(loan.lastAccrualOn, today)) : 0;
    const interest = add(
      fromMinorUnits(loan.accruedInterestMinorUnits, currency),
      accrueInterest(principal, loan.rate, elapsed),
    );

    return {
      outstanding: {
        fees: fromMinorUnits(loan.feesOutstandingMinorUnits, currency),
        interest,
        principal,
      },
      remainingScheduledInterest: sum(
        loan.schedule
          .filter((instalment) => outstandingOn(instalment) > 0)
          .map((instalment) => fromMinorUnits(instalment.interestMinorUnits, currency)),
        currency,
      ),
    };
  }

  /** A settlement raises the early-repayment charge; an ordinary repayment does not. */
  private outstandingFor(
    loan: LoanDoc,
    today: string,
    kind: RepaymentRequest['kind'],
  ): OutstandingBalances {
    const { outstanding } = this.positionAt(loan, today);
    if (kind !== 'payoff') {
      return outstanding;
    }
    return {
      ...outstanding,
      fees: earlyRepaymentFee(
        outstanding.principal,
        outstanding.fees,
        getLoanProduct(loan.productCode).earlyRepaymentFeePercent,
      ),
    };
  }

  private plan(
    amount: Money,
    outstanding: OutstandingBalances,
    kind: RepaymentRequest['kind'],
  ): RepaymentAllocation {
    const total = totalOutstanding(outstanding);
    const allocation = allocateRepayment(amount, outstanding);

    if (allocation.unallocated.minorUnits > 0) {
      throw new ValidationError(
        `This is more than the ${format(total)} outstanding on the loan`,
        [{ path: 'amount', message: 'Exceeds the amount outstanding' }],
      );
    }
    if (kind === 'payoff' && isLessThan(amount, total)) {
      throw new ValidationError(`Settling this loan in full requires ${format(total)}`, [
        { path: 'amount', message: 'Below the payoff figure' },
      ]);
    }
    return allocation;
  }

  private async assertFunded(
    accountId: string,
    currency: CurrencyCode,
    amount: Money,
  ): Promise<void> {
    const balances = await this.accounts.balancesFor(accountId, currency);
    if (isGreaterThan(amount, balances.available)) {
      throw new InsufficientFundsError(accountId, amount, balances.available);
    }
  }

  /** The unit of work: one balanced posting plus the servicing state it justifies. */
  private async postRepayment(input: PostingInput): Promise<LoanDoc> {
    const { loan, allocation, session } = input;

    await this.ledger.postWithin(
      {
        type: 'loan_repayment',
        description: `Repayment of loan ${loan.reference}`,
        actor: { kind: 'customer', id: loan.customerId, label: input.source.number },
        lines: repaymentLines(input.source._id, allocation),
        reference: newReference('LNR'),
        sourceType: LOAN_SOURCE_TYPE,
        sourceId: loan._id,
      },
      session,
    );

    const patch = this.servicingPatch(input);
    await this.repository.loans.updateOne({ _id: loan._id }, { $set: patch }, { session });
    return { ...loan, ...patch };
  }

  private servicingPatch(input: PostingInput): Partial<LoanDoc> {
    const { loan, allocation, outstanding, today } = input;
    const now = this.clock.now();
    const principalLeft = loan.outstandingPrincipalMinorUnits - allocation.principal.minorUnits;
    const settled = principalLeft <= 0;

    const paid = applyPaymentToSchedule(loan.schedule, allocation.applied.minorUnits, now);
    const schedule = ageSchedule(settled ? markAllPaid(paid, now) : paid, today);
    const arrears = ageArrears(toAgeable(schedule), today, loan.currency as CurrencyCode);

    return {
      outstandingPrincipalMinorUnits: Math.max(0, principalLeft),
      accruedInterestMinorUnits: outstanding.interest.minorUnits - allocation.interest.minorUnits,
      feesOutstandingMinorUnits: outstanding.fees.minorUnits - allocation.fees.minorUnits,
      schedule,
      lastAccrualOn: today,
      status: statusAfter(settled, arrears !== null),
      settledAt: settled ? now : loan.settledAt,
      updatedAt: now,
    };
  }

  private requireLive(loan: LoanDoc): LoanDoc {
    if (!LIVE_LOAN_STATUSES.includes(loan.status)) {
      throw new ConflictError('This loan is not currently open for repayment', {
        status: loan.status,
      });
    }
    return loan;
  }
}

/** A repayment must be made in the loan's own currency, from an account held in it. */
function assertSameCurrency(
  accountCurrency: string,
  requestCurrency: string,
  loanCurrency: string,
): void {
  if (accountCurrency !== loanCurrency || requestCurrency !== loanCurrency) {
    throw new DomainError(
      'ACCOUNT_CURRENCY_MISMATCH',
      `This loan is repaid in ${loanCurrency}`,
      { context: { loanCurrency, accountCurrency, requestCurrency } },
    );
  }
}
