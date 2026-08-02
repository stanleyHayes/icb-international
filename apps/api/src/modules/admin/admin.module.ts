import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { AccountsModule } from '../accounts/accounts.module.js';
import { CustomerDoc, CustomerSchema } from '../customers/infrastructure/customer.schemas.js';
import { LedgerModule } from '../ledger/ledger.module.js';
import { AdminController } from './admin.controller.js';
import { CustomerDirectoryController } from './customer-directory.controller.js';
import { CustomerDirectoryService } from './customer-directory.service.js';
import { AdminService } from './admin.service.js';

@Module({
  imports: [
    LedgerModule,
    AccountsModule,
    MongooseModule.forFeature([{ name: CustomerDoc.name, schema: CustomerSchema }]),
  ],
  controllers: [AdminController, CustomerDirectoryController],
  providers: [AdminService, CustomerDirectoryService],
})
export class AdminModule {}
