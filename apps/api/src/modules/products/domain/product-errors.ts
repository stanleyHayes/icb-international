import { DomainError } from '../../../common/errors/index.js';

/**
 * Named errors for the pricing domain. Both are NOT_FOUND-class: the resource asked for
 * (an effective rate, a fee line) does not exist on the product.
 */

/** No schedule entry has taken effect yet and the product carries no base rate. */
export class NoEffectiveRateError extends DomainError {
  constructor(productCode: string, at: string) {
    super('NOT_FOUND', `No effective interest rate for product ${productCode}`, {
      context: { productCode, at },
    });
  }
}

/** A fee referenced by code is not part of the product's fee schedule. */
export class FeeNotFoundError extends DomainError {
  constructor(productCode: string, feeCode: string) {
    super('NOT_FOUND', `Fee ${feeCode} is not defined for product ${productCode}`, {
      context: { productCode, feeCode },
    });
  }
}
