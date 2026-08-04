import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { AccountsModule } from '../accounts/accounts.module.js';
import { CustomerDoc, CustomerSchema } from '../customers/infrastructure/customer.schemas.js';
import { LedgerModule } from '../ledger/ledger.module.js';
import {
  LoanApplicationDoc,
  LoanApplicationSchema,
} from './infrastructure/loan-application.schemas.js';
import { LoanDoc, LoanSchema } from './infrastructure/loan.schemas.js';
import { LoansRepository } from './infrastructure/loans.repository.js';
import { LoanApplicationsService } from './loan-applications.service.js';
import { LoanDisbursementService } from './loan-disbursement.service.js';
import { LoanDocumentsService } from './loan-documents.service.js';
import { LoanRepaymentService } from './loan-repayment.service.js';
import { LoanUnderwritingService } from './loan-underwriting.service.js';
import { LoansAdminController } from './loans-admin.controller.js';
import { LoansController } from './loans.controller.js';
import { LoansService } from './loans.service.js';

/**
 * Lending.
 *
 * Depends on AccountsModule for ownership and funds checks, and on LedgerModule because nothing
 * in here writes a balance itself: a drawdown and a repayment are ledger postings first and
 * servicing updates second.
 */
@Module({
  imports: [
    AccountsModule,
    LedgerModule,
    MongooseModule.forFeature([
      { name: LoanApplicationDoc.name, schema: LoanApplicationSchema },
      { name: LoanDoc.name, schema: LoanSchema },
      { name: CustomerDoc.name, schema: CustomerSchema },
    ]),
  ],
  controllers: [LoansController, LoansAdminController],
  providers: [
    LoansRepository,
    LoansService,
    LoanApplicationsService,
    LoanUnderwritingService,
    LoanDisbursementService,
    LoanDocumentsService,
    LoanRepaymentService,
  ],
  exports: [LoansService, LoanApplicationsService, LoanRepaymentService],
})
export class LoansModule {}
