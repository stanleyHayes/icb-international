import type { ApprovalRequest, ManualPostingRequest } from '@icb/contracts';
import { format, fromMinorUnits, type CurrencyCode, type Money } from '@icb/money';
import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { NotFoundError } from '../../common/errors/index.js';
import { newId } from '../../infrastructure/database/identifier.js';
import { ClockService } from '../../simulation/clock/clock.service.js';
import { AccountDoc } from '../accounts/infrastructure/account.schemas.js';
import { ApprovalsService } from '../iam/approvals.service.js';
import { customerRef, glRef } from '../ledger/domain/account-ref.js';
import type { PostingCommand, PostingLine } from '../ledger/domain/posting.types.js';
import { LedgerService } from '../ledger/ledger.service.js';
import { ManualPostingDoc } from './infrastructure/manual-posting.schemas.js';
import {
  MANUAL_POSTING_ACTOR_LABEL,
  MANUAL_POSTING_SOURCE_TYPE,
} from './manual-postings.constants.js';

/**
 * Manual credits and debits, under maker-checker.
 *
 * This is the most dangerous write in the bank, so it is never executed on request:
 * `requestManualPosting` parks the arguments on a tracking document and raises an approval;
 * `executeApproved` — run by the sweep worker — posts the balanced pair through the ledger
 * only after a *different* operator has approved. The `awaiting_approval → posting` claim is
 * the idempotency guard: a retried sweep finds the row already claimed and skips it, and a
 * ledger failure releases the claim so the next sweep tries again.
 */
@Injectable()
export class ManualPostingsService {
  private readonly logger = new Logger(ManualPostingsService.name);

  constructor(
    @InjectModel(ManualPostingDoc.name) private readonly postings: Model<ManualPostingDoc>,
    @InjectModel(AccountDoc.name) private readonly accounts: Model<AccountDoc>,
    private readonly approvals: ApprovalsService,
    private readonly ledger: LedgerService,
    private readonly clock: ClockService,
  ) {}

  /**
   * Raise a manual posting for approval. Returns the ApprovalRequest, not a transaction —
   * no posting exists until a second operator decides.
   *
   * The tracking document is inserted after the approval so its `approvalId` is the real
   * approval id; the pre-generated tracking id is what the approval's subjectRef points at.
   */
  async requestManualPosting(
    request: ManualPostingRequest,
    requestedBy: string,
  ): Promise<ApprovalRequest> {
    const account = await this.accounts.findOne({ _id: request.accountId }).lean();
    if (!account) {
      throw new NotFoundError('Account', request.accountId);
    }

    const trackingId = newId();
    const approval = await this.approvals.requestApproval({
      kind: 'manual_posting',
      subjectRef: { type: MANUAL_POSTING_SOURCE_TYPE, id: trackingId },
      summary: summarize(request),
      payload: { ...request, valueDate: request.valueDate ?? null },
      amount: request.amount,
      requestedBy,
    });

    await this.postings.create({
      _id: trackingId,
      approvalId: approval.id,
      accountId: request.accountId,
      direction: request.direction,
      minorUnits: request.amount.minorUnits,
      currency: request.amount.currency,
      contraAccountCode: request.contraAccountCode,
      description: request.description,
      reason: request.reason,
      valueDate: request.valueDate ?? null,
      status: 'awaiting_approval',
      transactionId: null,
      requestedBy,
    });

    return approval;
  }

  /**
   * Post every approved manual posting not yet claimed. Returns the number posted.
   *
   * Each row is claimed atomically before the ledger write: the claim — not the ledger
   * result — is what a concurrent or retried sweep contends on, so one approval can never
   * become two transactions.
   */
  async executeApproved(): Promise<number> {
    const approved = await this.approvals.listInbox({
      status: 'approved',
      kind: 'manual_posting',
    });

    let posted = 0;
    for (const approval of approved) {
      if (await this.executeOne(approval)) {
        posted += 1;
      }
    }
    return posted;
  }

  /** Claim, post, mark — or release the claim and let the sweep retry on ledger failure. */
  private async executeOne(approval: ApprovalRequest): Promise<boolean> {
    const claimed = await this.postings.findOneAndUpdate(
      { approvalId: approval.id, status: 'awaiting_approval' },
      { $set: { status: 'posting', updatedAt: this.clock.now() } },
      { new: true },
    );
    if (!claimed) {
      return false;
    }

    try {
      const posted = await this.ledger.post(this.buildCommand(claimed, approval));
      await this.postings.updateOne(
        { _id: claimed._id },
        { $set: { status: 'posted', transactionId: posted.id, updatedAt: this.clock.now() } },
      );
      this.logger.log(
        { approvalId: approval.id, transactionId: posted.id },
        'Manual posting applied',
      );
      return true;
    } catch (error) {
      await this.postings.updateOne(
        { _id: claimed._id },
        { $set: { status: 'awaiting_approval', updatedAt: this.clock.now() } },
      );
      throw error;
    }
  }

  /**
   * The balanced pair: customer leg against its GL contra, mirrored by direction.
   * A credit direction credits the customer (the bank owes them more) and debits the GL
   * contra — where the money came from; a debit is the mirror image.
   */
  private buildCommand(doc: ManualPostingDoc, approval: ApprovalRequest): PostingCommand {
    const amount = fromMinorUnits(doc.minorUnits, doc.currency as CurrencyCode);
    const customer: PostingLine = {
      accountRef: customerRef(doc.accountId),
      direction: doc.direction,
      amount,
      narrative: doc.description,
    };
    // glRef fails fast on a code that is not in the chart of accounts.
    const contra: PostingLine = {
      accountRef: glRef(doc.contraAccountCode),
      direction: doc.direction === 'credit' ? 'debit' : 'credit',
      amount,
    };

    return {
      type: 'adjustment',
      description: doc.description,
      actor: { kind: 'staff', id: doc.requestedBy, label: MANUAL_POSTING_ACTOR_LABEL },
      lines: doc.direction === 'credit' ? [contra, customer] : [customer, contra],
      // exactOptionalPropertyTypes: omit the key rather than passing an explicit undefined.
      ...(doc.valueDate === null ? {} : { valueDate: doc.valueDate }),
      correlationId: approval.id,
      sourceType: MANUAL_POSTING_SOURCE_TYPE,
      sourceId: doc._id,
      metadata: { approvalId: approval.id, reason: doc.reason },
    };
  }
}

/** One human line for the approval inbox, e.g. "Manual credit of USD 1,234.56 on account 01J… (contra GL 4000)". */
function summarize(request: ManualPostingRequest): string {
  const amount: Money = fromMinorUnits(request.amount.minorUnits, request.amount.currency);
  return `Manual ${request.direction} of ${format(amount, { display: 'code' })} on account ${request.accountId} (contra GL ${request.contraAccountCode})`;
}
