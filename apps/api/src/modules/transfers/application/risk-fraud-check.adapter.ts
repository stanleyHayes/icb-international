import { Injectable } from '@nestjs/common';

import { RiskService } from '../../risk/risk.service.js';
import type {
  FraudCheckInput,
  FraudCheckOutcome,
  FraudCheckPort,
} from './fraud-check.port.js';

/**
 * Binds the pipeline's fraud port to the risk module's scoring engine.
 *
 * Every transfer — even an obviously safe one — is assessed and recorded, because a rule nobody
 * measures on good traffic is a rule nobody dares tune. The orchestrator alone decides what a
 * decision means; this adapter only translates.
 */
@Injectable()
export class RiskFraudCheckAdapter implements FraudCheckPort {
  constructor(private readonly risk: RiskService) {}

  async check(input: FraudCheckInput): Promise<FraudCheckOutcome> {
    const assessment = await this.risk.assess({
      subjectType: 'transfer',
      subjectId: input.subjectId,
      customerId: input.customerId,
      amountMinorUnits: input.amountMinorUnits,
      currency: input.currency,
      signals: {
        beneficiaryId: input.beneficiaryId ?? null,
        countryCode: input.countryCode ?? null,
      },
    });
    return { decision: assessment.decision, assessmentId: assessment.id };
  }
}
