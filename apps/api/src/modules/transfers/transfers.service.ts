import type {
  CreateTransferRequest,
  CursorPage,
  TransferDetail,
  TransferQuery,
  TransferSummary,
} from '@icb/contracts';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { NotFoundError } from '../../common/errors/index.js';
import { buildCursorPage } from '../../common/pagination/cursor.js';
import { ClockService } from '../../simulation/clock/clock.service.js';
import { AccountsService } from '../accounts/accounts.service.js';
import { TransferNotCancellableError } from './domain/transfer-errors.js';
import { CANCELLABLE_STATUSES } from './domain/transfers.constants.js';
import { timelineEntry } from './infrastructure/transfer.factory.js';
import {
  toTransferDetail,
  toTransferSummary,
} from './infrastructure/transfer.mapper.js';
import { buildTransferFilter } from './infrastructure/transfer-query.js';
import { TransferDoc } from './infrastructure/transfer.schemas.js';
import { TransferOrchestrator } from './application/transfer-orchestrator.js';
import type { TransferStatus } from '@icb/contracts';

/**
 * The customer-facing surface of the transfers module.
 *
 * Creation delegates to the orchestrator's pipeline; reads and cancellation are exercised here.
 * A cancel is only ever a status transition — money that has already moved is recalled by a
 * reversal, which is a different flow with a different owner.
 */
@Injectable()
export class TransfersService {
  constructor(
    @InjectModel(TransferDoc.name) private readonly transfers: Model<TransferDoc>,
    private readonly orchestrator: TransferOrchestrator,
    private readonly accounts: AccountsService,
    private readonly clock: ClockService,
  ) {}

  async create(customerId: string, request: CreateTransferRequest): Promise<TransferDetail> {
    const doc = await this.orchestrator.initiate(customerId, request);
    return this.get(customerId, doc._id);
  }

  async list(customerId: string, query: TransferQuery): Promise<CursorPage<TransferSummary>> {
    const rows = await this.transfers
      .find(buildTransferFilter(customerId, query))
      .sort({ _id: 1 })
      .limit(query.limit + 1)
      .lean();

    const page = buildCursorPage(rows, query.limit, (row) => row._id);
    const labels = await this.accountLabels(page.items.map((row) => row.fromAccountId));
    return {
      ...page,
      items: page.items.map((row) =>
        toTransferSummary(row, labels.get(row.fromAccountId) ?? row.fromAccountId),
      ),
    };
  }

  async get(customerId: string, transferId: string): Promise<TransferDetail> {
    const row = await this.transfers.findOne({ _id: transferId, customerId }).lean();
    if (!row) {
      throw new NotFoundError('Transfer', transferId);
    }
    const labels = await this.accountLabels([row.fromAccountId]);
    return toTransferDetail(row, labels.get(row.fromAccountId) ?? row.fromAccountId);
  }

  /** Cancel-if-pending: only a transfer that has not started moving can be recalled. */
  async cancel(customerId: string, transferId: string, reason?: string): Promise<TransferDetail> {
    const row = await this.transfers.findOne({ _id: transferId, customerId }).lean();
    if (!row) {
      throw new NotFoundError('Transfer', transferId);
    }
    if (!CANCELLABLE_STATUSES.includes(row.status as TransferStatus)) {
      throw new TransferNotCancellableError(transferId, row.status as TransferStatus);
    }

    await this.transfers.updateOne(
      { _id: transferId, status: row.status },
      {
        $set: { status: 'cancelled' },
        $push: {
          timeline: timelineEntry(this.clock.now(), 'cancelled', reason ?? null),
        },
      },
    );
    return this.get(customerId, transferId);
  }

  /** Receipt labels for the source accounts on a page, loaded once per distinct account. */
  private async accountLabels(accountIds: string[]): Promise<Map<string, string>> {
    const labels = new Map<string, string>();
    for (const accountId of [...new Set(accountIds)]) {
      // A historical transfer outlives its account; a frozen or closed source must not
      // break the list, so an unloadable account falls back to its id as the label.
      const account = await this.accounts.loadSpendable(accountId).catch(() => null);
      labels.set(accountId, account?.nickname ?? account?.number ?? accountId);
    }
    return labels;
  }
}
