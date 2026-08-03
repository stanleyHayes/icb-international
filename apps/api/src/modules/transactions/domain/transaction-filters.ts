import type { TransactionQuery } from '@icb/contracts';

import { SETTLED_STATUSES } from '../transactions.constants.js';

/**
 * Mongoose has renamed its exported filter type across majors, so the query is assembled as a
 * plain record and handed to `find` at the call site. Keeping it structural rather than importing
 * a moving type means this file survives the next rename.
 */
export type EntryFilter = Record<string, unknown>;

/** One filter clause per supported query parameter. Undefined means "not filtering on this". */
const FILTER_CLAUSES: readonly {
  field: string;
  build: (query: TransactionQuery) => unknown;
}[] = [
  { field: '_id', build: (q) => (q.cursor ? { $lt: q.cursor } : undefined) },
  { field: 'direction', build: (q) => q.direction },
  { field: 'transactionType', build: (q) => (q.type?.length ? { $in: q.type } : undefined) },
  { field: 'transactionStatus', build: (q) => (q.status?.length ? { $in: q.status } : undefined) },
  { field: 'currency', build: (q) => q.currency },
  {
    field: 'valueDate',
    build: (q) =>
      q.from || q.to
        ? { ...(q.from ? { $gte: q.from } : {}), ...(q.to ? { $lte: q.to } : {}) }
        : undefined,
  },
  {
    field: 'minorUnits',
    build: (q) =>
      q.minMinorUnits !== undefined || q.maxMinorUnits !== undefined
        ? {
            ...(q.minMinorUnits !== undefined ? { $gte: q.minMinorUnits } : {}),
            ...(q.maxMinorUnits !== undefined ? { $lte: q.maxMinorUnits } : {}),
          }
        : undefined,
  },
  { field: 'narrative', build: (q) => (q.q ? { $regex: escapeRegex(q.q), $options: 'i' } : undefined) },
];

/** Assemble the ledger-entry filter for a list query over the given account references. */
export function buildEntryFilter(refs: string[], query: TransactionQuery): EntryFilter {
  const filter: EntryFilter = { accountRef: { $in: refs } };

  for (const clause of FILTER_CLAUSES) {
    const value = clause.build(query);
    if (value !== undefined) {
      filter[clause.field] = value;
    }
  }

  // Applied last so it overrides an explicit status filter when pending rows are excluded.
  if (!query.includePending) {
    filter['transactionStatus'] = { $in: SETTLED_STATUSES };
  }

  return filter;
}

/**
 * Strictly-newer-than clause in the page's own sort order (`bookedAt` desc, `_id` desc).
 * Used to find the settled activity between the page and the present.
 */
export function newerThanClause(bookedAt: Date, id: string): EntryFilter {
  return { $or: [{ bookedAt: { $gt: bookedAt } }, { bookedAt, _id: { $gt: id } }] };
}

/** User-supplied search text goes into a regex, so metacharacters must be neutralised. */
function escapeRegex(value: string): string {
  return value.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
