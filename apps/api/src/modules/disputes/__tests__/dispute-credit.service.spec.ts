import { describe, expect, it, vi } from 'vitest';

import { ConflictError } from '../../../common/errors/index.js';
import { ClockService } from '../../../simulation/clock/clock.service.js';
import { DisputeCreditService } from '../../risk/application/dispute-credit.service.js';
import type { LedgerService } from '../../ledger/ledger.service.js';
import type { PostingActor, PostingCommand } from '../../ledger/domain/posting.types.js';
import type { DisputeDoc } from '../../risk/infrastructure/dispute.schemas.js';

/**
 * Provisional credit and clawback posting shapes (implementation lives in the risk module).
 * The assertions that matter: the bank's loss always lands on GL 5100 as the debit leg, the
 * customer account is always the credit leg, the two legs balance, and a clawback is a ledger
 * reversal of the original posting — never a deletion, never a fresh opposite entry.
 */
const NOW = new Date('2026-08-02T12:00:00.000Z');
const ACTOR: PostingActor = { kind: 'staff', id: 'staff-1', label: 'Fraud analyst' };

function dispute(overrides: Partial<DisputeDoc> = {}): DisputeDoc {
  return {
    _id: 'dsp-1',
    reference: 'DSP-ABC123XY',
    accountId: 'acct-42',
    amountMinorUnits: 12_345,
    currency: 'GBP',
    reason: 'unauthorised',
    provisionalCredit: null,
    ...overrides,
  } as DisputeDoc;
}

function setup() {
  const ledger = {
    post: vi.fn().mockResolvedValue({ id: 'txn-credit-1' }),
    reverse: vi.fn().mockResolvedValue({ id: 'txn-reversal-1' }),
  };
  const clock = new ClockService();
  clock.freeze(NOW);
  const service = new DisputeCreditService(ledger as unknown as LedgerService, clock);
  return { ledger, service };
}

describe('grant', () => {
  it('posts debit GL 5100 / credit customer account, balanced in the disputed amount', async () => {
    const { ledger, service } = setup();

    await service.grant(dispute(), ACTOR);

    expect(ledger.post).toHaveBeenCalledOnce();
    const command = ledger.post.mock.calls[0]?.[0] as PostingCommand;
    expect(command.type).toBe('adjustment');
    expect(command.sourceType).toBe('dispute');
    expect(command.sourceId).toBe('dsp-1');
    expect(command.reference).toMatch(/^PCR-/);
    expect(command.actor).toEqual(ACTOR);

    const [debit, creditLine] = command.lines;
    expect(debit).toMatchObject({
      accountRef: 'gl:5100',
      direction: 'debit',
      amount: { minorUnits: 12_345, currency: 'GBP' },
    });
    expect(creditLine).toMatchObject({
      accountRef: 'acct:acct-42',
      direction: 'credit',
      amount: { minorUnits: 12_345, currency: 'GBP' },
    });
    expect(command.lines).toHaveLength(2);
  });

  it('returns the credit sub-document anchored to the posting and the clock', async () => {
    const { service } = setup();

    const credit = await service.grant(dispute(), ACTOR);

    expect(credit).toEqual({
      minorUnits: 12_345,
      currency: 'GBP',
      transactionId: 'txn-credit-1',
      grantedAt: NOW,
      clawbackTransactionId: null,
      clawedBackAt: null,
    });
  });

  it('refuses a second grant while a live credit exists', async () => {
    const { ledger, service } = setup();
    const live = dispute({
      provisionalCredit: {
        minorUnits: 12_345,
        currency: 'GBP',
        transactionId: 'txn-credit-0',
        grantedAt: NOW,
        clawbackTransactionId: null,
        clawedBackAt: null,
      },
    });

    await expect(service.grant(live, ACTOR)).rejects.toThrow(ConflictError);
    expect(ledger.post).not.toHaveBeenCalled();
  });

  it('allows a fresh grant after the previous credit was clawed back', async () => {
    const { ledger, service } = setup();
    const regranted = dispute({
      provisionalCredit: {
        minorUnits: 12_345,
        currency: 'GBP',
        transactionId: 'txn-credit-0',
        grantedAt: NOW,
        clawbackTransactionId: 'txn-reversal-0',
        clawedBackAt: NOW,
      },
    });

    await service.grant(regranted, ACTOR);

    expect(ledger.post).toHaveBeenCalledOnce();
  });
});

describe('clawBack', () => {
  const credited = dispute({
    provisionalCredit: {
      minorUnits: 12_345,
      currency: 'GBP',
      transactionId: 'txn-credit-1',
      grantedAt: NOW,
      clawbackTransactionId: null,
      clawedBackAt: null,
    },
  });

  it('reverses the original credit posting rather than writing a new opposite entry', async () => {
    const { ledger, service } = setup();

    const result = await service.clawBack(credited, 'Dispute DSP-ABC123XY rejected', ACTOR);

    expect(ledger.reverse).toHaveBeenCalledWith('txn-credit-1', 'Dispute DSP-ABC123XY rejected', ACTOR);
    expect(ledger.post).not.toHaveBeenCalled();
    expect(result).toEqual({
      minorUnits: 12_345,
      currency: 'GBP',
      transactionId: 'txn-credit-1',
      grantedAt: NOW,
      clawbackTransactionId: 'txn-reversal-1',
      clawedBackAt: NOW,
    });
  });

  it('refuses to claw back a credit that was never granted', async () => {
    const { service } = setup();

    await expect(service.clawBack(dispute(), 'no credit', ACTOR)).rejects.toThrow(ConflictError);
  });

  it('is idempotent against an already-clawed-back credit', async () => {
    const { ledger, service } = setup();
    const alreadyClawed = dispute({
      provisionalCredit: {
        minorUnits: 12_345,
        currency: 'GBP',
        transactionId: 'txn-credit-1',
        grantedAt: NOW,
        clawbackTransactionId: 'txn-reversal-0',
        clawedBackAt: NOW,
      },
    });

    const result = await service.clawBack(alreadyClawed, 'again', ACTOR);

    expect(result.clawbackTransactionId).toBe('txn-reversal-0');
    expect(ledger.reverse).not.toHaveBeenCalled();
  });
});
