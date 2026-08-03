import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { ClockService } from '../../../simulation/clock/clock.service.js';
import { AccountDoc } from '../../accounts/infrastructure/account.schemas.js';
import { customerRef } from '../../ledger/domain/account-ref.js';
import { LedgerEntryDoc } from '../../ledger/infrastructure/ledger.schemas.js';
import { TransferDoc } from '../../transfers/infrastructure/transfer.schemas.js';
import {
  MONITORING_HISTORY_LIMIT,
  MONITORING_LOOKBACK_DAYS,
  MS_PER_DAY,
  SETTLED_TRANSACTION_STATUSES,
} from '../aml.constants.js';
import type { FlowPoint } from '../domain/scenario.types.js';

interface TransferSignals {
  readonly country: string | null;
  readonly counterparty: string | null;
}

/** The destination record is a discriminated union; only international legs carry a country. */
function destinationCountry(destination: Record<string, unknown>): string | null {
  const country = destination['country'];
  return typeof country === 'string' ? country : null;
}

/**
 * One read of everything the monitoring scenarios are allowed to see.
 *
 * All five detectors share this context rather than issuing their own queries, for the same
 * reason the risk engine shares its: a scan must be reproducible. Every detector looked at the
 * same history from the same clock instant, so replaying the scan cannot fire differently.
 * Ledger entries are read, never written (N4) — monitoring observes the ledger, it does not
 * touch it.
 */
@Injectable()
export class MonitoringContextService {
  constructor(
    @InjectModel(AccountDoc.name) private readonly accounts: Model<AccountDoc>,
    @InjectModel(LedgerEntryDoc.name) private readonly entries: Model<LedgerEntryDoc>,
    @InjectModel(TransferDoc.name) private readonly transfers: Model<TransferDoc>,
    private readonly clock: ClockService,
  ) {}

  async flowsFor(customerId: string): Promise<FlowPoint[]> {
    const accounts = await this.accounts.find({ customerId }).select('_id').lean();
    if (accounts.length === 0) {
      return [];
    }

    const since = new Date(this.clock.epochMs() - MONITORING_LOOKBACK_DAYS * MS_PER_DAY);
    const [entries, transfers] = await Promise.all([
      this.entries
        .find({
          accountRef: { $in: accounts.map((account) => customerRef(account._id)) },
          transactionStatus: { $in: SETTLED_TRANSACTION_STATUSES },
          bookedAt: { $gte: since },
        })
        .sort({ bookedAt: -1 })
        .limit(MONITORING_HISTORY_LIMIT)
        .lean(),
      this.transfers.find({ customerId, createdAt: { $gte: since } }).lean(),
    ]);

    const signals = this.signalsByTransaction(transfers);
    return entries.map((entry) => this.toFlow(entry, signals.get(entry.transactionId)));
  }

  private signalsByTransaction(transfers: readonly TransferDoc[]): Map<string, TransferSignals> {
    const map = new Map<string, TransferSignals>();
    for (const transfer of transfers) {
      if (transfer.transactionId !== null) {
        map.set(transfer.transactionId, {
          country: destinationCountry(transfer.destination),
          counterparty: transfer.recipientName,
        });
      }
    }
    return map;
  }

  private toFlow(entry: LedgerEntryDoc, signals: TransferSignals | undefined): FlowPoint {
    return {
      transactionId: entry.transactionId,
      direction: entry.direction,
      minorUnits: entry.minorUnits,
      currency: entry.currency,
      transactionType: entry.transactionType,
      at: entry.bookedAt,
      destinationCountry: signals?.country ?? null,
      counterpartyName: signals?.counterparty ?? null,
    };
  }
}
