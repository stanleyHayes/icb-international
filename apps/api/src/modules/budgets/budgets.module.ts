import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { TransactionsModule } from '../transactions/transactions.module.js';
import { BudgetsController } from './budgets.controller.js';
import { BudgetsService } from './budgets.service.js';
import { BudgetDoc, BudgetSchema } from './infrastructure/budget.schemas.js';

/**
 * Category budgets. Owns the `budgets` collection — the limits — and reads actuals through
 * the transactions module's analytics, so budget spend and the insights screens can never
 * disagree about what a month contained.
 */
@Module({
  imports: [
    TransactionsModule,
    MongooseModule.forFeature([{ name: BudgetDoc.name, schema: BudgetSchema }]),
  ],
  controllers: [BudgetsController],
  providers: [BudgetsService],
})
export class BudgetsModule {}
