import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { DatabaseModule } from '../../infrastructure/database/database.module.js';
import { HoldService } from './hold.service.js';
import { LedgerIntegrityService } from './ledger-integrity.service.js';
import { LedgerService } from './ledger.service.js';
import {
  AccountBalanceDoc,
  AccountBalanceSchema,
  HoldDoc,
  HoldSchema,
  LedgerEntryDoc,
  LedgerEntrySchema,
  LedgerTransactionDoc,
  LedgerTransactionSchema,
} from './infrastructure/ledger.schemas.js';

/**
 * The ledger is exported wholesale because every product module needs to post. Nothing outside
 * this module may inject the Mongoose models directly — that restriction is what keeps the
 * "balances are derived, never assigned" invariant enforceable.
 */
@Module({
  imports: [
    DatabaseModule,
    MongooseModule.forFeature([
      { name: LedgerTransactionDoc.name, schema: LedgerTransactionSchema },
      { name: LedgerEntryDoc.name, schema: LedgerEntrySchema },
      { name: AccountBalanceDoc.name, schema: AccountBalanceSchema },
      { name: HoldDoc.name, schema: HoldSchema },
    ]),
  ],
  providers: [LedgerService, HoldService, LedgerIntegrityService],
  exports: [LedgerService, HoldService, LedgerIntegrityService, MongooseModule],
})
export class LedgerModule {}
