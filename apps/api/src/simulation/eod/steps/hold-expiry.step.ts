import { Injectable, Logger } from '@nestjs/common';

import { HoldService } from '../../../modules/ledger/hold.service.js';
import type { EodContext } from '../eod.context.js';

/**
 * Step 1 — expire holds.
 *
 * First, always. Every later step reads available balances, and an authorisation that was never
 * captured is still pinning money it has no claim to. Accruing interest or taking a fee against a
 * balance that is wrong by a stale hold produces a figure that has to be reversed tomorrow.
 *
 * Idempotent by construction: a hold can only be released once, so a second run finds nothing due.
 */
@Injectable()
export class HoldExpiryStep {
  private readonly logger = new Logger(HoldExpiryStep.name);

  constructor(private readonly holds: HoldService) {}

  async run(context: EodContext): Promise<number> {
    const expired = await this.holds.expireDue();
    if (expired > 0) {
      this.logger.log({ businessDate: context.businessDate, expired }, 'Holds expired');
    }
    return expired;
  }
}
