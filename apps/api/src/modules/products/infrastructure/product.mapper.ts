import type { AccountKind, Fee, MoneyDto, Product } from '@icb/contracts';
import type { CurrencyCode } from '@icb/money';

import { toMoneyDto } from '../../accounts/infrastructure/account.mapper.js';
import { DEFAULT_CURRENCY } from '../products.constants.js';
import type { FeeRow, ProductDoc } from './product.schemas.js';

/**
 * Persistence ↔ contract.
 *
 * The wire `Product` deliberately shows less than the stored document: fee tier rows, the limit
 * matrix, rate schedules, deposit terms, and loan rate ranges are pricing internals. The reverse
 * direction preserves those internals across staff edits — a PATCH that rewrites the fee list
 * must not silently drop the tier rows a fee's calculation depends on.
 */

function primaryCurrency(doc: Pick<ProductDoc, 'currencies'>): string {
  return doc.currencies[0] ?? DEFAULT_CURRENCY;
}

function moneyOrNull(minorUnits: number | null, currency: string): MoneyDto | null {
  return minorUnits === null ? null : toMoneyDto(minorUnits, currency);
}

function toFee(fee: FeeRow, currency: string): Fee {
  return {
    code: fee.code,
    label: fee.label,
    basis: fee.basis,
    amount: moneyOrNull(fee.amountMinorUnits, currency),
    percentage: fee.percentage,
    minimum: moneyOrNull(fee.minimumMinorUnits, currency),
    maximum: moneyOrNull(fee.maximumMinorUnits, currency),
    waivedForTiers: [...fee.waivedForTiers],
  };
}

export function toProduct(doc: ProductDoc): Product {
  const currency = primaryCurrency(doc);
  return {
    code: doc.code,
    name: doc.name,
    tagline: doc.tagline,
    description: doc.description,
    kind: doc.kind as AccountKind,
    currencies: doc.currencies as CurrencyCode[],
    interestRate: doc.interestRate,
    interestBands: doc.interestBands === null ? null : doc.interestBands.map((band) => ({ ...band })),
    minimumOpeningBalance: moneyOrNull(doc.minimumOpeningBalanceMinorUnits, currency),
    minimumBalance: moneyOrNull(doc.minimumBalanceMinorUnits, currency),
    monthlyFee: moneyOrNull(doc.monthlyFeeMinorUnits, currency),
    fees: doc.fees.map((fee) => toFee(fee, currency)),
    features: [...doc.features],
    eligibility: { ...doc.eligibility },
    active: doc.active,
    displayOrder: doc.displayOrder,
  };
}

function fromMoney(money: MoneyDto | null): number | null {
  return money === null ? null : money.minorUnits;
}

function toFeeRow(fee: Fee, prior: FeeRow | undefined): FeeRow {
  return {
    code: fee.code,
    label: fee.label,
    basis: fee.basis,
    amountMinorUnits: fromMoney(fee.amount),
    percentage: fee.percentage,
    // Tiers are not on the wire; keep the stored rows for a fee that survives the edit.
    tiers: prior?.tiers ?? [],
    minimumMinorUnits: fromMoney(fee.minimum),
    maximumMinorUnits: fromMoney(fee.maximum),
    waivedForTiers: fee.waivedForTiers,
  };
}

/** The `$set`-able fields of a product write. Internal-only fields are untouched on update. */
export function persistenceFromProduct(
  input: Product,
  prior?: Pick<ProductDoc, 'fees'>,
): Record<string, unknown> {
  return {
    code: input.code,
    name: input.name,
    tagline: input.tagline,
    description: input.description,
    kind: input.kind,
    currencies: input.currencies,
    interestRate: input.interestRate,
    interestBands: input.interestBands,
    minimumOpeningBalanceMinorUnits: fromMoney(input.minimumOpeningBalance),
    minimumBalanceMinorUnits: fromMoney(input.minimumBalance),
    monthlyFeeMinorUnits: fromMoney(input.monthlyFee),
    fees: input.fees.map((fee) => toFeeRow(fee, prior?.fees.find((row) => row.code === fee.code))),
    features: input.features,
    eligibility: input.eligibility,
    active: input.active,
    displayOrder: input.displayOrder,
  };
}
