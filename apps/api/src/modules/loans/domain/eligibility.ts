import type { LoanProduct, MoneyDto } from '@icb/contracts';
import { format, fromMinorUnits, isGreaterThan, isLessThan, type Money } from '@icb/money';

import { DomainError, ValidationError } from '../../../common/errors/index.js';
import { amountBand } from './loan-products.js';

/**
 * The guards that run before any lending maths does.
 *
 * A quote outside the product's band is not a quote, it is a misunderstanding — so it is refused
 * here rather than priced. An *application* outside the band is a different matter: that is a
 * lending decision with reasons attached, and it belongs to the decision engine.
 */

/** Narrow a wire amount into `Money`, refusing a currency the product is not sold in. */
export function toProductMoney(product: LoanProduct, amount: MoneyDto): Money {
  if (amount.currency !== product.currency) {
    throw new DomainError(
      'ACCOUNT_CURRENCY_MISMATCH',
      `${product.name} is only offered in ${product.currency}`,
      { context: { productCurrency: product.currency, requestCurrency: amount.currency } },
    );
  }
  return fromMinorUnits(amount.minorUnits, product.currency);
}

export function assertWithinBands(product: LoanProduct, amount: Money, termMonths: number): void {
  const band = amountBand(product);

  if (isLessThan(amount, band.minimum) || isGreaterThan(amount, band.maximum)) {
    throw new ValidationError(
      `${product.name} is available from ${format(band.minimum)} to ${format(band.maximum)}`,
      [{ path: 'amount', message: 'Outside the product amount band' }],
    );
  }

  if (termMonths < product.minimumTermMonths || termMonths > product.maximumTermMonths) {
    throw new ValidationError(
      `${product.name} runs for ${product.minimumTermMonths} to ${product.maximumTermMonths} months`,
      [{ path: 'termMonths', message: 'Outside the product term band' }],
    );
  }
}
