import type {
  Loan,
  LoanArrears,
  LoanDetail,
  LoanProduct,
  LoanQuote,
  LoanQuoteRequest,
  RepaymentFrequency,
} from '@icb/contracts';
import { Injectable } from '@nestjs/common';
import type { CurrencyCode } from '@icb/money';

import { ClockService } from '../../simulation/clock/clock.service.js';
import { ageArrears } from './domain/arrears.js';
import { assertWithinBands, toProductMoney } from './domain/eligibility.js';
import { getLoanProduct, listLoanProducts } from './domain/loan-products.js';
import { indicativeRate } from './domain/pricing.js';
import { buildQuote } from './domain/quote-builder.js';
import { toAgeable, toLoan, toLoanDetail } from './infrastructure/loan.mapper.js';
import type { LoanDoc } from './infrastructure/loan.schemas.js';
import { LoansRepository } from './infrastructure/loans.repository.js';
import { ageSchedule } from './infrastructure/schedule.builder.js';

/**
 * Quotes and the customer's view of their borrowing.
 *
 * Reads never write. Instalment statuses and arrears are re-derived from the clock on the way out
 * rather than being refreshed by a batch job, so a loan tells the truth about how late it is the
 * moment the operator advances time — no overnight run required.
 */
@Injectable()
export class LoansService {
  constructor(
    private readonly repository: LoansRepository,
    private readonly clock: ClockService,
  ) {}

  products(): readonly LoanProduct[] {
    return listLoanProducts();
  }

  /**
   * An indicative quote. No bureau pull, no affordability assessment and no commitment — the
   * rate reflects the relationship only, which is exactly what `indicative: true` is telling the
   * customer.
   */
  async quote(customerId: string, request: LoanQuoteRequest): Promise<LoanQuote> {
    const product = getLoanProduct(request.productCode);
    const principal = toProductMoney(product, request.amount);
    assertWithinBands(product, principal, request.termMonths);

    const { tier } = await this.repository.profile(customerId);

    return buildQuote({
      product,
      principal,
      annualRatePercent: indicativeRate(product, tier),
      termMonths: request.termMonths,
      frequency: request.frequency,
      anchor: this.clock.now(),
      indicative: true,
    });
  }

  async listForCustomer(customerId: string): Promise<Loan[]> {
    const loans = await this.repository.listLoansForCustomer(customerId);
    return loans.map((loan) => {
      const aged = this.age(loan);
      return toLoan(aged, this.arrearsFor(aged));
    });
  }

  async getForCustomer(loanId: string, customerId: string): Promise<LoanDetail> {
    // Ownership is enforced by the query, not by comparing ids after the fact.
    const loan = this.age(await this.repository.requireLoan(loanId, customerId));
    return toLoanDetail(loan, this.arrearsFor(loan));
  }

  /** Read-side projection of the loan with its schedule statuses brought up to today. */
  age(loan: LoanDoc): LoanDoc {
    return { ...loan, schedule: ageSchedule(loan.schedule, this.clock.today()) };
  }

  arrearsFor(loan: LoanDoc): LoanArrears | null {
    return ageArrears(
      toAgeable(loan.schedule),
      this.clock.today(),
      loan.currency as CurrencyCode,
    );
  }

  /** The frequency a loan is serviced at, narrowed once so callers need not re-assert it. */
  static frequencyOf(loan: Pick<LoanDoc, 'frequency'>): RepaymentFrequency {
    return loan.frequency as RepaymentFrequency;
  }
}
