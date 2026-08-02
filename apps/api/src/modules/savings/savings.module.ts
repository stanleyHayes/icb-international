import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { AccountsModule } from '../accounts/accounts.module.js';
import { LedgerModule } from '../ledger/ledger.module.js';
import {
  SavingsContributionDoc,
  SavingsContributionSchema,
  SavingsGoalDoc,
  SavingsGoalSchema,
} from './infrastructure/savings-goal.schemas.js';
import {
  TermDepositDoc,
  TermDepositSchema,
} from './infrastructure/term-deposit.schemas.js';
import { SavingsContributionsService } from './savings-contributions.service.js';
import { SavingsGoalsController } from './savings-goals.controller.js';
import { SavingsGoalsService } from './savings-goals.service.js';
import { TermDepositBreakService } from './term-deposit-break.service.js';
import { TermDepositLifecycleService } from './term-deposit-lifecycle.service.js';
import { TermDepositPostingService } from './term-deposit-posting.service.js';
import { TermDepositsController } from './term-deposits.controller.js';
import { TermDepositsService } from './term-deposits.service.js';

/**
 * Savings and term deposits.
 *
 * Every service here moves money through LedgerService and nothing else — the module owns three
 * collections of *contracts and intentions*, never a balance. `SavingsContributionsService` is
 * exported so that card authorisations can sweep their round-ups, and the lifecycle service so
 * the simulation scheduler can accrue interest and mature deposits as the clock advances.
 */
@Module({
  imports: [
    LedgerModule,
    AccountsModule,
    MongooseModule.forFeature([
      { name: SavingsGoalDoc.name, schema: SavingsGoalSchema },
      { name: SavingsContributionDoc.name, schema: SavingsContributionSchema },
      { name: TermDepositDoc.name, schema: TermDepositSchema },
    ]),
  ],
  controllers: [SavingsGoalsController, TermDepositsController],
  providers: [
    SavingsContributionsService,
    SavingsGoalsService,
    TermDepositBreakService,
    TermDepositLifecycleService,
    TermDepositPostingService,
    TermDepositsService,
  ],
  exports: [
    SavingsContributionsService,
    SavingsGoalsService,
    TermDepositLifecycleService,
    TermDepositsService,
    MongooseModule,
  ],
})
export class SavingsModule {}
