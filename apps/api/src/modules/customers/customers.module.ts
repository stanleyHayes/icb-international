import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { AccountsModule } from '../accounts/accounts.module.js';
import { LedgerModule } from '../ledger/ledger.module.js';
import { assetStoreProvider } from '../documents/infrastructure/asset-store.provider.js';
import { CustomerExportService } from './customer-export.service.js';
import { CustomerLifecycleService } from './customer-lifecycle.service.js';
import { CustomerNotesService } from './customer-notes.service.js';
import { CustomersAdminController } from './customers-admin.controller.js';
import { CustomersController } from './customers.controller.js';
import { CustomersService } from './customers.service.js';
import { AdminViewAssembler } from './infrastructure/admin-view.assembler.js';
import { ExportSourceReader } from './infrastructure/export-source.reader.js';
import { CustomerNoteDoc, CustomerNoteSchema } from './infrastructure/customer-note.schemas.js';
import {
  CustomerDoc,
  CustomerSchema,
  SessionDoc,
  SessionSchema,
  UserCredentialDoc,
  UserCredentialSchema,
} from './infrastructure/customer.schemas.js';

/**
 * Customers: identity, lifecycle, notes, and data export.
 *
 * `LedgerModule` and `AccountsModule` are imported for the read models the back-office view is
 * assembled from (balances are only ever read — N4). The asset store is bound with the same
 * provider the documents module uses, so the data export goes through the same Cloudinary/local
 * fallback and the same expiring-link rules as every other customer-facing document.
 *
 * `CustomerLifecycleService` is exported because it is the single writer of `customers.status`:
 * the simulation's dormancy sweep and any future risk-driven suspension must go through it.
 */
@Module({
  imports: [
    LedgerModule,
    AccountsModule,
    MongooseModule.forFeature([
      { name: CustomerDoc.name, schema: CustomerSchema },
      { name: CustomerNoteDoc.name, schema: CustomerNoteSchema },
      { name: UserCredentialDoc.name, schema: UserCredentialSchema },
      { name: SessionDoc.name, schema: SessionSchema },
    ]),
  ],
  controllers: [CustomersController, CustomersAdminController],
  providers: [
    assetStoreProvider,
    AdminViewAssembler,
    ExportSourceReader,
    CustomersService,
    CustomerLifecycleService,
    CustomerNotesService,
    CustomerExportService,
  ],
  exports: [CustomersService, CustomerLifecycleService, CustomerNotesService, MongooseModule],
})
export class CustomersModule {}
