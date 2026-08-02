import type { OffsetPage, OffsetQuery } from '@icb/contracts';

/**
 * Builds an `OffsetPage` from a windowed fetch plus a total count.
 *
 * Offset pagination exists for bounded admin tables only (see the contract's pagination notes);
 * `totalPages` is derived here so no repository can disagree with the API about the arithmetic.
 */
export function buildOffsetPage<TItem>(
  items: readonly TItem[],
  total: number,
  query: OffsetQuery,
): OffsetPage<TItem> {
  return {
    items: [...items],
    page: query.page,
    limit: query.limit,
    total,
    totalPages: total === 0 ? 0 : Math.ceil(total / query.limit),
  };
}

/** Mongoose `skip` value for a validated offset query. */
export function offsetOf(query: OffsetQuery): number {
  return (query.page - 1) * query.limit;
}
