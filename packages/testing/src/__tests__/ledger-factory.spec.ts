import { describe, expect, it } from 'vitest';

import { createFactoryContext } from '../core/context.js';
import { UnbalancedPostingError } from '../errors.js';
import { ledgerTransaction } from '../factories/ledger.factory.js';

const ctx = createFactoryContext({ seed: 11 });

describe('ledgerTransaction', () => {
  it('builds a balanced default deposit', () => {
    const txn = ledgerTransaction(ctx);
    expect(txn.entries).toHaveLength(2);
    const [debit, credit] = txn.entries;
    expect(debit?.direction).toBe('debit');
    expect(credit?.direction).toBe('credit');
    expect(debit?.minorUnits).toBe(credit?.minorUnits);
    expect(txn.status).toBe('posted');
  });

  it('links every entry to its transaction with a unique sequence', () => {
    const txn = ledgerTransaction(ctx);
    txn.entries.forEach((entry, index) => {
      expect(entry.transactionId).toBe(txn._id);
      expect(entry.sequence).toBe(index);
      expect(entry.transactionType).toBe(txn.type);
    });
  });

  it('signs entries relative to the account normal side', () => {
    const txn = ledgerTransaction(ctx, {
      lines: [
        { accountRef: 'gl:1000', direction: 'debit', minorUnits: 500, normalSide: 'debit' },
        { accountRef: 'acct:ABC', direction: 'credit', minorUnits: 500 },
      ],
    });
    expect(txn.entries[0]?.signedMinorUnits).toBe(500);
    expect(txn.entries[1]?.signedMinorUnits).toBe(500);
  });

  it('rejects an unbalanced posting with a typed error (N4)', () => {
    const attempt = (): unknown =>
      ledgerTransaction(ctx, {
        lines: [
          { accountRef: 'gl:1000', direction: 'debit', minorUnits: 500 },
          { accountRef: 'acct:ABC', direction: 'credit', minorUnits: 400 },
        ],
      });
    expect(attempt).toThrow(UnbalancedPostingError);
    expect(attempt).toThrow(/debits 500 != credits 400/);
  });

  it('is deterministic for a given seed', () => {
    const first = ledgerTransaction(createFactoryContext({ seed: 42 }));
    const second = ledgerTransaction(createFactoryContext({ seed: 42 }));
    expect(first).toEqual(second);
  });
});
