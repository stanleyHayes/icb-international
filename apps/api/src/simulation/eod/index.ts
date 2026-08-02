import type { Provider } from '@nestjs/common';

import { EndOfDayService } from './end-of-day.service.js';
import { RecordSteps, ValueSteps } from './eod.steps.js';
import { EodReportStore } from './infrastructure/eod-report.store.js';
import { ExternalCollections } from './infrastructure/external-collections.js';
import { AmlMonitoringStep } from './steps/aml-monitoring.step.js';
import { ArrearsAgeingStep } from './steps/arrears-ageing.step.js';
import { FeeAssessmentStep } from './steps/fee-assessment.step.js';
import { HoldExpiryStep } from './steps/hold-expiry.step.js';
import { InterestAccrualStep } from './steps/interest-accrual.step.js';
import { RailSettlementStep } from './steps/rail-settlement.step.js';
import { StatementGenerationStep } from './steps/statement-generation.step.js';

export { EndOfDayService, type EndOfDayOutcome } from './end-of-day.service.js';
export { CurrencyTotals, type EodContext } from './eod.context.js';

/** Everything the end-of-day batch contributes to the simulation module. */
export const EOD_PROVIDERS: Provider[] = [
  ExternalCollections,
  EodReportStore,
  HoldExpiryStep,
  RailSettlementStep,
  InterestAccrualStep,
  FeeAssessmentStep,
  ArrearsAgeingStep,
  AmlMonitoringStep,
  StatementGenerationStep,
  ValueSteps,
  RecordSteps,
  EndOfDayService,
];
