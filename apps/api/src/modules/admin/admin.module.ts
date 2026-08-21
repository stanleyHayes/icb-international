import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { AccountsModule } from '../accounts/accounts.module.js';
import { CustomerDoc, CustomerSchema } from '../customers/infrastructure/customer.schemas.js';
import { IamModule } from '../iam/iam.module.js';
import { LedgerModule } from '../ledger/ledger.module.js';
import { AdminController } from './admin.controller.js';
import { CustomerDirectoryController } from './customer-directory.controller.js';
import { CustomerDirectoryService } from './customer-directory.service.js';
import { AdminService } from './admin.service.js';
import { ManualPostingDoc, ManualPostingSchema } from './infrastructure/manual-posting.schemas.js';
import { ManualPostingsService } from './manual-postings.service.js';
import { ManualPostingsSweeper } from './manual-postings.sweeper.js';
import { PostingsController } from './postings.controller.js';
import { SystemHealthController } from './system-health.controller.js';
import { SystemHealthService } from './system-health.service.js';

@Module({
  imports: [
    LedgerModule,
    AccountsModule,
    IamModule,
    MongooseModule.forFeature([
      { name: CustomerDoc.name, schema: CustomerSchema },
      { name: ManualPostingDoc.name, schema: ManualPostingSchema },
    ]),
  ],
  controllers: [
    AdminController,
    CustomerDirectoryController,
    SystemHealthController,
    PostingsController,
  ],
  providers: [
    AdminService,
    CustomerDirectoryService,
    SystemHealthService,
    ManualPostingsService,
    ManualPostingsSweeper,
  ],
})
export class AdminModule {}
