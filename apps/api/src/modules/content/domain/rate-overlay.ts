import type { RateTable } from '@icb/contracts';

/**
 * Layers content-managed rate entries over the catalogue-built rate table.
 *
 * Pure so the layering can be tested without a database. An entry applies once its
 * `effectiveFrom` has passed; a code already in the table has its savings rate replaced,
 * a code the catalogue does not know is appended — that is the whole override/extend rule.
 */

export interface RateOverlayEntry {
  productCode: string;
  name: string;
  rate: number;
  effectiveFrom: Date;
}

function applicable(entries: readonly RateOverlayEntry[], at: Date): RateOverlayEntry[] {
  return entries.filter((entry) => entry.effectiveFrom.getTime() <= at.getTime());
}

function overlaySavings(
  rows: RateTable['savings'],
  entries: readonly RateOverlayEntry[],
): RateTable['savings'] {
  const byCode = new Map(entries.map((entry) => [entry.productCode, entry]));
  const replaced = rows.map((row) => {
    const entry = byCode.get(row.productCode);
    byCode.delete(row.productCode);
    return entry === undefined ? row : { ...row, rate: entry.rate };
  });
  const appended = [...byCode.values()]
    .sort((left, right) => left.productCode.localeCompare(right.productCode))
    .map((entry) => ({ productCode: entry.productCode, name: entry.name, rate: entry.rate }));
  return [...replaced, ...appended];
}

/** The instant the layered table last changed: the newer of the table's and the newest entry. */
function layeredEffectiveFrom(table: RateTable, entries: readonly RateOverlayEntry[]): string {
  let latest = new Date(table.effectiveFrom).getTime();
  for (const entry of entries) {
    latest = Math.max(latest, entry.effectiveFrom.getTime());
  }
  return new Date(latest).toISOString();
}

export function overlayRateEntries(
  table: RateTable,
  entries: readonly RateOverlayEntry[],
  at: Date,
): RateTable {
  const active = applicable(entries, at);
  if (active.length === 0) {
    return table;
  }
  return {
    ...table,
    effectiveFrom: layeredEffectiveFrom(table, active),
    savings: overlaySavings(table.savings, active),
  };
}
