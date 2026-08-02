import { Injectable } from '@nestjs/common';

import { AmlMonitoringStep } from './steps/aml-monitoring.step.js';
import { ArrearsAgeingStep } from './steps/arrears-ageing.step.js';
import { FeeAssessmentStep } from './steps/fee-assessment.step.js';
import { HoldExpiryStep } from './steps/hold-expiry.step.js';
import { InterestAccrualStep } from './steps/interest-accrual.step.js';
import { RailSettlementStep } from './steps/rail-settlement.step.js';
import { StatementGenerationStep } from './steps/statement-generation.step.js';

/**
 * The steps, grouped by what they do to the books.
 *
 * Grouping exists so the pipeline reads as two phases rather than as a seven-argument
 * constructor: first everything that moves value, then everything that records what the value
 * did. The order *within* each group is the order the day must close in, and it is expressed by
 * the call sequence in EndOfDayService rather than by an array, so that reading the pipeline
 * shows what each step returns.
 */

/** Steps that post to the ledger. Nothing here is safe to reorder. */
@Injectable()
export class ValueSteps {
  constructor(
    readonly holds: HoldExpiryStep,
    readonly settlement: RailSettlementStep,
    readonly interest: InterestAccrualStep,
    readonly fees: FeeAssessmentStep,
  ) {}
}

/** Steps that read the ledger and write records elsewhere. */
@Injectable()
export class RecordSteps {
  constructor(
    readonly arrears: ArrearsAgeingStep,
    readonly aml: AmlMonitoringStep,
    readonly statements: StatementGenerationStep,
  ) {}
}
