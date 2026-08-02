import type { RailProfile } from '@icb/contracts';
import { Injectable } from '@nestjs/common';

import { CARD_APPROVED_CODE, CARD_DECLINE_CODES } from './rail-codes.js';
import {
  alphanumericField,
  numericField,
  pickFailureCode,
  sampleLatencyMs,
  shouldFail,
  wireDate,
  wireTime,
} from './rail-sampling.js';
import type { Rail, RailContext, RailResult, RailSubmission } from './rail.types.js';

/** Authorisation request / response message type indicators. */
const MTI_REQUEST = '0100';
const MTI_RESPONSE = '0110';
/** Default merchant category when the caller does not supply one: 5999, misc retail. */
const DEFAULT_MCC = '5999';

/**
 * Card scheme authorisation.
 *
 * A card authorisation is not a payment: it is the scheme asking "will you honour this?" and the
 * issuer answering in a single response code. The money moves days later at clearing. Modelling
 * it this way is what makes holds, expiries, partial captures and reversals behave the way a
 * cardholder actually experiences them.
 */
@Injectable()
export class CardNetworkRail implements Rail {
  readonly rail = 'card' as const;

  readonly defaultProfile: RailProfile = {
    rail: 'card',
    enabled: true,
    // Schemes hold issuers to a hard response deadline; anything slower is stand-in authorised.
    minLatencyMs: 30,
    maxLatencyMs: 350,
    failureRate: 0.06,
    failureCodes: [...CARD_DECLINE_CODES],
    // Presentment lands the next day; the hold covers the gap.
    settlementDelayHours: 24,
    cutOffTime: null,
  };

  submit(submission: RailSubmission, context: RailContext): RailResult {
    const latencyMs = sampleLatencyMs(context.profile, context.random);
    const header = this.messageHeader(submission, context);

    if (shouldFail(context.profile, context.random)) {
      const decline = pickFailureCode(context.profile, CARD_DECLINE_CODES, context.random);
      return {
        accepted: false,
        rail: this.rail,
        code: decline.code,
        label: decline.label,
        latencyMs,
        // A decline carries no DE38: there is no authorisation to quote.
        payload: { ...header, mti: MTI_RESPONSE, DE39: decline.code, responseText: decline.label },
      };
    }

    const authorisationCode = alphanumericField(6, context.random);
    return {
      accepted: true,
      rail: this.rail,
      railReference: authorisationCode,
      settlesAt: context.settlesAt,
      latencyMs,
      payload: {
        ...header,
        mti: MTI_RESPONSE,
        DE38: authorisationCode,
        DE39: CARD_APPROVED_CODE,
        responseText: 'Approved',
      },
    };
  }

  /** The ISO-8583 data elements an authorisation request and its response share. */
  private messageHeader(
    submission: RailSubmission,
    context: RailContext,
  ): Record<string, string> {
    const attributes = submission.attributes ?? {};
    return {
      requestMti: MTI_REQUEST,
      // DE4 is the transaction amount in minor units, zero-filled to twelve digits.
      DE4: String(submission.amount.minorUnits).padStart(12, '0'),
      DE7: `${wireDate(context.submittedAt).slice(2)}${wireTime(context.submittedAt)}`,
      DE11: numericField(6, context.random),
      DE18: attributes['mcc'] ?? DEFAULT_MCC,
      DE37: `${wireDate(context.submittedAt)}${numericField(6, context.random)}`,
      DE41: attributes['terminalId'] ?? numericField(8, context.random),
      DE43: submission.creditorName.slice(0, 40),
      DE49: submission.amount.currency,
      panToken: submission.debtorAccount,
    };
  }
}
