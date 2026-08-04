import { getGlAccount, type NormalSide } from './chart-of-accounts.js';

/**
 * A ledger posting targets either a customer account or an internal GL account. Encoding both as
 * one prefixed string keeps `ledger_entries` on a single index and makes a journal query
 * uniform, while the prefix keeps the two namespaces from ever colliding.
 *
 *   `acct:01J8ZC…`  a customer account
 *   `gl:2000`       an internal general-ledger account
 */
/** A prefixed ledger account reference. Kept as a plain string so it indexes natively. */
export type AccountRef = `acct:${string}` | `gl:${string}`;

const CUSTOMER_PREFIX = 'acct:';
const GL_PREFIX = 'gl:';

// Each constructor returns its own half of the union rather than the union itself. A caller that
// asks for a customer reference has proven it is holding a customer reference, and can say so in
// its own signature without re-narrowing something it just built.
export function customerRef(accountId: string): `acct:${string}` {
  return `${CUSTOMER_PREFIX}${accountId}`;
}

export function glRef(code: string): `gl:${string}` {
  // Fails fast on a typo'd code rather than silently creating a phantom account.
  getGlAccount(code);
  return `${GL_PREFIX}${code}`;
}

/**
 * Narrow a string loaded from the database into an AccountRef.
 *
 * Parsing at the persistence boundary means the rest of the code can trust the prefix, and a
 * malformed reference fails loudly here rather than silently posting to nowhere.
 */
export function toAccountRef(value: string): AccountRef {
  if (value.startsWith(CUSTOMER_PREFIX) || value.startsWith(GL_PREFIX)) {
    return value as AccountRef;
  }
  throw new Error(`Malformed ledger account reference: ${value}`);
}

export function isCustomerRef(ref: AccountRef): boolean {
  return ref.startsWith(CUSTOMER_PREFIX);
}

export function isGlRef(ref: AccountRef): boolean {
  return ref.startsWith(GL_PREFIX);
}

export function accountIdFromRef(ref: AccountRef): string {
  if (!isCustomerRef(ref)) {
    throw new Error(`Not a customer account reference: ${ref}`);
  }
  return ref.slice(CUSTOMER_PREFIX.length);
}

export function glCodeFromRef(ref: AccountRef): string {
  if (!isGlRef(ref)) {
    throw new Error(`Not a general-ledger reference: ${ref}`);
  }
  return ref.slice(GL_PREFIX.length);
}

/**
 * Customer accounts are liabilities, so they increase on the credit side — a deposit credits the
 * customer. Loan accounts are the exception and are resolved through their GL mapping.
 */
export function normalSideForRef(ref: AccountRef, customerNormalSide: NormalSide = 'credit'): NormalSide {
  return isGlRef(ref) ? getGlAccount(glCodeFromRef(ref)).normalSide : customerNormalSide;
}
