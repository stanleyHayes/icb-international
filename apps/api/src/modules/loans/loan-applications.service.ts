import type { LoanApplication, LoanApplicationRequest, LoanProduct } from '@icb/contracts';
import { Injectable, Logger } from '@nestjs/common';

import { ConflictError } from '../../common/errors/index.js';
import { newId, newReference } from '../../infrastructure/database/identifier.js';
import { TransactionManager } from '../../infrastructure/database/transaction.manager.js';
import { ClockService } from '../../simulation/clock/clock.service.js';
import { AccountsService } from '../accounts/accounts.service.js';
import { toProductMoney } from './domain/eligibility.js';
import { getLoanProduct } from './domain/loan-products.js';
import type { StaffLoanDecisionRequest } from './domain/staff-decision.request.js';
import { toLoanApplication } from './infrastructure/loan-application.mapper.js';
import type { LoanApplicationDoc } from './infrastructure/loan-application.schemas.js';
import { LoansRepository } from './infrastructure/loans.repository.js';
import { LoanDisbursementService } from './loan-disbursement.service.js';
import { LoanUnderwritingService, SCORECARD_ACTOR } from './loan-underwriting.service.js';

const DEFAULT_QUEUE_LIMIT = 50;

interface IntakeInput {
  readonly applicationId: string;
  readonly customerId: string;
  readonly request: LoanApplicationRequest;
  readonly product: LoanProduct;
  readonly now: Date;
}

function buildApplicationDocument(input: IntakeInput): LoanApplicationDoc {
  const { request, product, now } = input;
  return {
    _id: input.applicationId,
    reference: newReference('LNA'),
    customerId: input.customerId,
    productCode: product.code,
    productName: product.name,
    status: 'submitted',
    requestedMinorUnits: request.amount.minorUnits,
    currency: product.currency,
    termMonths: request.termMonths,
    frequency: request.frequency,
    purpose: request.purpose,
    purposeDetail: request.purposeDetail ?? null,
    disbursementAccountId: request.disbursementAccountId,
    repaymentAccountId: request.repaymentAccountId,
    declaredMonthlyIncomeMinorUnits: request.declaredMonthlyIncome.minorUnits,
    declaredMonthlyExpensesMinorUnits: request.declaredMonthlyExpenses.minorUnits,
    existingCommitmentsMinorUnits: request.existingCommitments.minorUnits,
    documents: [],
    decision: null,
    offer: null,
    loanId: null,
    submittedAt: now,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * The application journey, from intake to a signed offer.
 *
 * An out-of-band amount or term is *not* rejected here: it is scored and declined with a reason,
 * because "your request is £200 above the maximum" is a lending answer a customer can act on and
 * a 400 is not. Only a currency the product is not sold in is refused outright.
 */
@Injectable()
export class LoanApplicationsService {
  private readonly logger = new Logger(LoanApplicationsService.name);

  constructor(
    private readonly repository: LoansRepository,
    private readonly underwriting: LoanUnderwritingService,
    private readonly disbursement: LoanDisbursementService,
    private readonly accounts: AccountsService,
    private readonly transactionManager: TransactionManager,
    private readonly clock: ClockService,
  ) {}

  async create(customerId: string, request: LoanApplicationRequest): Promise<LoanApplication> {
    const product = getLoanProduct(request.productCode);
    toProductMoney(product, request.amount);
    await this.assertServicingAccounts(customerId, request);

    const applicationId = newId();
    const document = buildApplicationDocument({
      applicationId,
      customerId,
      request,
      product,
      now: this.clock.now(),
    });

    await this.repository.applications.create([document], { ordered: true });
    this.logger.log({ applicationId, productCode: product.code }, 'Loan application submitted');

    return toLoanApplication(await this.underwriting.assess(applicationId, SCORECARD_ACTOR));
  }

  async listForCustomer(customerId: string): Promise<LoanApplication[]> {
    const applications = await this.repository.listApplicationsForCustomer(customerId);
    return applications.map(toLoanApplication);
  }

  async getForCustomer(applicationId: string, customerId: string): Promise<LoanApplication> {
    // Ownership is enforced by the query, not by comparing ids after the fact.
    return toLoanApplication(await this.repository.requireApplication(applicationId, customerId));
  }

  /**
   * Accepting an offer books the loan immediately but does not advance a penny — drawdown is a
   * separate, authorised step.
   *
   * Booking the loan and marking the offer accepted commit together: an accepted offer with no
   * loan behind it, or a loan nobody agreed to, are both worse than a failed request.
   */
  async accept(applicationId: string, customerId: string): Promise<LoanApplication> {
    const application = await this.repository.requireApplication(applicationId, customerId);
    const offer = this.requireLiveOffer(application);
    const now = this.clock.now();
    const accepted = { ...offer, acceptedAt: now };

    const patch = await this.transactionManager.withTransaction(async (session) => {
      const loan = await this.disbursement.book({ ...application, offer: accepted }, session);
      const update = { offer: accepted, status: 'approved', loanId: loan._id, updatedAt: now };
      await this.repository.applications.updateOne(
        { _id: applicationId },
        { $set: update },
        { session },
      );
      return update;
    });

    this.logger.log({ applicationId, loanId: patch.loanId }, 'Loan offer accepted');
    return toLoanApplication({ ...application, ...patch });
  }

  /** The underwriting queue: applications the scorecard would not settle on its own. */
  async queue(limit: number = DEFAULT_QUEUE_LIMIT): Promise<LoanApplication[]> {
    const applications = await this.repository.listUnderwritingQueue(limit);
    return applications.map(toLoanApplication);
  }

  async decideByStaff(
    applicationId: string,
    decidedBy: string,
    request: StaffLoanDecisionRequest,
  ): Promise<LoanApplication> {
    const decided = await this.underwriting.override(applicationId, decidedBy, request);
    this.logger.log({ applicationId, outcome: request.outcome }, 'Loan decision recorded');
    return toLoanApplication(decided);
  }

  private requireLiveOffer(application: LoanApplicationDoc) {
    const offer = application.offer;
    if (!offer || application.status !== 'offered') {
      throw new ConflictError('There is no live offer on this application', {
        status: application.status,
      });
    }
    if (offer.acceptedAt) {
      throw new ConflictError('This offer has already been accepted');
    }
    if (offer.expiresAt.getTime() <= this.clock.epochMs()) {
      throw new ConflictError('This offer has expired', {
        expiredAt: offer.expiresAt.toISOString(),
      });
    }
    return offer;
  }

  /** Both servicing accounts must belong to the applicant and be usable today. */
  private async assertServicingAccounts(
    customerId: string,
    request: LoanApplicationRequest,
  ): Promise<void> {
    await this.accounts.loadSpendable(request.disbursementAccountId, customerId);
    if (request.repaymentAccountId !== request.disbursementAccountId) {
      await this.accounts.loadSpendable(request.repaymentAccountId, customerId);
    }
  }
}
