import type { LoanDecision, LoanProduct, RepaymentFrequency } from '@icb/contracts';
import { fromMinorUnits, type CurrencyCode, type Money } from '@icb/money';
import { Injectable, Logger } from '@nestjs/common';

import { ConflictError } from '../../common/errors/index.js';
import { ClockService } from '../../simulation/clock/clock.service.js';
import { toMoneyDto } from '../accounts/infrastructure/account.mapper.js';
import { levelInstalment } from './domain/amortisation.js';
import { decide } from './domain/decision.js';
import { getLoanProduct } from './domain/loan-products.js';
import {
  affordablePrincipal,
  indicativeRate,
  maximumMonthlyInstalment,
  monthlyEquivalent,
  scoredRate,
} from './domain/pricing.js';
import { score, type ScorecardInput, type ScorecardResult } from './domain/scorecard.js';
import type { StaffLoanDecisionRequest } from './domain/staff-decision.request.js';
import type {
  LoanApplicationDoc,
  StoredOffer,
} from './infrastructure/loan-application.schemas.js';
import { LoansRepository, type CustomerProfile } from './infrastructure/loans.repository.js';

/** How long an approved offer stands before the customer has to re-apply. */
const OFFER_TTL_MS = 30 * 86_400_000;

/** The application status each outcome puts the file into. */
const STATUS_BY_OUTCOME: Readonly<Record<LoanDecision['outcome'], string>> = {
  approved: 'offered',
  referred: 'under_review',
  declined: 'declined',
};

const DECIDABLE_STATUSES: readonly string[] = ['submitted', 'under_review', 'offered'];

export const SCORECARD_ACTOR = 'scorecard';

interface Evaluation {
  readonly product: LoanProduct;
  readonly principal: Money;
  readonly scorecard: ScorecardResult;
  readonly maximumAffordable: Money;
  readonly arrearsCount: number;
  readonly kycVerified: boolean;
}

function frequencyOf(application: LoanApplicationDoc): RepaymentFrequency {
  return application.frequency as RepaymentFrequency;
}

/** The declared figures, narrowed into `Money` once so nothing downstream handles raw integers. */
function amountsOf(application: LoanApplicationDoc) {
  const currency = application.currency as CurrencyCode;
  return {
    currency,
    principal: fromMinorUnits(application.requestedMinorUnits, currency),
    income: fromMinorUnits(application.declaredMonthlyIncomeMinorUnits, currency),
    expenses: fromMinorUnits(application.declaredMonthlyExpensesMinorUnits, currency),
    commitments: fromMinorUnits(application.existingCommitmentsMinorUnits, currency),
  };
}

function scorecardInput(
  application: LoanApplicationDoc,
  amounts: ReturnType<typeof amountsOf>,
  profile: CustomerProfile,
  instalment: Money,
  arrearsCount: number,
): ScorecardInput {
  return {
    monthlyIncome: amounts.income,
    monthlyExpenses: amounts.expenses,
    existingCommitments: amounts.commitments,
    requestedAmount: amounts.principal,
    instalment: monthlyEquivalent(instalment, frequencyOf(application)),
    termMonths: application.termMonths,
    tier: profile.tier,
    kycLevel: profile.kycLevel,
    arrearsCount,
  };
}

/** Replace the machine's answer with the underwriter's, keeping the score and factors intact. */
function applyOverride(
  machine: LoanDecision,
  request: StaffLoanDecisionRequest,
  evaluation: Evaluation,
): LoanDecision {
  const approved = request.outcome === 'approved';
  const fallback = toMoneyDto(evaluation.principal.minorUnits, evaluation.principal.currency);
  const amount = request.approvedAmount ?? machine.approvedAmount ?? fallback;
  const rate =
    request.approvedRate ?? machine.approvedRate ?? scoredRate(evaluation.product, machine.score);

  return {
    ...machine,
    outcome: request.outcome,
    approvedAmount: approved ? amount : null,
    approvedRate: approved ? rate : null,
    reasons: request.reasons?.length ? request.reasons : machine.reasons,
  };
}

/**
 * Underwriting.
 *
 * The scorecard runs the moment an application arrives, so a customer who plainly qualifies is
 * not made to wait for a human. An underwriter can override any answer, but the score, the bands
 * and the factor list that produced it are preserved alongside the override — the record shows
 * both what the model said and what the person decided.
 */
@Injectable()
export class LoanUnderwritingService {
  private readonly logger = new Logger(LoanUnderwritingService.name);

  constructor(
    private readonly repository: LoansRepository,
    private readonly clock: ClockService,
  ) {}

  /** Score an application and record the decision the policy produces. */
  async assess(applicationId: string, decidedBy: string): Promise<LoanApplicationDoc> {
    const application = await this.repository.requireApplication(applicationId);
    const evaluation = await this.evaluate(application);
    const decision = this.machineDecision(application, evaluation, decidedBy);

    this.logger.log(
      { applicationId, outcome: decision.outcome, score: decision.score },
      'Loan application scored',
    );
    return this.record(application, decision);
  }

  /** An underwriter's decision, which supersedes the scorecard's. */
  async override(
    applicationId: string,
    decidedBy: string,
    request: StaffLoanDecisionRequest,
  ): Promise<LoanApplicationDoc> {
    const application = await this.repository.requireApplication(applicationId);
    if (!DECIDABLE_STATUSES.includes(application.status)) {
      throw new ConflictError('This application is no longer open to a decision', {
        status: application.status,
      });
    }

    const evaluation = await this.evaluate(application);
    const machine = this.machineDecision(application, evaluation, decidedBy);
    return this.record(application, applyOverride(machine, request, evaluation));
  }

  private async evaluate(application: LoanApplicationDoc): Promise<Evaluation> {
    const product = getLoanProduct(application.productCode);
    const amounts = amountsOf(application);
    const frequency = frequencyOf(application);

    const [profile, arrearsCount] = await Promise.all([
      this.repository.profile(application.customerId),
      this.repository.arrearsCount(application.customerId),
    ]);

    const annualRatePercent = indicativeRate(product, profile.tier);
    const instalment = levelInstalment({
      principal: amounts.principal,
      annualRatePercent,
      termMonths: application.termMonths,
      frequency,
    });

    return {
      product,
      principal: amounts.principal,
      scorecard: score(scorecardInput(application, amounts, profile, instalment, arrearsCount)),
      maximumAffordable: affordablePrincipal({
        maximumMonthlyInstalment: maximumMonthlyInstalment(amounts.income, amounts.commitments),
        annualRatePercent,
        termMonths: application.termMonths,
        frequency,
      }),
      arrearsCount,
      kycVerified: profile.kycVerified,
    };
  }

  private machineDecision(
    application: LoanApplicationDoc,
    evaluation: Evaluation,
    decidedBy: string,
  ): LoanDecision {
    return decide({
      scorecard: evaluation.scorecard,
      product: evaluation.product,
      requestedAmount: evaluation.principal,
      termMonths: application.termMonths,
      maximumAffordable: evaluation.maximumAffordable,
      arrearsCount: evaluation.arrearsCount,
      kycVerified: evaluation.kycVerified,
      decidedBy,
      decidedAt: this.clock.now(),
    });
  }

  private async record(
    application: LoanApplicationDoc,
    decision: LoanDecision,
  ): Promise<LoanApplicationDoc> {
    const updatedAt = this.clock.now();
    const offer = this.offerFor(application, decision, updatedAt);
    const status = STATUS_BY_OUTCOME[decision.outcome];

    await this.repository.applications.updateOne(
      { _id: application._id },
      { $set: { decision, offer, status, updatedAt } },
    );

    return { ...application, decision, offer, status, updatedAt };
  }

  /** An approval becomes a priced, dated offer; anything else clears whatever offer stood. */
  private offerFor(
    application: LoanApplicationDoc,
    decision: LoanDecision,
    now: Date,
  ): StoredOffer | null {
    const { approvedAmount, approvedRate } = decision;
    if (decision.outcome !== 'approved' || !approvedAmount || approvedRate === null) {
      return null;
    }

    const instalment = levelInstalment({
      principal: fromMinorUnits(approvedAmount.minorUnits, application.currency as CurrencyCode),
      annualRatePercent: approvedRate,
      termMonths: application.termMonths,
      frequency: frequencyOf(application),
    });

    return {
      amountMinorUnits: approvedAmount.minorUnits,
      rate: approvedRate,
      instalmentMinorUnits: instalment.minorUnits,
      expiresAt: new Date(now.getTime() + OFFER_TTL_MS),
      acceptedAt: null,
    };
  }
}
