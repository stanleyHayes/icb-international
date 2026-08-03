import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { LedgerModule } from '../ledger/ledger.module.js';
import { AccountsController } from './accounts.controller.js';
import { AccountsService } from './accounts.service.js';
import { AdminAccountsController } from './admin-accounts.controller.js';
import { AccountClosureService } from './application/account-closure.service.js';
import { AccountHoldsService } from './application/account-holds.service.js';
import { AccountOpeningService } from './application/account-opening.service.js';
import { AccountProfileService } from './application/account-profile.service.js';
import { AccountStatusService } from './application/account-status.service.js';
import { BalanceHistoryService } from './application/balance-history.service.js';
import { AccountDoc, AccountSchema } from './infrastructure/account.schemas.js';

@Module({
  imports: [
    LedgerModule,
    MongooseModule.forFeature([{ name: AccountDoc.name, schema: AccountSchema }]),
  ],
  controllers: [AccountsController, AdminAccountsController],
  providers: [
    AccountsService,
    AccountOpeningService,
    AccountClosureService,
    AccountStatusService,
    AccountProfileService,
    AccountHoldsService,
    BalanceHistoryService,
  ],
  exports: [AccountsService, MongooseModule],
})
export class AccountsModule {}
