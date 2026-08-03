import type { TransferQuery } from '@icb/contracts';
import type { Model } from 'mongoose';

import { decodeCursor } from '../../../common/pagination/cursor.js';
import type { ClockService } from '../../../simulation/clock/clock.service.js';
import type { TransferDoc } from './transfer.schemas.js';

/** Statuses that did not actually move money, excluded from spend totals. */
const NON_DEBITING_STATUSES = ['failed', 'cancelled'];

/**
 * The sender's debits on one rail since the start of the current business day.
 *
 * This is the number the daily limit is enforced against, so it sums what the customer actually
 * committed — completed, in-flight and scheduled sends alike — and ignores anything that failed
 * or was cancelled.
 */
export async function spentOnRailToday(
  transfers: Model<TransferDoc>,
  customerId: string,
  rail: string,
  clock: ClockService,
): Promise<number> {
  const [row] = await transfers.aggregate<{ total: number }>([
    {
      $match: {
        customerId,
        rail,
        createdAt: { $gte: clock.startOfDay() },
        status: { $nin: NON_DEBITING_STATUSES },
      },
    },
    { $group: { _id: null, total: { $sum: '$debitMinorUnits' } } },
  ]);
  return row?.total ?? 0;
}

/** The Mongo filter for the customer transfer list, cursor included. */
export function buildTransferFilter(
  customerId: string,
  query: TransferQuery,
): Record<string, unknown> {
  const filter: Record<string, unknown> = { customerId };
  if (query.cursor) {
    filter['_id'] = { $gt: decodeCursor(query.cursor) };
  }
  if (query.accountId) {
    filter['fromAccountId'] = query.accountId;
  }
  if (query.status && query.status.length > 0) {
    filter['status'] = { $in: query.status };
  }
  if (query.rail && query.rail.length > 0) {
    filter['rail'] = { $in: query.rail };
  }
  if (query.recurringOnly) {
    filter['recurring'] = true;
  }
  const createdAt = dateRange(query.from, query.to);
  if (createdAt) {
    filter['createdAt'] = createdAt;
  }
  return filter;
}

function dateRange(from?: string, to?: string): Record<string, Date> | null {
  const range: Record<string, Date> = {};
  if (from) {
    range['$gte'] = new Date(`${from}T00:00:00.000Z`);
  }
  if (to) {
    range['$lte'] = new Date(`${to}T23:59:59.999Z`);
  }
  return Object.keys(range).length > 0 ? range : null;
}
