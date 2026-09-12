import { Injectable } from '@nestjs/common';

import { KycService } from '../../kyc/kyc.service.js';
import type { CustomerLimits, CustomerLimitsPort } from './customer-limits.port.js';

/**
 * Binds the pipeline's customer-limits port to the KYC tier ladder.
 *
 * The tiers were always published to the customer — the limits screen quotes them, and the
 * ladder claims an under-verified customer "physically cannot exceed their band". Nothing read
 * them: `KycService` had no consumer outside its own module, so the only ceilings that bit were
 * the per-rail ones. This is the wire that makes the published figure the enforced figure.
 */
@Injectable()
export class KycCustomerLimitsAdapter implements CustomerLimitsPort {
  constructor(private readonly kyc: KycService) {}

  async limitsFor(customerId: string): Promise<CustomerLimits> {
    const tier = await this.kyc.limitsForCustomer(customerId);
    return {
      label: tier.level.replace('_', ' '),
      singleTransferMinorUnits: tier.singleTransfer.minorUnits,
      dailyTransferMinorUnits: tier.dailyTransfer.minorUnits,
      monthlyTransferMinorUnits: tier.monthlyTransfer.minorUnits,
      internationalAllowed: tier.internationalAllowed,
    };
  }
}
