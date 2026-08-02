import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { AccountsModule } from '../accounts/accounts.module.js';
import { CustomerDoc, CustomerSchema } from '../customers/infrastructure/customer.schemas.js';
import { LedgerModule } from '../ledger/ledger.module.js';
import { DocumentArchiveService } from './document-archive.service.js';
import { DocumentsController } from './documents.controller.js';
import { DocumentsService } from './documents.service.js';
import { assetStoreProvider } from './infrastructure/asset-store.provider.js';
import {
  BankDocumentDoc,
  BankDocumentSchema,
  StatementDoc,
  StatementSchema,
} from './infrastructure/document.schemas.js';
import { CustomerProfileReader } from './infrastructure/customer-profile.reader.js';
import { StatementLedgerReader } from './infrastructure/statement-ledger.reader.js';
import { StatementsController } from './statements.controller.js';
import { StatementsService } from './statements.service.js';

/**
 * Statements and documents.
 *
 * `LedgerModule` is imported for the entry and balance models a statement is derived from, and
 * `AccountsModule` for ownership resolution. `customers` is registered read-only: the module
 * prints a name on a letterhead and reads nothing else about identity.
 *
 * The asset store is bound here rather than globally so that the only code able to put bytes in
 * front of a customer is the code that also mints the expiring link to reach them.
 */
@Module({
  imports: [
    LedgerModule,
    AccountsModule,
    MongooseModule.forFeature([
      { name: StatementDoc.name, schema: StatementSchema },
      { name: BankDocumentDoc.name, schema: BankDocumentSchema },
      { name: CustomerDoc.name, schema: CustomerSchema },
    ]),
  ],
  controllers: [StatementsController, DocumentsController],
  providers: [
    assetStoreProvider,
    CustomerProfileReader,
    DocumentArchiveService,
    DocumentsService,
    StatementLedgerReader,
    StatementsService,
  ],
  exports: [DocumentArchiveService, DocumentsService, StatementsService],
})
export class DocumentsModule {}
