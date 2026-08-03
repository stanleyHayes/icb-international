import {
  exportTransactionsRequestSchema,
  type AccountDetail,
  type DownloadLink,
} from '@icb/contracts';
import type { z } from 'zod';
import type { CurrencyCode } from '@icb/money';
import { Inject, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { ForbiddenError, NotFoundError } from '../../common/errors/index.js';
import { CONFIG, type AppConfiguration } from '../../config/configuration.js';
import { newId } from '../../infrastructure/database/identifier.js';
import { isDuplicateKeyError } from '../../infrastructure/database/mongo-errors.js';
import { ClockService } from '../../simulation/clock/clock.service.js';
import { AccountsService } from '../accounts/accounts.service.js';
import { customerRef } from '../ledger/domain/account-ref.js';
import { LedgerEntryDoc } from '../ledger/infrastructure/ledger.schemas.js';
import { TransactionAnnotationsService } from './annotations.service.js';
import { categoriseTransaction } from './domain/categoriser.js';
import { toCsv, toJsonDocument } from './domain/export-formatters.js';
import type { ExportLine } from './domain/export-lines.js';
import { toOfx } from './domain/export-ofx.js';
import { renderExportPdf } from './domain/export-pdf.js';
import { TransactionExportDoc } from './infrastructure/transaction-export.schemas.js';
import {
  EXPORT_CONTENT_TYPES,
  EXPORT_EXTENSIONS,
  EXPORT_LINK_TTL_SECONDS,
  MAX_EXPORT_ROWS,
  SETTLED_STATUSES,
  apiBaseUrl,
} from './transactions.constants.js';

type ExportRequest = z.infer<typeof exportTransactionsRequestSchema>;

/** A rendered download, ready for the controller to stream. */
export interface RenderedExport {
  readonly bytes: Buffer;
  readonly contentType: string;
  readonly filename: string;
}

/**
 * Transaction exports.
 *
 * Requesting an export records the (account, format, window) triple — the unique index makes
 * the POST naturally idempotent — and answers with a short-lived download link. The bytes are
 * re-rendered from the ledger when the link is followed, so nothing large is ever stored and
 * every format is guaranteed to show the same figures: they all derive from one line list.
 */
@Injectable()
export class TransactionExportsService {
  constructor(
    @InjectModel(TransactionExportDoc.name) private readonly exports: Model<TransactionExportDoc>,
    @InjectModel(LedgerEntryDoc.name) private readonly entries: Model<LedgerEntryDoc>,
    private readonly accounts: AccountsService,
    private readonly annotations: TransactionAnnotationsService,
    @Inject(CONFIG) private readonly config: AppConfiguration,
    private readonly clock: ClockService,
  ) {}

  async request(customerId: string, body: ExportRequest): Promise<DownloadLink> {
    const account = await this.accounts.getForCustomer(body.accountId, customerId);
    const record = await this.findOrCreate(customerId, body);

    return {
      url: `${apiBaseUrl(this.config.http)}/v1/transactions/exports/${record._id}/download`,
      expiresAt: record.linkExpiresAt.toISOString(),
      filename: exportFilename(record, account.identifiers.number),
    };
  }

  /** Renders the export for download. Ownership and link expiry are enforced here. */
  async renderDownload(customerId: string, exportId: string): Promise<RenderedExport> {
    const record = await this.exports.findOne({ _id: exportId, customerId }).lean();
    if (!record) {
      throw new NotFoundError('Transaction export', exportId);
    }
    if (record.linkExpiresAt.getTime() <= this.clock.epochMs()) {
      throw new ForbiddenError('This export link has expired; request a fresh export', { exportId });
    }

    const account = await this.accounts.getForCustomer(record.accountId, customerId);
    const { lines, openingMinorUnits } = await this.buildLines(customerId, record);
    return {
      bytes: this.render(record, lines, openingMinorUnits, account),
      contentType: EXPORT_CONTENT_TYPES[record.format as ExportRequest['format']],
      filename: exportFilename(record, account.identifiers.number),
    };
  }

  private async findOrCreate(customerId: string, body: ExportRequest): Promise<TransactionExportDoc> {
    const identity = { customerId, accountId: body.accountId, format: body.format, from: body.from, to: body.to };
    const existing = await this.exports.findOne(identity).lean();
    if (existing) {
      return existing;
    }

    try {
      const [created] = await this.exports.create([
        { _id: newId(), ...identity, linkExpiresAt: this.linkExpiry() },
      ]);
      return created as TransactionExportDoc;
    } catch (error) {
      if (!isDuplicateKeyError(error)) {
        throw error;
      }
      const winner = await this.exports.findOne(identity).lean();
      if (!winner) {
        throw error;
      }
      return winner;
    }
  }

  /** Chronological lines with a running balance folded in, capped at MAX_EXPORT_ROWS. */
  private async buildLines(
    customerId: string,
    record: TransactionExportDoc,
  ): Promise<{ lines: ExportLine[]; openingMinorUnits: number }> {
    const ref = customerRef(record.accountId);
    const rows = await this.entries
      .find({
        accountRef: ref,
        valueDate: { $gte: record.from, $lte: record.to },
        transactionStatus: { $in: SETTLED_STATUSES },
      })
      .sort({ bookedAt: 1, _id: 1 })
      .limit(MAX_EXPORT_ROWS)
      .lean();

    const overrides = await this.annotations.getForTransactions(
      customerId,
      rows.map((row) => row.transactionId),
    );
    const opening = await this.settledSumBefore(ref, record.from);

    let running = opening;
    const lines = rows.map((row) => {
      running += row.signedMinorUnits;
      const description = row.narrative ?? 'Transaction';
      return {
        transactionId: row.transactionId,
        valueDate: row.valueDate,
        bookedAt: row.bookedAt,
        description,
        type: row.transactionType,
        category:
          overrides.get(row.transactionId)?.category ??
          categoriseTransaction(row.transactionType, description, row.direction),
        direction: row.direction,
        signedMinorUnits: row.signedMinorUnits,
        currency: row.currency as CurrencyCode,
        runningMinorUnits: running,
      };
    });
    return { lines, openingMinorUnits: opening };
  }

  /** Σ signed minor units of settled activity before the window — the opening balance. */
  private async settledSumBefore(accountRef: string, from: string): Promise<number> {
    const [row] = await this.entries.aggregate<{ total: number }>([
      {
        $match: {
          accountRef,
          valueDate: { $lt: from },
          transactionStatus: { $in: SETTLED_STATUSES },
        },
      },
      { $group: { _id: null, total: { $sum: '$signedMinorUnits' } } },
    ]);
    return row?.total ?? 0;
  }

  private render(
    record: TransactionExportDoc,
    lines: readonly ExportLine[],
    openingMinorUnits: number,
    account: AccountDetail,
  ): Buffer {
    switch (record.format) {
      case 'csv':
        return Buffer.from(toCsv(lines), 'utf8');
      case 'json':
        return Buffer.from(
          toJsonDocument(lines, {
            accountId: record.accountId,
            from: record.from,
            to: record.to,
            generatedAt: this.clock.now(),
          }),
          'utf8',
        );
      case 'ofx':
        return this.renderOfx(record, lines, openingMinorUnits, account);
      default:
        return this.renderPdf(record, lines, openingMinorUnits, account);
    }
  }

  private renderOfx(
    record: TransactionExportDoc,
    lines: readonly ExportLine[],
    openingMinorUnits: number,
    account: AccountDetail,
  ): Buffer {
    return Buffer.from(
      toOfx(lines, {
        bankId: account.identifiers.sortCode,
        accountId: account.identifiers.number,
        currency: account.currency,
        from: record.from,
        to: record.to,
        asOf: this.clock.now(),
        closingMinorUnits: closingBalance(lines, openingMinorUnits),
        documentId: record._id,
      }),
      'latin1',
    );
  }

  private renderPdf(
    record: TransactionExportDoc,
    lines: readonly ExportLine[],
    openingMinorUnits: number,
    account: AccountDetail,
  ): Buffer {
    return renderExportPdf(lines, {
      bankName: this.config.bank.name,
      accountLabel: `${account.productName} · ${account.identifiers.number}`,
      from: record.from,
      to: record.to,
      currency: account.currency,
      openingMinorUnits,
      closingMinorUnits: closingBalance(lines, openingMinorUnits),
      generatedAt: this.clock.now(),
    });
  }

  private linkExpiry(): Date {
    return new Date(this.clock.epochMs() + EXPORT_LINK_TTL_SECONDS * 1000);
  }
}

/** Balance after the last line; the opening balance when the window saw no activity. */
function closingBalance(lines: readonly ExportLine[], openingMinorUnits: number): number {
  return lines[lines.length - 1]?.runningMinorUnits ?? openingMinorUnits;
}

/** `transactions-0011223344-2026-01-01-2026-01-31.csv` — stable for a given record. */
function exportFilename(record: TransactionExportDoc, accountNumber: string): string {
  const extension = EXPORT_EXTENSIONS[record.format as ExportRequest['format']];
  return `transactions-${accountNumber}-${record.from}-${record.to}.${extension}`;
}
