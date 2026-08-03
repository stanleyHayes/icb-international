import type { AccountKind } from '@icb/contracts';

import { NotFoundError } from '../../../common/errors/index.js';
import { SELF_SERVE_PRODUCTS } from '../accounts.constants.js';

/** A product a customer may open through the self-serve API. */
export interface SelfServeProduct {
  readonly code: string;
  readonly name: string;
  readonly kind: AccountKind;
  readonly interestRate: number;
  readonly overdraftMinorUnits: number;
}

/**
 * Resolve a self-serve product by code.
 *
 * This is deliberately a lookup over a constant list until BE-08 ships the products collection;
 * the function boundary is where that collection will be swapped in without touching callers.
 */
export function getSelfServeProduct(code: string): SelfServeProduct {
  const product = SELF_SERVE_PRODUCTS.find((candidate) => candidate.code === code);
  if (!product) {
    throw new NotFoundError('Product', code);
  }
  return product;
}
