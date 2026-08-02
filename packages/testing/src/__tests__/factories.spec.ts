import {
  accountDetailSchema,
  cardDetailSchema,
  customerProfileSchema,
  kycCaseSchema,
  loanSchema,
  staffUserSchema,
  transactionDetailSchema,
  transferDetailSchema,
} from '@icb/contracts';
import { describe, expect, it } from 'vitest';

import { createFactoryContext } from '../core/context.js';
import { accountDetail, savingsAccount } from '../factories/account.factory.js';
import { cardDetail } from '../factories/card.factory.js';
import { customerProfile } from '../factories/customer.factory.js';
import { kycCase } from '../factories/kyc.factory.js';
import { loan, repaymentInstalment } from '../factories/loan.factory.js';
import { adminUser, staffUser } from '../factories/staff.factory.js';
import { transactionDetail } from '../factories/transaction.factory.js';
import { transferDetail } from '../factories/transfer.factory.js';

const ctx = createFactoryContext({ seed: 99 });

describe('factories produce contract-valid entities', () => {
  it('customer (individual)', () => {
    expect(customerProfileSchema.safeParse(customerProfile(ctx)).success).toBe(true);
  });

  it('customer (business)', () => {
    const parsed = customerProfileSchema.safeParse(customerProfile(ctx, { type: 'business' }));
    expect(parsed.success).toBe(true);
  });

  it('account detail', () => {
    expect(accountDetailSchema.safeParse(accountDetail(ctx)).success).toBe(true);
  });

  it('savings account', () => {
    expect(accountDetailSchema.safeParse(savingsAccount(ctx)).success).toBe(true);
  });

  it('transaction detail', () => {
    expect(transactionDetailSchema.safeParse(transactionDetail(ctx)).success).toBe(true);
  });

  it('transfer detail', () => {
    expect(transferDetailSchema.safeParse(transferDetail(ctx)).success).toBe(true);
  });

  it('card detail', () => {
    expect(cardDetailSchema.safeParse(cardDetail(ctx)).success).toBe(true);
  });

  it('loan', () => {
    expect(loanSchema.safeParse(loan(ctx)).success).toBe(true);
  });

  it('kyc case', () => {
    expect(kycCaseSchema.safeParse(kycCase(ctx)).success).toBe(true);
  });

  it('staff users', () => {
    expect(staffUserSchema.safeParse(staffUser(ctx)).success).toBe(true);
    expect(staffUserSchema.safeParse(adminUser(ctx)).success).toBe(true);
  });
});

describe('factory overrides', () => {
  it('pins fields through the override bag', () => {
    const customer = customerProfile(ctx, { status: 'suspended', tier: 'premier' });
    expect(customer.status).toBe('suspended');
    expect(customer.tier).toBe('premier');
    expect(customerProfileSchema.safeParse(customer).success).toBe(true);
  });

  it('builds a zero-balance account on request', () => {
    const account = accountDetail(ctx, { ledgerMinorUnits: 0 });
    expect(account.balances.ledger.minorUnits).toBe(0);
    expect(account.balances.available.minorUnits).toBe(0);
  });

  it('keeps instalment arithmetic coherent', () => {
    const row = repaymentInstalment(ctx);
    expect(row.principal.minorUnits + row.interest.minorUnits).toBe(row.instalment.minorUnits);
    expect(row.openingBalance.minorUnits - row.principal.minorUnits).toBe(
      row.closingBalance.minorUnits,
    );
  });
});
