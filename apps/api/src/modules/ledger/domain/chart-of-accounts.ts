/**
 * ICB's chart of accounts.
 *
 * Customer accounts are *liabilities* of the bank: the money is theirs, the bank owes it. Every
 * posting has one leg here and one leg on a customer account (or two legs here, for internal
 * movements). Getting the normal side wrong inverts a balance, so the direction is declared once
 * and derived everywhere.
 */

export const ACCOUNT_TYPES = ['asset', 'liability', 'equity', 'revenue', 'expense', 'contra'] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

export type NormalSide = 'debit' | 'credit';

export interface GlAccount {
  readonly code: string;
  readonly name: string;
  readonly type: AccountType;
  readonly normalSide: NormalSide;
}

/** Assets and expenses increase on the debit side; everything else on the credit side. */
export function normalSideFor(type: AccountType): NormalSide {
  return type === 'asset' || type === 'expense' ? 'debit' : 'credit';
}

function gl(code: string, name: string, type: AccountType): GlAccount {
  return { code, name, type, normalSide: normalSideFor(type) };
}

export const GL_CASH = '1000';
export const GL_LOANS_RECEIVABLE = '1100';
export const GL_CARD_SETTLEMENT = '1200';
export const GL_DEPOSITS_CURRENT = '2000';
export const GL_DEPOSITS_SAVINGS = '2010';
export const GL_DEPOSITS_FIXED = '2020';
export const GL_PENDING_SETTLEMENT = '2100';
export const GL_CARD_HOLDS = '2200';
export const GL_RETAINED_EARNINGS = '3000';
export const GL_FEE_INCOME = '4000';
export const GL_INTEREST_INCOME = '4100';
export const GL_FX_INCOME = '4200';
export const GL_INTEREST_EXPENSE = '5000';
export const GL_FRAUD_LOSSES = '5100';
export const GL_FX_ROUNDING = '9000';
export const GL_SUSPENSE = '9900';

const ACCOUNTS: readonly GlAccount[] = [
  gl(GL_CASH, 'Cash and central bank', 'asset'),
  gl(GL_LOANS_RECEIVABLE, 'Loans receivable', 'asset'),
  gl(GL_CARD_SETTLEMENT, 'Card settlement receivable', 'asset'),
  gl(GL_DEPOSITS_CURRENT, 'Customer deposits — current', 'liability'),
  gl(GL_DEPOSITS_SAVINGS, 'Customer deposits — savings', 'liability'),
  gl(GL_DEPOSITS_FIXED, 'Customer deposits — fixed', 'liability'),
  gl(GL_PENDING_SETTLEMENT, 'Pending settlement', 'liability'),
  gl(GL_CARD_HOLDS, 'Card authorisation holds', 'liability'),
  gl(GL_RETAINED_EARNINGS, 'Retained earnings', 'equity'),
  gl(GL_FEE_INCOME, 'Fee income', 'revenue'),
  gl(GL_INTEREST_INCOME, 'Interest income', 'revenue'),
  gl(GL_FX_INCOME, 'FX income', 'revenue'),
  gl(GL_INTEREST_EXPENSE, 'Interest expense', 'expense'),
  gl(GL_FRAUD_LOSSES, 'Fraud and dispute losses', 'expense'),
  gl(GL_FX_ROUNDING, 'FX rounding', 'contra'),
  gl(GL_SUSPENSE, 'Suspense', 'contra'),
];

const BY_CODE = new Map(ACCOUNTS.map((account) => [account.code, account]));

export function getGlAccount(code: string): GlAccount {
  const account = BY_CODE.get(code);
  if (!account) {
    throw new Error(`Unknown general-ledger account code: ${code}`);
  }
  return account;
}

export function isGlCode(code: string): boolean {
  return BY_CODE.has(code);
}

export function listGlAccounts(): readonly GlAccount[] {
  return ACCOUNTS;
}

/**
 * Which deposit liability a customer account rolls up to. Keeping current, savings and fixed
 * separate is what makes the balance sheet readable without querying every account.
 */
export function depositGlCodeFor(accountKind: string): string {
  switch (accountKind) {
    case 'savings':
      return GL_DEPOSITS_SAVINGS;
    case 'fixed_deposit':
      return GL_DEPOSITS_FIXED;
    case 'loan':
      return GL_LOANS_RECEIVABLE;
    default:
      return GL_DEPOSITS_CURRENT;
  }
}
