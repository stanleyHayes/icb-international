import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { AccountsModule } from '../accounts/accounts.module.js';
import { LedgerModule } from '../ledger/ledger.module.js';
import { AutopayService } from './autopay.service.js';
import { BillPaymentsController } from './bill-payments.controller.js';
import { BillPaymentsService } from './bill-payments.service.js';
import { BillSettlementService } from './bill-settlement.service.js';
import { BillersController } from './billers.controller.js';
import { BillersService } from './billers.service.js';
import { BillsController } from './bills.controller.js';
import { BillsService } from './bills.service.js';
import { BillPaymentDoc, BillPaymentSchema } from './infrastructure/bill-payment.schemas.js';
import { BillerDoc, BillerSchema } from './infrastructure/biller.schemas.js';
import { LinkedBillDoc, LinkedBillSchema } from './infrastructure/bill.schemas.js';

/**
 * Bill pay.
 *
 * `AutopayService` is exported because the end-of-day pipeline drives it — the batch owns *when*
 * the sweep runs, this module owns *what* it does. The settlement service is deliberately not
 * exported: everything outside this module goes through the payment or autopay entry points, so
 * there is no way to post a bill debit without the biller conversation that follows it.
 */
@Module({
  imports: [
    LedgerModule,
    AccountsModule,
    MongooseModule.forFeature([
      { name: BillerDoc.name, schema: BillerSchema },
      { name: LinkedBillDoc.name, schema: LinkedBillSchema },
      { name: BillPaymentDoc.name, schema: BillPaymentSchema },
    ]),
  ],
  controllers: [BillersController, BillsController, BillPaymentsController],
  providers: [
    BillersService,
    BillsService,
    BillSettlementService,
    BillPaymentsService,
    AutopayService,
  ],
  exports: [BillersService, BillsService, BillPaymentsService, AutopayService],
})
export class BillingModule {}
