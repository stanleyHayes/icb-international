import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { LedgerModule } from '../ledger/ledger.module.js';
import { AccountsController } from './accounts.controller.js';
import { AccountsService } from './accounts.service.js';
import { AccountDoc, AccountSchema } from './infrastructure/account.schemas.js';

@Module({
  imports: [
    LedgerModule,
    MongooseModule.forFeature([{ name: AccountDoc.name, schema: AccountSchema }]),
  ],
  controllers: [AccountsController],
  providers: [AccountsService],
  exports: [AccountsService, MongooseModule],
})
export class AccountsModule {}
