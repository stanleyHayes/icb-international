import type { RailProfile } from '@icb/contracts';
import { toDecimalString } from '@icb/money';
import { Injectable } from '@nestjs/common';

import { INTERNAL_REJECT_CODES } from './rail-codes.js';
import {
  alphanumericField,
  pickFailureCode,
  sampleLatencyMs,
  shouldFail,
} from './rail-sampling.js';
import type { Rail, RailContext, RailResult, RailSubmission } from './rail.types.js';

/**
 * On-us book transfer.
 *
 * Both sides are ICB, so there is no network: the money never leaves the bank and settlement is
 * the posting itself. It is still modelled as a rail so that "where did this payment go?" has one
 * answer shape across every channel, and so an operator can make the core look slow or unhealthy
 * without special-casing internal payments.
 */
@Injectable()
export class InternalRail implements Rail {
  readonly rail = 'internal' as const;

  /** `on_us` is the same book transfer under the name the transfers contract uses. */
  readonly aliases = ['on_us'] as const;

  readonly defaultProfile: RailProfile = {
    rail: 'internal',
    enabled: true,
    minLatencyMs: 5,
    maxLatencyMs: 40,
    failureRate: 0,
    failureCodes: [...INTERNAL_REJECT_CODES],
    settlementDelayHours: 0,
    cutOffTime: null,
  };

  submit(submission: RailSubmission, context: RailContext): RailResult {
    const latencyMs = sampleLatencyMs(context.profile, context.random);

    if (shouldFail(context.profile, context.random)) {
      const failure = pickFailureCode(context.profile, INTERNAL_REJECT_CODES, context.random);
      return {
        accepted: false,
        rail: this.rail,
        code: failure.code,
        label: failure.label,
        latencyMs,
        payload: { channel: 'book', sourceId: submission.sourceId },
      };
    }

    return {
      accepted: true,
      rail: this.rail,
      railReference: `BOOK${alphanumericField(10, context.random)}`,
      // No network leg, so value is final the moment it is posted.
      settlesAt: context.submittedAt,
      latencyMs,
      payload: this.bookEntry(submission),
    };
  }

  private bookEntry(submission: RailSubmission): Record<string, string> {
    return {
      channel: 'book',
      debtorAccount: submission.debtorAccount,
      creditorAccount: submission.creditorAccount,
      amount: toDecimalString(submission.amount),
      currency: submission.amount.currency,
      narrative: submission.narrative,
    };
  }
}
