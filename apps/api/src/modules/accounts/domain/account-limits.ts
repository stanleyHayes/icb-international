import { ACCOUNT_LIMITS } from '../accounts.constants.js';
import { AccountLimitExceededError } from './account.errors.js';

/** The fields the limit check needs from an existing account. */
export interface ExistingAccountLike {
  readonly productCode: string;
  readonly currency: string;
  readonly status: string;
}

export interface AccountLimitRule {
  readonly maxPerProductCurrency: number;
  readonly maxActivePerCustomer: number;
}

/**
 * Enforce the per-customer account caps before a self-serve opening.
 *
 * Two independent caps: a product/currency pair (one Everyday Current in USD, say) and a total
 * across the relationship. Closed accounts count against neither — closing must always free the
 * slot, or a customer who closed an account could never reopen one.
 */
export function assertWithinAccountLimits(
  existing: readonly ExistingAccountLike[],
  productCode: string,
  currency: string,
  limits: AccountLimitRule = ACCOUNT_LIMITS,
): void {
  const active = existing.filter((account) => account.status !== 'closed');
  const sameProduct = active.filter(
    (account) => account.productCode === productCode && account.currency === currency,
  );

  if (sameProduct.length >= limits.maxPerProductCurrency) {
    throw new AccountLimitExceededError(
      `${productCode} account(s) in ${currency}`,
      limits.maxPerProductCurrency,
    );
  }
  if (active.length >= limits.maxActivePerCustomer) {
    throw new AccountLimitExceededError('accounts in total', limits.maxActivePerCustomer);
  }
}
