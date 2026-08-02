import { fromMinorUnits, type CurrencyCode } from '@icb/money';
import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { ClientSession, Model } from 'mongoose';

import { TransactionManager } from '../../../infrastructure/database/transaction.manager.js';
import { glRef } from '../../../modules/ledger/domain/account-ref.js';
import {
  GL_CASH,
  GL_PENDING_SETTLEMENT,
} from '../../../modules/ledger/domain/chart-of-accounts.js';
import { LedgerService } from '../../../modules/ledger/ledger.service.js';
import { TransferDoc } from '../../../modules/transfers/infrastructure/transfer.schemas.js';
import type { EodContext } from '../eod.context.js';

const IN_SETTLEMENT = 'in_settlement';

/**
 * Step 2 — settle due rails.
 *
 * An outbound transfer parks its value in pending settlement (GL 2100) the moment the customer
 * sends it: the money has left them but has not reached anyone. Settlement is the second half of
 * that story — the bank actually pays, so the liability clears and cash goes down.
 *
 * Idempotent because the transfer's own status is the guard, moved inside the same database
 * transaction as the posting. A transfer already `completed` is never selected again.
 */
@Injectable()
export class RailSettlementStep {
  private readonly logger = new Logger(RailSettlementStep.name);

  constructor(
    @InjectModel(TransferDoc.name) private readonly transfers: Model<TransferDoc>,
    private readonly ledger: LedgerService,
    private readonly transactionManager: TransactionManager,
  ) {}

  async run(context: EodContext): Promise<number> {
    const due = await this.transfers
      .find({ status: IN_SETTLEMENT, estimatedArrival: { $lte: context.asOf } })
      .sort({ estimatedArrival: 1, _id: 1 })
      .lean();

    let settled = 0;
    for (const transfer of due) {
      settled += await this.settleOne(transfer, context);
    }

    if (settled > 0) {
      this.logger.log({ businessDate: context.businessDate, settled }, 'Rail settlements posted');
    }
    return settled;
  }

  private async settleOne(transfer: TransferDoc, context: EodContext): Promise<number> {
    return this.transactionManager.withTransaction(async (session) => {
      const claimed = await this.claim(transfer._id, context, session);
      if (!claimed) {
        return 0;
      }
      await this.postSettlement(transfer, context, session);
      return 1;
    });
  }

  /**
   * Take the transfer first. The conditional update is the lock: if a concurrent run already
   * moved it out of `in_settlement`, `matchedCount` is zero and this run posts nothing.
   */
  private async claim(
    transferId: string,
    context: EodContext,
    session: ClientSession,
  ): Promise<boolean> {
    const result = await this.transfers.updateOne(
      { _id: transferId, status: IN_SETTLEMENT },
      { $set: { status: 'completed', completedAt: context.asOf } },
      { session },
    );
    return result.matchedCount > 0;
  }

  /** Pending settlement clears; cash leaves the bank. */
  private async postSettlement(
    transfer: TransferDoc,
    context: EodContext,
    session: ClientSession,
  ): Promise<void> {
    const amount = fromMinorUnits(transfer.creditMinorUnits, transfer.currency as CurrencyCode);
    const narrative = `Settlement of ${transfer.reference}`;

    await this.ledger.postWithin(
      {
        type: 'transfer_out',
        description: `${transfer.rail.toUpperCase()} settlement — ${transfer.reference}`,
        actor: { kind: 'system', id: null, label: 'end-of-day' },
        status: 'settled',
        sourceType: 'transfer',
        sourceId: transfer._id,
        valueDate: context.businessDate,
        lines: [
          { accountRef: glRef(GL_PENDING_SETTLEMENT), direction: 'debit', amount, narrative },
          { accountRef: glRef(GL_CASH), direction: 'credit', amount, narrative },
        ],
      },
      session,
    );

    if (transfer.transactionId) {
      await this.ledger.markSettled(transfer.transactionId, session);
    }
  }
}
