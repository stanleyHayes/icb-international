import type { ConfigureAutopayRequest, LinkBillRequest, LinkedBill } from '@icb/contracts';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { ConflictError, NotFoundError } from '../../common/errors/index.js';
import { newId } from '../../infrastructure/database/identifier.js';
import { ClockService } from '../../simulation/clock/clock.service.js';
import { AccountsService } from '../accounts/accounts.service.js';
import { BillersService } from './billers.service.js';
import { assertAutopayViable, assertReferenceMatches } from './domain/bill-rules.js';
import { enquireBalance, type BalanceEnquiry } from './domain/simulated-biller.js';
import { toLinkedBill } from './infrastructure/bill.mapper.js';
import { LinkedBillDoc } from './infrastructure/bill.schemas.js';
import type { BillerDoc } from './infrastructure/biller.schemas.js';

/** A bill together with the biller it points at — the pair every money path needs. */
export interface OwnedBill {
  readonly bill: LinkedBillDoc;
  readonly biller: BillerDoc;
}

/**
 * Bills a customer has linked.
 *
 * Ownership is always expressed as part of the query (`{ _id, customerId }`) rather than checked
 * after a lookup, so there is no path where a bill is loaded first and authorised second.
 */
@Injectable()
export class BillsService {
  constructor(
    @InjectModel(LinkedBillDoc.name) private readonly bills: Model<LinkedBillDoc>,
    private readonly billers: BillersService,
    private readonly accounts: AccountsService,
    private readonly clock: ClockService,
  ) {}

  /**
   * Link a biller to a customer, fetching the opening balance in the same breath.
   *
   * The enquiry happens here rather than lazily on first read so that the bill is useful the
   * moment it appears — a linked bill showing no amount is a screen the customer has to come back
   * to, and coming back is when autopay gets set up wrong.
   */
  async link(customerId: string, request: LinkBillRequest): Promise<LinkedBill> {
    const biller = await this.billers.requireActive(request.billerId);
    assertReferenceMatches(biller, request.customerReference);
    await this.assertNotAlreadyLinked(customerId, biller._id, request.customerReference);

    const enquiry = enquireBalance(biller, request.customerReference, this.cycle());
    const [created] = await this.bills.create([this.newBill(customerId, biller, request, enquiry)], {
      ordered: true,
    });

    if (!created) {
      throw new ConflictError('The bill could not be linked');
    }
    return toLinkedBill(created, biller);
  }

  private async assertNotAlreadyLinked(
    customerId: string,
    billerId: string,
    customerReference: string,
  ): Promise<void> {
    const duplicate = await this.bills.exists({ customerId, billerId, customerReference });
    if (duplicate) {
      throw new ConflictError('This bill is already linked', { billerId });
    }
  }

  private newBill(
    customerId: string,
    biller: BillerDoc,
    request: LinkBillRequest,
    enquiry: BalanceEnquiry | null,
  ) {
    const now = this.clock.now();
    return {
      _id: newId(),
      customerId,
      billerId: biller._id,
      customerReference: request.customerReference,
      nickname: request.nickname ?? null,
      currency: biller.currency,
      outstandingMinorUnits: enquiry?.outstandingMinorUnits ?? null,
      dueOn: enquiry?.dueOn ?? null,
      enquiryCycle: enquiry?.cycle ?? null,
      enquiredAt: enquiry ? now : null,
      createdAt: now,
    };
  }

  async listForCustomer(customerId: string): Promise<LinkedBill[]> {
    const rows = await this.bills.find({ customerId }).sort({ createdAt: -1 }).lean();
    const billers = await this.billers.findByIds(rows.map((row) => row.billerId));

    const items: LinkedBill[] = [];
    for (const row of rows) {
      const biller = billers.get(row.billerId);
      if (biller) {
        items.push(toLinkedBill(await this.refreshEnquiry(row, biller), biller));
      }
    }
    return items;
  }

  async getForCustomer(billId: string, customerId: string): Promise<LinkedBill> {
    const bill = await this.requireBill(billId, customerId);
    const biller = await this.billers.get(bill.billerId);
    return toLinkedBill(await this.refreshEnquiry(bill, biller), biller);
  }

  /** The read a payment starts from: the biller must still be accepting money. */
  async loadOwned(billId: string, customerId: string): Promise<OwnedBill> {
    const bill = await this.requireBill(billId, customerId);
    const biller = await this.billers.requireActive(bill.billerId);
    return { bill: await this.refreshEnquiry(bill, biller), biller };
  }

  async unlink(billId: string, customerId: string): Promise<void> {
    const result = await this.bills.deleteOne({ _id: billId, customerId });
    if (result.deletedCount === 0) {
      throw new NotFoundError('Bill', billId);
    }
  }

  async configureAutopay(
    billId: string,
    customerId: string,
    request: ConfigureAutopayRequest,
  ): Promise<LinkedBill> {
    const bill = await this.requireBill(billId, customerId);
    const biller = await this.billers.requireActive(bill.billerId);
    assertAutopayViable(request, biller);
    // Proves the funding account is this customer's, and that it is usable at all.
    await this.accounts.loadSpendable(request.fromAccountId, customerId);

    const update = {
      autopayEnabled: request.enabled,
      autopayFromAccountId: request.fromAccountId,
      autopayStrategy: request.strategy,
      autopayFixedMinorUnits: request.fixedAmount?.minorUnits ?? null,
      autopayDaysBeforeDue: request.daysBeforeDue,
      autopayCapMinorUnits: request.capAmount?.minorUnits ?? null,
    };
    await this.bills.updateOne({ _id: billId, customerId }, { $set: update });

    return toLinkedBill({ ...bill, ...update }, biller);
  }

  /** Called once a payment has actually settled, never on the way in. */
  async recordPayment(bill: LinkedBillDoc, minorUnits: number, paidAt: Date): Promise<void> {
    const outstanding =
      bill.outstandingMinorUnits === null
        ? null
        : Math.max(0, bill.outstandingMinorUnits - minorUnits);

    await this.bills.updateOne(
      { _id: bill._id },
      { $set: { lastPaidAt: paidAt, lastPaidMinorUnits: minorUnits, outstandingMinorUnits: outstanding } },
    );
  }

  /**
   * Bills whose autopay rule could fire on or before `horizon`, each with a fresh enquiry.
   *
   * `daysBeforeDue` varies per bill, so the precise "is it due yet?" test is left to the caller;
   * this narrows the set to something small enough to walk.
   */
  async findDueAutopay(horizon: string): Promise<OwnedBill[]> {
    const rows = await this.bills
      .find({
        autopayEnabled: true,
        autopayFromAccountId: { $ne: null },
        dueOn: { $ne: null, $lte: horizon },
      })
      .lean();

    const billers = await this.billers.findByIds(rows.map((row) => row.billerId));
    const due: OwnedBill[] = [];
    for (const row of rows) {
      const biller = billers.get(row.billerId);
      if (biller?.active) {
        due.push({ bill: await this.refreshEnquiry(row, biller), biller });
      }
    }
    return due;
  }

  /** Stamps the due date autopay has now handled, so one due date is never paid twice. */
  async markAutopayRun(billId: string, dueOn: string): Promise<void> {
    await this.bills.updateOne({ _id: billId }, { $set: { autopayLastDueOn: dueOn } });
  }

  private async requireBill(billId: string, customerId: string): Promise<LinkedBillDoc> {
    const bill = await this.bills.findOne({ _id: billId, customerId }).lean();
    if (!bill) {
      throw new NotFoundError('Bill', billId);
    }
    return bill;
  }

  /**
   * Re-run the balance enquiry when the billing cycle has turned over.
   *
   * The simulated biller is deterministic for a given (biller, reference, cycle), so this is
   * idempotent — refreshing the screen twice shows the same figure — and it guarantees autopay
   * never acts on a balance from a month that has already been paid.
   */
  private async refreshEnquiry(bill: LinkedBillDoc, biller: BillerDoc): Promise<LinkedBillDoc> {
    const cycle = this.cycle();
    if (!biller.supportsBalanceEnquiry || bill.enquiryCycle === cycle) {
      return bill;
    }

    const enquiry = enquireBalance(biller, bill.customerReference, cycle);
    if (!enquiry) {
      return bill;
    }

    const update = {
      outstandingMinorUnits: enquiry.outstandingMinorUnits,
      dueOn: enquiry.dueOn,
      enquiryCycle: enquiry.cycle,
      enquiredAt: this.clock.now(),
    };
    await this.bills.updateOne({ _id: bill._id }, { $set: update });
    return { ...bill, ...update };
  }

  /** The `YYYY-MM` billing cycle the bank is currently in. */
  private cycle(): string {
    return this.clock.today().slice(0, 7);
  }
}
