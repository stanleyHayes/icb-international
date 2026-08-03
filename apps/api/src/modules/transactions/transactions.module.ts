import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { AccountsModule } from '../accounts/accounts.module.js';
import { LedgerModule } from '../ledger/ledger.module.js';
import { TransactionAnalyticsService } from './analytics.service.js';
import { TransactionAnnotationsService } from './annotations.service.js';
import { TransactionExportsService } from './exports.service.js';
import {
  TransactionAnnotationDoc,
  TransactionAnnotationSchema,
} from './infrastructure/transaction-annotation.schemas.js';
import {
  TransactionExportDoc,
  TransactionExportSchema,
} from './infrastructure/transaction-export.schemas.js';
import { TransactionsController } from './transactions.controller.js';
import { TransactionsService } from './transactions.service.js';

/**
 * The customer-facing transaction view. Reads the ledger through LedgerModule's re-exported
 * models (entries are never written here — N4/N5) and owns the two collections of its own:
 * customer annotations and export requests.
 */
@Module({
  imports: [
    LedgerModule,
    AccountsModule,
    MongooseModule.forFeature([
      { name: TransactionAnnotationDoc.name, schema: TransactionAnnotationSchema },
      { name: TransactionExportDoc.name, schema: TransactionExportSchema },
    ]),
  ],
  controllers: [TransactionsController],
  providers: [
    TransactionsService,
    TransactionAnalyticsService,
    TransactionAnnotationsService,
    TransactionExportsService,
  ],
  exports: [TransactionsService, TransactionAnnotationsService],
})
export class TransactionsModule {}
