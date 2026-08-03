import type { RateTable } from '@icb/contracts';

import { toMoneyDto } from '../../accounts/infrastructure/account.mapper.js';
import { lastChangeBefore, resolveRateAt } from '../domain/rate-schedule.js';
import { DEFAULT_CURRENCY } from '../products.constants.js';
import type { ProductDoc } from '../infrastructure/product.schemas.js';

/**
 * Builds the public rates table from the active catalogue.
 *
 * Pure so the marketing-site payload can be tested without a database: documents in, contract
 * out. The rate shown for a product is the schedule entry in force at `at`, falling back to
 * the product's base rate; a product with neither simply does not appear.
 */

const DEPOSIT_KINDS = new Set(['current', 'savings']);

function rateFor(doc: ProductDoc, at: Date): number | null {
  return resolveRateAt(doc.rateSchedule, at)?.rate ?? doc.interestRate;
}

function savingsRows(docs: readonly ProductDoc[], at: Date): RateTable['savings'] {
  return docs.flatMap((doc) => {
    if (!DEPOSIT_KINDS.has(doc.kind)) {
      return [];
    }
    const rate = rateFor(doc, at);
    return rate === null ? [] : [{ productCode: doc.code, name: doc.name, rate }];
  });
}

function depositRows(docs: readonly ProductDoc[]): RateTable['deposits'] {
  return docs.flatMap((doc) => {
    if (doc.kind !== 'fixed_deposit') {
      return [];
    }
    const currency = doc.currencies[0] ?? DEFAULT_CURRENCY;
    return doc.depositTerms.map((term) => ({
      termMonths: term.termMonths,
      rate: term.rate,
      minimumAmount: toMoneyDto(term.minimumMinorUnits, currency),
    }));
  });
}

function loanRows(docs: readonly ProductDoc[]): RateTable['loans'] {
  return docs.flatMap((doc) => {
    if (doc.kind !== 'loan' || doc.loanRateRange === null) {
      return [];
    }
    return [
      {
        productCode: doc.code,
        name: doc.name,
        fromRate: doc.loanRateRange.fromRate,
        toRate: doc.loanRateRange.toRate,
      },
    ];
  });
}

/** The instant the published table last changed: the newest schedule change in force. */
function effectiveFrom(docs: readonly ProductDoc[], at: Date): Date {
  let latest: Date | null = null;
  for (const doc of docs) {
    const changed = lastChangeBefore(doc.rateSchedule, at);
    if (changed !== null && (latest === null || changed.getTime() > latest.getTime())) {
      latest = changed;
    }
  }
  return latest ?? at;
}

export function buildRateTable(docs: readonly ProductDoc[], at: Date): RateTable {
  return {
    effectiveFrom: effectiveFrom(docs, at).toISOString(),
    savings: savingsRows(docs, at),
    deposits: depositRows(docs),
    loans: loanRows(docs),
  };
}
