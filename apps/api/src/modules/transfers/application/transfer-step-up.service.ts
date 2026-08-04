import { Injectable } from '@nestjs/common';

import { StepUpRequiredError } from '../../../common/errors/index.js';
import { TokenService } from '../../auth/application/token.service.js';

/** The purpose a step-up token must have been minted for to confirm a high-value transfer. */
export const HIGH_VALUE_TRANSFER_PURPOSE = 'high_value_transfer';

/** What the controller lifts off the request so the pipeline can check a step-up proof. */
export interface StepUpProof {
  readonly userId: string;
  readonly token: string | undefined;
}

/**
 * Conditional step-up for transfer creation.
 *
 * `StepUpGuard` is metadata-driven, which fits routes that always need a fresh second factor.
 * A transfer needs one only when the confirmed terms cross the high-value threshold, and that
 * is known only after the quote is redeemed — so the check runs inside the pipeline, at the
 * point the terms are fixed. The proof rules are the guard's own: the token must verify,
 * belong to the caller, and have been minted for this purpose. Every failure — missing,
 * malformed, expired, someone else's, wrong purpose — is the same STEP_UP_REQUIRED, so the
 * header cannot be used to probe which tokens exist.
 */
@Injectable()
export class TransferStepUpService {
  constructor(private readonly tokens: TokenService) {}

  async assert(proof: StepUpProof | undefined): Promise<void> {
    if (!proof?.token) {
      throw new StepUpRequiredError(HIGH_VALUE_TRANSFER_PURPOSE);
    }

    try {
      const claims = await this.tokens.verifyStepUpToken(proof.token);
      if (claims.sub !== proof.userId || claims.purpose !== HIGH_VALUE_TRANSFER_PURPOSE) {
        throw new StepUpRequiredError(HIGH_VALUE_TRANSFER_PURPOSE);
      }
    } catch (error) {
      if (error instanceof StepUpRequiredError) {
        throw error;
      }
      throw new StepUpRequiredError(HIGH_VALUE_TRANSFER_PURPOSE);
    }
  }
}
