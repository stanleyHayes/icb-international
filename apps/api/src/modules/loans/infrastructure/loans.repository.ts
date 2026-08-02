import type { CustomerTier, KycLevel } from '@icb/contracts';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { ClientSession, Model } from 'mongoose';

import { NotFoundError } from '../../../common/errors/index.js';
import { CustomerDoc } from '../../customers/infrastructure/customer.schemas.js';
import { LoanApplicationDoc } from './loan-application.schemas.js';
import { LoanDoc } from './loan.schemas.js';

/**
 * Every read this module performs.
 *
 * Ownership is expressed as part of the *query* rather than checked after the fact: a customer id
 * narrows the filter, so a customer cannot load another customer's application even momentarily.
 * Staff callers pass no customer id, which reads as the deliberate widening it is.
 */

export interface CustomerProfile {
  readonly tier: CustomerTier;
  readonly kycLevel: KycLevel | null;
  readonly kycVerified: boolean;
}

const DEFAULT_TIER: CustomerTier = 'standard';

/** Statuses a loan can be in while money is still owed. */
export const LIVE_LOAN_STATUSES = ['active', 'in_arrears'] as const;

@Injectable()
export class LoansRepository {
  constructor(
    @InjectModel(LoanApplicationDoc.name)
    readonly applications: Model<LoanApplicationDoc>,
    @InjectModel(LoanDoc.name) readonly loans: Model<LoanDoc>,
    @InjectModel(CustomerDoc.name) private readonly customers: Model<CustomerDoc>,
  ) {}

  async requireApplication(
    applicationId: string,
    customerId?: string,
  ): Promise<LoanApplicationDoc> {
    const filter = customerId ? { _id: applicationId, customerId } : { _id: applicationId };
    const application = await this.applications.findOne(filter).lean();
    if (!application) {
      throw new NotFoundError('Loan application', applicationId);
    }
    return application;
  }

  async requireLoan(loanId: string, customerId?: string): Promise<LoanDoc> {
    const filter = customerId ? { _id: loanId, customerId } : { _id: loanId };
    const loan = await this.loans.findOne(filter).lean();
    if (!loan) {
      throw new NotFoundError('Loan', loanId);
    }
    return loan;
  }

  /** Re-read inside a transaction, so servicing decisions are made on committed state. */
  async requireLoanInSession(loanId: string, session: ClientSession): Promise<LoanDoc> {
    const loan = await this.loans.findById(loanId).session(session).lean();
    if (!loan) {
      throw new NotFoundError('Loan', loanId);
    }
    return loan;
  }

  async listLoansForCustomer(customerId: string): Promise<LoanDoc[]> {
    return this.loans.find({ customerId }).sort({ createdAt: -1 }).lean();
  }

  async listApplicationsForCustomer(customerId: string): Promise<LoanApplicationDoc[]> {
    return this.applications.find({ customerId }).sort({ createdAt: -1 }).lean();
  }

  /** The underwriting queue: everything waiting on a human, oldest submission first. */
  async listUnderwritingQueue(limit: number): Promise<LoanApplicationDoc[]> {
    return this.applications
      .find({ status: { $in: ['submitted', 'under_review'] } })
      .sort({ submittedAt: 1 })
      .limit(limit)
      .lean();
  }

  /** How many of this customer's existing loans are behind. Feeds the scorecard. */
  async arrearsCount(customerId: string): Promise<number> {
    return this.loans.countDocuments({ customerId, status: 'in_arrears' });
  }

  /**
   * The relationship facts underwriting is allowed to price on. A customer record that has
   * vanished is treated as an unverified standard relationship rather than crashing a decision.
   */
  async profile(customerId: string): Promise<CustomerProfile> {
    const customer = await this.customers.findById(customerId).lean();
    const kycLevel = (customer?.kycLevel ?? null) as KycLevel | null;
    return {
      tier: (customer?.tier ?? DEFAULT_TIER) as CustomerTier,
      kycLevel,
      kycVerified: customer?.kycStatus === 'approved' && kycLevel !== null,
    };
  }
}
