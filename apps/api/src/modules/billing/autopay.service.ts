import { Injectable, Logger } from '@nestjs/common';

import { isDomainError } from '../../common/errors/index.js';
import { ClockService } from '../../simulation/clock/clock.service.js';
import { BillPaymentsService } from './bill-payments.service.js';
import { BillSettlementService } from './bill-settlement.service.js';
import { BillsService, type OwnedBill } from './bills.service.js';
import { autopayAmountFor, autopayTriggerDate } from './domain/bill-rules.js';
import type { PayBillCommand } from './domain/pay-bill.command.js';
import type { BillPaymentDoc } from './infrastructure/bill-payment.schemas.js';

/** How far ahead to look for autopay rules; `daysBeforeDue` is capped at 30 by the contract. */
const AUTOPAY_HORIZON_DAYS = 30;
const MS_PER_DAY = 86_400_000;

const AUTOPAY = 'autopay';

export interface BillingRunResult {
  readonly scheduledAttempted: number;
  readonly autopayAttempted: number;
  readonly paid: number;
  readonly failed: number;
  readonly skipped: number;
}

/**
 * Everything the bill-pay module owes the end-of-day pipeline.
 *
 * Two populations are swept, and they are genuinely different: a *scheduled* payment is a decision
 * the customer already made, with an amount they already chose, so it simply runs; an *autopay*
 * rule has to work out its amount on the night. Both funnel into the same settlement path, so a
 * bill paid by a rule and a bill paid by hand are indistinguishable on the ledger.
 *
 * Nothing here throws. One customer's frozen account must not stop the bank's batch, so failures
 * are counted and logged and the sweep continues.
 */
@Injectable()
export class AutopayService {
  private readonly logger = new Logger(AutopayService.name);

  constructor(
    private readonly bills: BillsService,
    private readonly payments: BillPaymentsService,
    private readonly settlement: BillSettlementService,
    private readonly clock: ClockService,
  ) {}

  async runDueAutopay(): Promise<BillingRunResult> {
    const scheduled = await this.runDueScheduled();
    const autopay = await this.runAutopayRules();

    const result: BillingRunResult = {
      scheduledAttempted: scheduled.attempted,
      autopayAttempted: autopay.attempted,
      paid: scheduled.paid + autopay.paid,
      failed: scheduled.failed + autopay.failed,
      skipped: autopay.skipped,
    };

    this.logger.log(result, 'Bill pay end-of-day sweep complete');
    return result;
  }

  /** Payments the customer scheduled for today or earlier. */
  private async runDueScheduled(): Promise<Tally> {
    const due = await this.payments.findDueScheduled(this.clock.now());
    const counts = emptyCounts();

    for (const payment of due) {
      counts[await this.runOneScheduled(payment)] += 1;
    }
    return { attempted: due.length, ...counts };
  }

  private async runOneScheduled(payment: BillPaymentDoc): Promise<Outcome> {
    let owned: OwnedBill;
    try {
      owned = await this.bills.loadOwned(payment.billId, payment.customerId);
    } catch (error: unknown) {
      // The bill was unlinked, or the biller was withdrawn, after the payment was scheduled.
      await this.payments.markFailed(payment._id, describe(error));
      return 'failed';
    }

    return this.attempt(
      {
        customerId: payment.customerId,
        bill: owned.bill,
        biller: owned.biller,
        fromAccountId: payment.fromAccountId ?? '',
        amountMinorUnits: payment.amountMinorUnits,
        initiatedBy: payment.initiatedBy === AUTOPAY ? AUTOPAY : 'customer',
        paymentId: payment._id,
      },
      payment._id,
    );
  }

  /** Autopay rules whose trigger date has arrived. */
  private async runAutopayRules(): Promise<Tally> {
    const today = this.clock.today();
    const horizon = this.clock.toIsoDate(
      new Date(this.clock.epochMs() + AUTOPAY_HORIZON_DAYS * MS_PER_DAY),
    );

    const candidates = await this.bills.findDueAutopay(horizon);
    const counts = emptyCounts();
    let attempted = 0;

    for (const owned of candidates) {
      const amount = this.amountDueNow(owned, today);
      if (amount === null) {
        counts.skipped += 1;
        continue;
      }

      attempted += 1;
      // Stamped before the attempt: a rule that fails for a real reason (no funds, frozen account)
      // must not be retried on a loop for the same due date.
      await this.bills.markAutopayRun(owned.bill._id, owned.bill.dueOn ?? today);
      counts[await this.attempt(this.commandFor(owned, amount), owned.bill._id)] += 1;
    }
    return { attempted, ...counts };
  }

  /** The amount to pay today, or null when this rule should not fire yet. */
  private amountDueNow(owned: OwnedBill, today: string): number | null {
    const { bill } = owned;
    if (!bill.dueOn || !bill.autopayFromAccountId || bill.autopayLastDueOn === bill.dueOn) {
      return null;
    }
    if (today < autopayTriggerDate(bill.dueOn, bill.autopayDaysBeforeDue)) {
      return null;
    }

    const amount = autopayAmountFor(
      bill.autopayStrategy,
      bill.outstandingMinorUnits,
      bill.autopayFixedMinorUnits,
      bill.autopayCapMinorUnits,
    );
    return amount > 0 ? amount : null;
  }

  private commandFor(owned: OwnedBill, amountMinorUnits: number): PayBillCommand {
    return {
      customerId: owned.bill.customerId,
      bill: owned.bill,
      biller: owned.biller,
      fromAccountId: owned.bill.autopayFromAccountId ?? '',
      amountMinorUnits,
      initiatedBy: AUTOPAY,
    };
  }

  /**
   * Run one payment and report how it went.
   *
   * A biller rejection is not an exception — settlement returns a failed record with the ledger
   * already reversed — so both shapes of failure are folded into one outcome here.
   */
  private async attempt(command: PayBillCommand, subject: string): Promise<Outcome> {
    try {
      const payment = await this.settlement.execute(command);
      return payment.failureReason ? 'failed' : 'paid';
    } catch (error: unknown) {
      if (command.paymentId) {
        await this.payments.markFailed(command.paymentId, describe(error));
      }
      this.logger.warn({ subject, reason: describe(error) }, 'Bill pay sweep item failed');
      return 'failed';
    }
  }
}

type Outcome = 'paid' | 'failed';

interface Counts {
  paid: number;
  failed: number;
  skipped: number;
}

interface Tally extends Counts {
  attempted: number;
}

function emptyCounts(): Counts {
  return { paid: 0, failed: 0, skipped: 0 };
}

/** Domain errors carry a customer-safe message; anything else must not leak its internals. */
function describe(error: unknown): string {
  return isDomainError(error) ? error.message : 'The payment could not be completed';
}
