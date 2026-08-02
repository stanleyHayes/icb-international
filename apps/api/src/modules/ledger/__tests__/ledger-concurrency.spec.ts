import { fromMinorUnits } from '@icb/money';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AppModule } from '../../../app.module.js';
import { newId } from '../../../infrastructure/database/identifier.js';
import { AccountsService } from '../../accounts/accounts.service.js';
import { customerRef, glRef } from '../domain/account-ref.js';
import { GL_CASH } from '../domain/chart-of-accounts.js';
import { LedgerIntegrityService } from '../ledger-integrity.service.js';
import { LedgerService } from '../ledger.service.js';

/**
 * The test that matters.
 *
 * A ledger that balances when one request runs at a time proves nothing — the conditions under
 * which a bank actually loses money are payday, month end, and a burst of card authorisations,
 * all of which mean many writes against one account at the same instant.
 *
 * Requires the local MongoDB replica set (`pnpm infra:up`). It is a real database test on
 * purpose: the behaviour under examination is Mongo's write-conflict handling, which a mock
 * cannot reproduce.
 */
describe('ledger under concurrency', () => {
  let app: INestApplication;
  let ledger: LedgerService;
  let accounts: AccountsService;
  let integrity: LedgerIntegrityService;
  let accountId: string;

  const CURRENCY = 'USD' as const;
  const OPENING_MINOR_UNITS = 1_000_000; // 10,000.00
  const CONCURRENT_POSTINGS = 200;
  const POSTING_MINOR_UNITS = 250; // 2.50 each

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();

    ledger = app.get(LedgerService);
    accounts = app.get(AccountsService);
    integrity = app.get(LedgerIntegrityService);

    const account = await accounts.open({
      customerId: newId(),
      productCode: 'ICB-CURRENT',
      productName: 'Concurrency test account',
      kind: 'current',
      currency: CURRENCY,
    });
    accountId = account.id;

    await ledger.post({
      type: 'deposit',
      description: 'Opening balance',
      actor: { kind: 'system', id: null, label: 'test' },
      lines: [
        {
          accountRef: glRef(GL_CASH),
          direction: 'debit',
          amount: fromMinorUnits(OPENING_MINOR_UNITS, CURRENCY),
        },
        {
          accountRef: customerRef(accountId),
          direction: 'credit',
          amount: fromMinorUnits(OPENING_MINOR_UNITS, CURRENCY),
        },
      ],
    });
  }, 60_000);

  afterAll(async () => {
    await app?.close();
  });

  it(`keeps the ledger exact across ${CONCURRENT_POSTINGS} simultaneous postings`, async () => {
    const amount = fromMinorUnits(POSTING_MINOR_UNITS, CURRENCY);

    const results = await Promise.allSettled(
      Array.from({ length: CONCURRENT_POSTINGS }, (_unused, index) =>
        ledger.post({
          type: 'card_purchase',
          description: `Concurrent posting ${index}`,
          actor: { kind: 'system', id: null, label: 'test' },
          lines: [
            { accountRef: customerRef(accountId), direction: 'debit', amount },
            { accountRef: glRef(GL_CASH), direction: 'credit', amount },
          ],
        }),
      ),
    );

    const settled = results.filter((result) => result.status === 'fulfilled');

    // Every posting must land. A dropped write here is a payment a customer made that the bank
    // has no record of — the failure mode this whole test exists to rule out.
    expect(settled).toHaveLength(CONCURRENT_POSTINGS);

    const balance = await ledger.getBalance(customerRef(accountId), CURRENCY);
    expect(balance.minorUnits).toBe(
      OPENING_MINOR_UNITS - CONCURRENT_POSTINGS * POSTING_MINOR_UNITS,
    );
  }, 180_000);

  it('leaves every invariant intact afterwards', async () => {
    const report = await integrity.verify();

    for (const check of report.checks) {
      expect(check.passed, `${check.name}: ${check.detail}`).toBe(true);
    }
    expect(report.balanced).toBe(true);
    expect(report.driftDetected).toHaveLength(0);
  }, 120_000);

  it('refuses an unbalanced transaction rather than writing half of it', async () => {
    const before = await ledger.getBalance(customerRef(accountId), CURRENCY);

    await expect(
      ledger.post({
        type: 'adjustment',
        description: 'Deliberately unbalanced',
        actor: { kind: 'system', id: null, label: 'test' },
        lines: [
          {
            accountRef: customerRef(accountId),
            direction: 'debit',
            amount: fromMinorUnits(500, CURRENCY),
          },
          {
            accountRef: glRef(GL_CASH),
            direction: 'credit',
            amount: fromMinorUnits(400, CURRENCY),
          },
        ],
      }),
    ).rejects.toThrow();

    const after = await ledger.getBalance(customerRef(accountId), CURRENCY);
    expect(after.minorUnits).toBe(before.minorUnits);
  }, 60_000);

  it('reverses by mirroring, leaving both transactions on the record', async () => {
    const amount = fromMinorUnits(7_500, CURRENCY);
    const before = await ledger.getBalance(customerRef(accountId), CURRENCY);

    const original = await ledger.post({
      type: 'card_purchase',
      description: 'To be reversed',
      actor: { kind: 'system', id: null, label: 'test' },
      lines: [
        { accountRef: customerRef(accountId), direction: 'debit', amount },
        { accountRef: glRef(GL_CASH), direction: 'credit', amount },
      ],
    });

    const afterPost = await ledger.getBalance(customerRef(accountId), CURRENCY);
    expect(afterPost.minorUnits).toBe(before.minorUnits - amount.minorUnits);

    const reversal = await ledger.reverse(original.id, 'Duplicate charge', {
      kind: 'staff',
      id: null,
      label: 'test',
    });

    expect(reversal.id).not.toBe(original.id);

    const afterReversal = await ledger.getBalance(customerRef(accountId), CURRENCY);
    expect(afterReversal.minorUnits).toBe(before.minorUnits);

    // Reversing twice must be impossible; the second attempt is a conflict, not a second credit.
    await expect(
      ledger.reverse(original.id, 'Again', { kind: 'staff', id: null, label: 'test' }),
    ).rejects.toThrow();
  }, 90_000);
});
