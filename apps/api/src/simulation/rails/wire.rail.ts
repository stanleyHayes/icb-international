import type { RailProfile } from '@icb/contracts';
import { toDecimalString } from '@icb/money';
import { Injectable } from '@nestjs/common';

import { WIRE_REJECT_CODES } from './rail-codes.js';
import {
  alphanumericField,
  numericField,
  pickFailureCode,
  sampleLatencyMs,
  shouldFail,
  wireDate,
} from './rail-sampling.js';
import type { Rail, RailContext, RailResult, RailSubmission } from './rail.types.js';

/** ICB's participant identifier on the wire network. */
const SENDER_ABA = '021000021';

/**
 * Same-day wire.
 *
 * A wire is final and irrevocable, which is why it is expensive and why the cut-off is the single
 * most important thing about it: an instruction accepted at 15:59 is money today, and one
 * accepted at 16:01 is money tomorrow. The customer must be told which before they confirm, so
 * the cut-off decision is made here and travels back on the result.
 */
@Injectable()
export class WireRail implements Rail {
  readonly rail = 'wire' as const;

  readonly defaultProfile: RailProfile = {
    rail: 'wire',
    enabled: true,
    minLatencyMs: 400,
    maxLatencyMs: 2_500,
    // Wires are pre-funded and manually checked, so rejects are rare but expensive.
    failureRate: 0.008,
    failureCodes: [...WIRE_REJECT_CODES],
    settlementDelayHours: 0,
    cutOffTime: '16:00',
  };

  submit(submission: RailSubmission, context: RailContext): RailResult {
    const latencyMs = sampleLatencyMs(context.profile, context.random);
    const imad = this.buildImad(context);

    if (shouldFail(context.profile, context.random)) {
      const failure = pickFailureCode(context.profile, WIRE_REJECT_CODES, context.random);
      return {
        accepted: false,
        rail: this.rail,
        code: failure.code,
        label: failure.label,
        latencyMs,
        payload: { imad, rejectCode: failure.code, rejectReason: failure.label },
      };
    }

    return {
      accepted: true,
      rail: this.rail,
      railReference: imad,
      settlesAt: context.settlesAt,
      latencyMs,
      payload: this.fundsTransfer(submission, imad, context),
    };
  }

  /** Input Message Accountability Data: sending day, sender, and a sequence within that day. */
  private buildImad(context: RailContext): string {
    return `${wireDate(context.submittedAt)}${SENDER_ABA.slice(0, 4)}${alphanumericField(8, context.random)}`;
  }

  private fundsTransfer(
    submission: RailSubmission,
    imad: string,
    context: RailContext,
  ): Record<string, string> {
    return {
      typeSubType: '1000',
      senderAba: SENDER_ABA,
      imad,
      businessFunctionCode: 'CTR',
      amount: toDecimalString(submission.amount),
      currency: submission.amount.currency,
      originator: `${submission.debtorName}/${submission.debtorAccount}`,
      beneficiary: `${submission.creditorName}/${submission.creditorAccount}`,
      originatorToBeneficiary: submission.narrative.slice(0, 140),
      // Past the cut-off the instruction is queued for the next banking day's opening window.
      valueDate: wireDate(context.settlesAt),
      cutOffApplied: String(context.pastCutOff),
      sequenceNumber: numericField(6, context.random),
    };
  }
}
