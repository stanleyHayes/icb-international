import type { Model } from 'mongoose';
import { describe, expect, it, vi } from 'vitest';

import { ConflictError } from '../../../common/errors/index.js';
import type { AppConfiguration } from '../../../config/configuration.js';
import { ClockService } from '../../../simulation/clock/clock.service.js';
import type { LedgerService } from '../../ledger/ledger.service.js';
import { type BeneficiariesService } from '../beneficiaries.service.js';
import { BeneficiaryVerificationService } from '../beneficiary-verification.service.js';
import {
  MicroDepositLockedError,
  MicroDepositMismatchError,
} from '../domain/beneficiary-errors.js';
import { generateMicroDeposits, hashMicroDeposits } from '../domain/micro-deposit.js';
import type { BeneficiaryDoc } from '../infrastructure/beneficiary.schemas.js';
import {
  ACCOUNT_ID,
  BENEFICIARY_ID,
  CUSTOMER_ID,
  NOW,
  beneficiaryDoc,
  chainQuery,
} from './fixtures.js';

const HMAC_KEY = 'test-hmac-key';
const CONFIG = {
  simulation: { seed: 'test-seed' },
  crypto: { fieldEncryptionKey: HMAC_KEY },
} as unknown as AppConfiguration;

const AMOUNTS = { first: 12, second: 34 };
const HASH = hashMicroDeposits(HMAC_KEY, BENEFICIARY_ID, AMOUNTS);

function sentDoc(overrides: Partial<BeneficiaryDoc> = {}): BeneficiaryDoc {
  return beneficiaryDoc({
    verificationState: 'deposits_sent',
    verificationHash: HASH,
    depositsSentAt: NOW,
    ...overrides,
  });
}

function setup(doc: BeneficiaryDoc, updated: BeneficiaryDoc | null = doc) {
  const model = {
    findOneAndUpdate: vi.fn().mockReturnValue(chainQuery(updated)),
    updateOne: vi.fn().mockResolvedValue({ acknowledged: true }),
  };
  const payees = { loadOwned: vi.fn().mockResolvedValue(doc) };
  const ledger = { post: vi.fn().mockResolvedValue({ id: 'txn-1' }) };
  const clock = new ClockService();
  clock.freeze(NOW);

  const service = new BeneficiaryVerificationService(
    model as unknown as Model<BeneficiaryDoc>,
    payees as unknown as BeneficiariesService,
    ledger as unknown as LedgerService,
    clock,
    CONFIG,
  );
  return { service, model, payees, ledger };
}

type UpdateCall = [unknown, { $set: Record<string, unknown> }];

describe('BeneficiaryVerificationService.status', () => {
  it('maps the owned payee to its verification view', async () => {
    const { service } = setup(beneficiaryDoc());

    const status = await service.status(CUSTOMER_ID, BENEFICIARY_ID);

    expect(status).toEqual({
      beneficiaryId: BENEFICIARY_ID,
      state: 'not_started',
      attemptsRemaining: 3,
      depositsSentAt: null,
      verifiedAt: null,
    });
  });
});

describe('BeneficiaryVerificationService.sendMicroDeposits', () => {
  it('records the hashed amounts without posting to an external destination', async () => {
    const { service, model, ledger } = setup(beneficiaryDoc());

    await service.sendMicroDeposits(CUSTOMER_ID, BENEFICIARY_ID);

    expect(ledger.post).not.toHaveBeenCalled();
    const [filter, update] = model.findOneAndUpdate.mock.calls[0] as UpdateCall;
    expect(filter).toEqual({ _id: BENEFICIARY_ID, customerId: CUSTOMER_ID });
    expect(update.$set['verificationState']).toBe('deposits_sent');
    expect(update.$set['depositsSentAt']).toEqual(NOW);
    expect(update.$set['microDepositTransactionIds']).toEqual([]);
    const drawn = generateMicroDeposits(`test-seed:${BENEFICIARY_ID}:${NOW.getTime()}`);
    expect(update.$set['verificationHash']).toBe(
      hashMicroDeposits(HMAC_KEY, BENEFICIARY_ID, drawn),
    );
  });

  it('posts both deposits against fraud losses for an ICB-held destination', async () => {
    const doc = beneficiaryDoc({ icbAccountId: ACCOUNT_ID, currency: 'GBP' });
    const { service, model, ledger } = setup(doc);
    ledger.post
      .mockResolvedValueOnce({ id: 'txn-a' })
      .mockResolvedValueOnce({ id: 'txn-b' });

    await service.sendMicroDeposits(CUSTOMER_ID, BENEFICIARY_ID);

    expect(ledger.post).toHaveBeenCalledTimes(2);
    const [command] = ledger.post.mock.calls[0] as [
      { lines: Array<Record<string, unknown>>; sourceType: string; sourceId: string },
    ];
    expect(command.sourceType).toBe('beneficiary_verification');
    expect(command.sourceId).toBe(BENEFICIARY_ID);
    expect(command.lines[0]).toMatchObject({ accountRef: 'gl:5100', direction: 'debit' });
    expect(command.lines[1]).toMatchObject({
      accountRef: `acct:${ACCOUNT_ID}`,
      direction: 'credit',
      amount: { currency: 'GBP' },
    });
    const [, update] = model.findOneAndUpdate.mock.calls[0] as UpdateCall;
    expect(update.$set['microDepositTransactionIds']).toEqual(['txn-a', 'txn-b']);
  });

  it('skips posting when the stored currency is not a real code', async () => {
    const doc = beneficiaryDoc({ icbAccountId: ACCOUNT_ID, currency: 'XXX' });
    const { service, model, ledger } = setup(doc);

    await service.sendMicroDeposits(CUSTOMER_ID, BENEFICIARY_ID);

    expect(ledger.post).not.toHaveBeenCalled();
    const [, update] = model.findOneAndUpdate.mock.calls[0] as UpdateCall;
    expect(update.$set['microDepositTransactionIds']).toEqual([]);
  });

  it('falls back to the loaded doc when the update returns nothing', async () => {
    const { service } = setup(beneficiaryDoc(), null);

    const result = await service.sendMicroDeposits(CUSTOMER_ID, BENEFICIARY_ID);

    expect(result.state).toBe('not_started');
  });

  it('refuses to send to an already-verified payee', async () => {
    const { service, model } = setup(beneficiaryDoc({ verified: true }));

    await expect(service.sendMicroDeposits(CUSTOMER_ID, BENEFICIARY_ID)).rejects.toBeInstanceOf(
      ConflictError,
    );
    expect(model.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('refuses to send when the state is locked', async () => {
    const { service } = setup(sentDoc({ verificationState: 'locked' }));

    await expect(service.sendMicroDeposits(CUSTOMER_ID, BENEFICIARY_ID)).rejects.toBeInstanceOf(
      MicroDepositLockedError,
    );
  });

  it('refuses to send when the attempt budget is exhausted without a locked state', async () => {
    const { service } = setup(sentDoc({ verificationAttemptsRemaining: 0 }));

    await expect(service.sendMicroDeposits(CUSTOMER_ID, BENEFICIARY_ID)).rejects.toBeInstanceOf(
      MicroDepositLockedError,
    );
  });
});

describe('BeneficiaryVerificationService.confirm', () => {
  it('requires deposits to have been sent first', async () => {
    const { service } = setup(beneficiaryDoc());

    await expect(service.confirm(CUSTOMER_ID, BENEFICIARY_ID, AMOUNTS)).rejects.toBeInstanceOf(
      ConflictError,
    );
  });

  it('records a failed attempt and reports the remaining budget on a mismatch', async () => {
    const { service, model } = setup(sentDoc());

    const attempt = service.confirm(CUSTOMER_ID, BENEFICIARY_ID, { first: 1, second: 2 });

    await expect(attempt).rejects.toBeInstanceOf(MicroDepositMismatchError);
    await expect(attempt).rejects.toMatchObject({
      context: { beneficiaryId: BENEFICIARY_ID, attemptsRemaining: 2 },
    });
    expect(model.updateOne).toHaveBeenCalledWith(
      { _id: BENEFICIARY_ID },
      { $set: { verificationAttemptsRemaining: 2, verificationState: 'failed' } },
    );
  });

  it('locks the payee and drops the digest on the final wrong answer', async () => {
    const { service, model } = setup(sentDoc({ verificationAttemptsRemaining: 1 }));

    const attempt = service.confirm(CUSTOMER_ID, BENEFICIARY_ID, { first: 1, second: 2 });

    await expect(attempt).rejects.toBeInstanceOf(MicroDepositLockedError);
    expect(model.updateOne).toHaveBeenCalledWith(
      { _id: BENEFICIARY_ID },
      {
        $set: {
          verificationAttemptsRemaining: 0,
          verificationState: 'locked',
          verificationHash: null,
        },
      },
    );
  });

  it('verifies the payee and erases the digest on a match', async () => {
    const updated = sentDoc({ verified: true, verificationState: 'verified', verifiedAt: NOW });
    const { service, model } = setup(sentDoc(), updated);

    const result = await service.confirm(CUSTOMER_ID, BENEFICIARY_ID, AMOUNTS);

    expect(model.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: BENEFICIARY_ID },
      {
        $set: {
          verified: true,
          verificationState: 'verified',
          verifiedAt: NOW,
          verificationHash: null,
        },
      },
      { new: true },
    );
    expect(result.state).toBe('verified');
    expect(result.verifiedAt).toBe(NOW.toISOString());
  });

  it('falls back to the loaded doc when the success update returns nothing', async () => {
    const { service } = setup(sentDoc(), null);

    const result = await service.confirm(CUSTOMER_ID, BENEFICIARY_ID, AMOUNTS);

    expect(result.state).toBe('deposits_sent');
  });

  it('refuses to confirm an already-verified payee', async () => {
    const { service } = setup(sentDoc({ verified: true }));

    await expect(service.confirm(CUSTOMER_ID, BENEFICIARY_ID, AMOUNTS)).rejects.toBeInstanceOf(
      ConflictError,
    );
  });
});

describe('BeneficiaryVerificationService.maximumAttempts', () => {
  it('exposes the attempt budget', () => {
    expect(BeneficiaryVerificationService.maximumAttempts).toBe(3);
  });
});
