import {
  loanApplicationRequestSchema,
  loanQuoteRequestSchema,
  makeRepaymentRequestSchema,
  type Loan,
  type LoanApplication,
  type LoanApplicationRequest,
  type LoanDetail,
  type LoanProduct,
  type LoanQuote,
  type LoanQuoteRequest,
  type PayoffQuote,
} from '@icb/contracts';
import { Body, Controller, Get, Param, Post } from '@nestjs/common';

import { CurrentCustomer } from '../../common/decorators/current-user.decorator.js';
import { zodBody } from '../../common/pipes/zod-validation.pipe.js';
import { LoanApplicationsService } from './loan-applications.service.js';
import { LoanRepaymentService, type RepaymentRequest } from './loan-repayment.service.js';
import { LoansService } from './loans.service.js';

/**
 * The customer's lending API.
 *
 * Static segments are declared before `:loanId` so the intent is obvious to a reader, and every
 * handler derives ownership from the authenticated principal rather than from the path.
 */
@Controller('loans')
export class LoansController {
  constructor(
    private readonly loans: LoansService,
    private readonly applications: LoanApplicationsService,
    private readonly repayments: LoanRepaymentService,
  ) {}

  @Get()
  async list(@CurrentCustomer() customerId: string): Promise<{ items: Loan[] }> {
    return { items: await this.loans.listForCustomer(customerId) };
  }

  @Get('products')
  products(): { items: readonly LoanProduct[] } {
    return { items: this.loans.products() };
  }

  @Post('quote')
  async quote(
    @CurrentCustomer() customerId: string,
    @Body(zodBody(loanQuoteRequestSchema)) body: LoanQuoteRequest,
  ): Promise<LoanQuote> {
    return this.loans.quote(customerId, body);
  }

  @Get('applications')
  async listApplications(
    @CurrentCustomer() customerId: string,
  ): Promise<{ items: LoanApplication[] }> {
    return { items: await this.applications.listForCustomer(customerId) };
  }

  @Post('applications')
  async apply(
    @CurrentCustomer() customerId: string,
    @Body(zodBody(loanApplicationRequestSchema)) body: LoanApplicationRequest,
  ): Promise<LoanApplication> {
    return this.applications.create(customerId, body);
  }

  @Get('applications/:applicationId')
  async application(
    @CurrentCustomer() customerId: string,
    @Param('applicationId') applicationId: string,
  ): Promise<LoanApplication> {
    return this.applications.getForCustomer(applicationId, customerId);
  }

  @Post('applications/:applicationId/accept')
  async accept(
    @CurrentCustomer() customerId: string,
    @Param('applicationId') applicationId: string,
  ): Promise<LoanApplication> {
    return this.applications.accept(applicationId, customerId);
  }

  @Get(':loanId')
  async detail(
    @CurrentCustomer() customerId: string,
    @Param('loanId') loanId: string,
  ): Promise<LoanDetail> {
    return this.loans.getForCustomer(loanId, customerId);
  }

  @Get(':loanId/payoff-quote')
  async payoffQuote(
    @CurrentCustomer() customerId: string,
    @Param('loanId') loanId: string,
  ): Promise<PayoffQuote> {
    return this.repayments.payoffQuote(loanId, customerId);
  }

  @Post(':loanId/repayments')
  async repay(
    @CurrentCustomer() customerId: string,
    @Param('loanId') loanId: string,
    @Body(zodBody(makeRepaymentRequestSchema)) body: RepaymentRequest,
  ): Promise<LoanDetail> {
    return this.repayments.repay(loanId, customerId, body);
  }
}
