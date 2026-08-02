import type {
  BillPayment,
  CursorPage,
  PayBillRequest,
  billPaymentQuerySchema,
} from '@icb/contracts';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { ConflictError, NotFoundError, ValidationError } from '../../common/errors/index.js';
import { newId } from '../../infrastructure/database/identifier.js';
import { ClockService } from '../../simulation/clock/clock.service.js';
import { AccountsService } from '../accounts/accounts.service.js';
import { BillSettlementService } from './bill-settlement.service.js';
import { BillsService } from './bills.service.js';
import { assertPayable } from './domain/bill-rules.js';
import {
  PAYMENT_STATUS,
  feeFor,
  paymentInsertDefaults,
  type PayBillCommand,
} from './domain/pay-bill.command.js';
import { toBillPayment } from './infrastructure/bill.mapper.js';
import { BillPaymentDoc } from './infrastructure/bill-payment.schemas.js';

type BillPaymentQuery = ReturnType<typeof billPaymentQuerySchema.parse>;

/**
 * Customer-facing bill payments.
 *
 * Two things happen here and nowhere else: turning a request into a `PayBillCommand` (which is
 * where ownership and biller rules are settled), and the scheduling decision. Everything that
 * touches the ledger is delegated to BillSettlementService, so this file never has to be trusted
 * with money.
 */
@Injectable()
export class BillPaymentsService {
  constructor(
    @InjectModel(BillPaymentDoc.name) private readonly payments: Model<BillPaymentDoc>,
    private readonly bills: BillsService,
    private readonly settlement: BillSettlementService,
    private readonly accounts: AccountsService,
    private readonly clock: ClockService,
  ) {}

  async pay(customerId: string, billId: string, request: PayBillRequest): Promise<BillPayment> {
    if (request.billId !== billId) {
      throw new ValidationError('The bill in the body does not match the bill being paid', [
        { path: 'billId', message: `Expected ${billId}` },
      ]);
    }

    const { bill, biller } = await this.bills.loadOwned(billId, customerId);
    assertPayable(biller, request.amount);

    const command: PayBillCommand = {
      customerId,
      bill,
      biller,
      fromAccountId: request.fromAccountId,
      amountMinorUnits: request.amount.minorUnits,
      initiatedBy: 'customer',
    };

    if (request.scheduledFor && this.isFutureDate(request.scheduledFor)) {
      return toBillPayment(await this.schedule(command, request.scheduledFor));
    }
    return toBillPayment(await this.settlement.execute(command));
  }

  /**
   * A scheduled payment moves no money today.
   *
   * Nothing is posted and nothing is held: the account is only checked for existence and
   * usability, because affordability is a question about the day the payment actually runs, not
   * about today.
   */
  private async schedule(command: PayBillCommand, scheduledFor: string): Promise<BillPaymentDoc> {
    await this.accounts.loadSpendable(command.fromAccountId, command.customerId);
    const now = this.clock.now();
    const fee = feeFor(command.biller);

    const [created] = await this.payments.create(
      [
        {
          ...paymentInsertDefaults(command, {
            now,
            valueDate: scheduledFor,
            scheduledFor: new Date(`${scheduledFor}T00:00:00.000Z`),
          }),
          _id: newId(),
          status: PAYMENT_STATUS.scheduled,
          fromAccountId: command.fromAccountId,
          amountMinorUnits: command.amountMinorUnits,
          feeMinorUnits: fee.minorUnits,
          transactionId: null,
        },
      ],
      { ordered: true },
    );

    if (!created) {
      throw new ConflictError('The bill payment could not be scheduled');
    }
    return created;
  }

  async list(customerId: string, query: BillPaymentQuery): Promise<CursorPage<BillPayment>> {
    const filter = buildFilter(customerId, query);
    // One extra row tells us whether another page exists without a second count query.
    const rows = await this.payments.find(filter).sort({ _id: -1 }).limit(query.limit + 1).lean();

    const hasMore = rows.length > query.limit;
    const page = hasMore ? rows.slice(0, query.limit) : rows;

    return {
      items: page.map(toBillPayment),
      nextCursor: hasMore ? (page[page.length - 1]?._id ?? null) : null,
      hasMore,
    };
  }

  async getForCustomer(paymentId: string, customerId: string): Promise<BillPayment> {
    return toBillPayment(await this.requirePayment(paymentId, customerId));
  }

  /**
   * Only a payment that has not moved money can be cancelled.
   *
   * A completed payment is with the biller and has to be disputed, not cancelled; a failed one has
   * already been reversed. Saying so plainly is more useful than a generic 409.
   */
  async cancel(paymentId: string, customerId: string): Promise<BillPayment> {
    const payment = await this.requirePayment(paymentId, customerId);

    if (payment.status !== PAYMENT_STATUS.scheduled) {
      throw new ConflictError('Only a scheduled bill payment can be cancelled', {
        paymentId,
        status: payment.status,
      });
    }

    const update = { status: PAYMENT_STATUS.cancelled };
    await this.payments.updateOne({ _id: paymentId, customerId }, { $set: update });
    return toBillPayment({ ...payment, ...update });
  }

  /**
   * Record an attempt that never reached the ledger at all.
   *
   * An autopay run that cannot fund itself has no payment record to update — the posting was
   * refused before one was written. Without this, the customer's history would show nothing at
   * all on the night their rent quietly failed to go out.
   */
  async recordFailedAttempt(command: PayBillCommand, reason: string): Promise<void> {
    const now = this.clock.now();
    await this.payments.create(
      [
        {
          ...paymentInsertDefaults(command, {
            now,
            valueDate: this.clock.toIsoDate(now),
            scheduledFor: null,
          }),
          _id: newId(),
          status: PAYMENT_STATUS.failed,
          failureReason: reason,
          fromAccountId: command.fromAccountId,
          amountMinorUnits: command.amountMinorUnits,
          feeMinorUnits: feeFor(command.biller).minorUnits,
          transactionId: null,
        },
      ],
      { ordered: true },
    );
  }

  /**
   * Fail a payment that never reached the ledger.
   *
   * Scoped to `scheduled` on purpose: a payment already in `processing` has a posting behind it,
   * and quietly relabelling it would hide a debit that is still outstanding.
   */
  async markFailed(paymentId: string, reason: string): Promise<void> {
    await this.payments.updateOne(
      { _id: paymentId, status: PAYMENT_STATUS.scheduled },
      { $set: { status: PAYMENT_STATUS.failed, failureReason: reason } },
    );
  }

  /** Scheduled payments whose date has arrived. Driven by the end-of-day pipeline. */
  async findDueScheduled(asOf: Date): Promise<BillPaymentDoc[]> {
    return this.payments
      .find({ status: PAYMENT_STATUS.scheduled, scheduledFor: { $lte: asOf } })
      .sort({ scheduledFor: 1 })
      .lean();
  }

  /**
   * ISO dates compare correctly as strings, which is the whole reason the business date is held
   * as one. A date of today or earlier is not a schedule — the customer meant "now".
   */
  private isFutureDate(scheduledFor: string): boolean {
    return scheduledFor > this.clock.today();
  }

  private async requirePayment(paymentId: string, customerId: string): Promise<BillPaymentDoc> {
    const payment = await this.payments.findOne({ _id: paymentId, customerId }).lean();
    if (!payment) {
      throw new NotFoundError('Bill payment', paymentId);
    }
    return payment;
  }
}

/** One clause per supported query parameter. Undefined means "not filtering on this". */
function buildFilter(customerId: string, query: BillPaymentQuery): Record<string, unknown> {
  const filter: Record<string, unknown> = { customerId };

  if (query.cursor) {
    filter['_id'] = { $lt: query.cursor };
  }
  if (query.billId) {
    filter['billId'] = query.billId;
  }
  if (query.status?.length) {
    filter['status'] = { $in: query.status };
  }
  if (query.from || query.to) {
    filter['valueDate'] = {
      ...(query.from ? { $gte: query.from } : {}),
      ...(query.to ? { $lte: query.to } : {}),
    };
  }

  return filter;
}
