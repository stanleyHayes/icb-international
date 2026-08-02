import type { CursorPage } from '@icb/contracts';

import { ValidationError } from '../errors/domain-errors.js';

/** Version prefix so a future cursor format change fails loudly instead of silently mis-paging. */
const CURSOR_VERSION = 'v1';
const CURSOR_PARTS = 2;

/**
 * Opaque cursor encoding.
 *
 * A cursor is `v1.<base64url(last-item-id)>`. Clients must treat it as opaque; the version lets
 * the server reject cursors from a different format rather than applying them to the wrong
 * ordering key.
 */
export function encodeCursor(lastItemId: string): string {
  const encoded = Buffer.from(lastItemId, 'utf8').toString('base64url');
  return `${CURSOR_VERSION}.${encoded}`;
}

export function decodeCursor(cursor: string): string {
  const [version, encoded] = cursor.split('.');
  if (version !== CURSOR_VERSION || !encoded || cursor.split('.').length !== CURSOR_PARTS) {
    throw new ValidationError('The pagination cursor is invalid', [
      { path: 'cursor', message: 'Malformed pagination cursor' },
    ]);
  }
  const id = Buffer.from(encoded, 'base64url').toString('utf8');
  if (id.length === 0 || encodeCursor(id) !== cursor) {
    throw new ValidationError('The pagination cursor is invalid', [
      { path: 'cursor', message: 'Malformed pagination cursor' },
    ]);
  }
  return id;
}

/**
 * Builds a `CursorPage` from a `limit + 1` fetch.
 *
 * Repositories fetch one row past the page size; the extra row is the `hasMore` signal and is
 * never returned. `idOf` names the ordering key the next cursor resumes after.
 */
export function buildCursorPage<TItem>(
  fetched: readonly TItem[],
  limit: number,
  idOf: (item: TItem) => string,
): CursorPage<TItem> {
  const hasMore = fetched.length > limit;
  const items = fetched.slice(0, limit);
  const last = items.at(-1);
  return {
    items,
    hasMore,
    nextCursor: hasMore && last !== undefined ? encodeCursor(idOf(last)) : null,
  };
}
