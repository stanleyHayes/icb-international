import type { RailProfile } from '@icb/contracts';
import { toDecimalString } from '@icb/money';
import { Injectable } from '@nestjs/common';

import type { RandomHelpers } from '../seed/random.js';
import { SWIFT_REJECT_CODES } from './rail-codes.js';
import {
  alphanumericField,
  pickFailureCode,
  sampleLatencyMs,
  shouldFail,
  wireDate,
} from './rail-sampling.js';
import type { Rail, RailContext, RailResult, RailSubmission } from './rail.types.js';

/** ICB's own BIC on the network. */
const SENDER_BIC = 'ICBKGHAC';

/** Correspondents ICB clears through. A cross-border payment hops one to three of these. */
const CORRESPONDENTS = [
  'DEUTDEFF',
  'CHASUS33',
  'BARCGB22',
  'CITIUS33',
  'BNPAFRPP',
  'HSBCHKHH',
] as const;

/**
 * Cross-border SWIFT payment.
 *
 * The defining property is that ICB does not reach the beneficiary — it reaches a correspondent,
 * which reaches another, and each hop can hold, charge, or reject. That is why the money takes
 * days, why the amount arriving is smaller than the amount sent, and why "where is my payment?"
 * is a real support workload. The hop chain is recorded so that question has an answer.
 */
@Injectable()
export class SwiftRail implements Rail {
  readonly rail = 'swift' as const;

  readonly defaultProfile: RailProfile = {
    rail: 'swift',
    enabled: true,
    minLatencyMs: 800,
    maxLatencyMs: 4_000,
    failureRate: 0.015,
    failureCodes: [...SWIFT_REJECT_CODES],
    settlementDelayHours: 48,
    cutOffTime: '15:30',
  };

  submit(submission: RailSubmission, context: RailContext): RailResult {
    const latencyMs = sampleLatencyMs(context.profile, context.random);
    const reference = `ICB${alphanumericField(13, context.random)}`;
    const hops = this.routeHops(context.random);

    if (shouldFail(context.profile, context.random)) {
      const failure = pickFailureCode(context.profile, SWIFT_REJECT_CODES, context.random);
      return {
        accepted: false,
        rail: this.rail,
        code: failure.code,
        label: failure.label,
        latencyMs,
        payload: {
          messageType: 'MT199',
          relatedReference: reference,
          rejectedBy: hops[0] ?? SENDER_BIC,
          reasonCode: failure.code,
          narrative: failure.label,
        },
      };
    }

    return {
      accepted: true,
      rail: this.rail,
      railReference: reference,
      settlesAt: context.settlesAt,
      latencyMs,
      payload: this.mt103(submission, reference, hops, context),
    };
  }

  /** One to three correspondents, drawn from the seeded stream so a replay routes identically. */
  private routeHops(random: RandomHelpers): string[] {
    const count = random.int(1, 3);
    const chain: string[] = [];
    for (let hop = 0; hop < count; hop += 1) {
      const candidate = random.pick(CORRESPONDENTS);
      if (!chain.includes(candidate)) {
        chain.push(candidate);
      }
    }
    return chain;
  }

  /** An MT103 single customer credit transfer, field for field. */
  private mt103(
    submission: RailSubmission,
    reference: string,
    hops: string[],
    context: RailContext,
  ): Record<string, string> {
    // SWIFT amounts use a comma as the decimal separator and never a thousands separator.
    const amount = toDecimalString(submission.amount).replace('.', ',');
    return {
      messageType: 'MT103',
      ':20:': reference,
      ':23B:': 'CRED',
      ':32A:': `${wireDate(context.settlesAt)}${submission.amount.currency}${amount}`,
      ':33B:': `${submission.amount.currency}${amount}`,
      ':50K:': `/${submission.debtorAccount}\n${submission.debtorName}`,
      ':52A:': SENDER_BIC,
      ':53A:': hops[0] ?? SENDER_BIC,
      ':57A:': hops[hops.length - 1] ?? SENDER_BIC,
      ':59:': `/${submission.creditorAccount}\n${submission.creditorName}`,
      ':70:': submission.narrative.slice(0, 140),
      ':71A:': 'SHA',
      correspondentChain: hops.join('>'),
    };
  }
}
