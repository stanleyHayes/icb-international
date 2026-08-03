import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { QueueModule } from '../../infrastructure/queue/queue.module.js';
import {
  FeeChargeDoc,
  FeeChargeSchema,
  InterestAccrualDoc,
  InterestAccrualSchema,
} from '../../simulation/eod/infrastructure/eod.schemas.js';
import { AccountsModule } from '../accounts/accounts.module.js';
import { LedgerModule } from '../ledger/ledger.module.js';
import { ACCRUALS_QUEUE } from './accruals.constants.js';
import { AccrualsProcessor } from './accruals.processor.js';
import { AccrualsService } from './accruals.service.js';
import { CapitalisationService } from './capitalisation.service.js';
import { FeeAssessmentService } from './fee-assessment.service.js';
import { FeeChargeService } from './fee-charge.service.js';
import { InterestAccrualService } from './interest-accrual.service.js';
import { OverdraftFeeService } from './overdraft-fee.service.js';
import { PeriodActivityService } from './period-activity.service.js';

/**
 * The interest & fees engine (BE-18).
 *
 * Owns the daily accrual, capitalisation, and fee assessment, all posting through the ledger
 * and all idempotent against the claim indexes on `interest_accruals` and `fee_charges`.
 *
 * The claim collections are registered with the exact schema objects the simulation module
 * already compiled: Mongoose returns the existing model for an identical schema, so this
 * shares the model — and, critically, the unique index the idempotency story stands on —
 * rather than defining a second one over the same collection.
 *
 * `AccrualsService` is exported for the end-of-day pipeline (SIM-05): `runDaily(date)` is
 * the manual trigger that closes a business date's interest and fees.
 */
@Module({
  imports: [
    LedgerModule,
    AccountsModule,
    QueueModule,
    BullModule.registerQueue({ name: ACCRUALS_QUEUE }),
    MongooseModule.forFeature([
      { name: InterestAccrualDoc.name, schema: InterestAccrualSchema },
      { name: FeeChargeDoc.name, schema: FeeChargeSchema },
    ]),
  ],
  providers: [
    InterestAccrualService,
    CapitalisationService,
    PeriodActivityService,
    FeeChargeService,
    OverdraftFeeService,
    FeeAssessmentService,
    AccrualsService,
    AccrualsProcessor,
  ],
  exports: [AccrualsService],
})
export class AccrualsModule {}
