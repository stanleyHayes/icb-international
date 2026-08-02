import type { RailProfile } from '@icb/contracts';
import { Injectable } from '@nestjs/common';

import { ACH_RETURN_CODES } from './rail-codes.js';
import {
  numericField,
  pickFailureCode,
  sampleLatencyMs,
  shouldFail,
  wireDate,
} from './rail-sampling.js';
import type { Rail, RailContext, RailResult, RailSubmission } from './rail.types.js';

/** ICB's routing number inside a NACHA file. */
const ODFI_ROUTING = '021000021';
/** Prearranged Payment and Deposit — the SEC code consumer credits and debits carry. */
const STANDARD_ENTRY_CLASS = 'PPD';

/**
 * Automated Clearing House.
 *
 * ACH is a *batch* rail: an entry is accepted into a file, the file settles the next banking day,
 * and a return arrives days later as a separate event. That asymmetry is the whole character of
 * the rail — the customer sees "sent" long before anyone sees "paid" — so acceptance here means
 * only that the entry passed format and routing edits, never that the money arrived.
 */
@Injectable()
export class AchRail implements Rail {
  readonly rail = 'ach' as const;

  readonly defaultProfile: RailProfile = {
    rail: 'ach',
    enabled: true,
    minLatencyMs: 120,
    maxLatencyMs: 900,
    // Roughly one entry in fifty returns, which is the order of magnitude a retail bank sees.
    failureRate: 0.02,
    failureCodes: [...ACH_RETURN_CODES],
    settlementDelayHours: 24,
    cutOffTime: '21:00',
  };

  submit(submission: RailSubmission, context: RailContext): RailResult {
    const latencyMs = sampleLatencyMs(context.profile, context.random);
    const traceNumber = `${ODFI_ROUTING.slice(0, 8)}${numericField(7, context.random)}`;

    if (shouldFail(context.profile, context.random)) {
      const failure = pickFailureCode(context.profile, ACH_RETURN_CODES, context.random);
      return {
        accepted: false,
        rail: this.rail,
        code: failure.code,
        label: failure.label,
        latencyMs,
        payload: {
          returnCode: failure.code,
          returnReason: failure.label,
          traceNumber,
          // A return is dated the banking day the RDFI sends it back, not the original entry.
          effectiveEntryDate: wireDate(context.settlesAt),
        },
      };
    }

    return {
      accepted: true,
      rail: this.rail,
      railReference: traceNumber,
      settlesAt: context.settlesAt,
      latencyMs,
      payload: this.entryDetail(submission, traceNumber, context),
    };
  }

  /** The fields a NACHA entry detail record actually carries, minus the fixed-width padding. */
  private entryDetail(
    submission: RailSubmission,
    traceNumber: string,
    context: RailContext,
  ): Record<string, string> {
    return {
      recordType: '6',
      standardEntryClass: STANDARD_ENTRY_CLASS,
      transactionCode: '22',
      odfiRouting: ODFI_ROUTING,
      receivingAccount: submission.creditorAccount,
      // NACHA amounts are cents, right-justified and zero-filled to ten characters.
      amount: String(submission.amount.minorUnits).padStart(10, '0'),
      individualName: submission.creditorName.slice(0, 22),
      companyEntryDescription: submission.narrative.slice(0, 10),
      effectiveEntryDate: wireDate(context.settlesAt),
      traceNumber,
    };
  }
}
