import type { Model } from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ConflictError, NotFoundError } from '../../../common/errors/index.js';
import { type TransactionManager } from '../../../infrastructure/database/transaction.manager.js';
import { ClockService } from '../../../simulation/clock/clock.service.js';
import { type HoldService } from '../../ledger/hold.service.js';
import { type LedgerService } from '../../ledger/ledger.service.js';
import { CardCaptureService } from '../application/card-capture.service.js';
import type { CardAuthorisationDoc } from '../infrastructure/card-authorisation.schemas.js';
import { ACCOUNT_ID, AUTHORISATION_ID, NOW, authorisationDoc, chainQuery } from './fixtures.js';

const SESSION = { id: 's' };
const LOCK = { lockKeys: [`balance:acct:${ACCOUNT_ID}:USD`] };

function setup(authorisation: CardAuthorisationDoc | null, matchedCount = 1) {
  const model = {
    // The first read is the guard in `loadApproved`; the second is the reload after the write.
    findById: vi
      .fn()
      .mockReturnValueOnce(chainQuery(authorisation))
      .mockReturnValue(chainQuery(authorisation ? { ...authorisation, status: 'captured' } : null)),
    updateOne: vi.fn().mockResolvedValue({ matchedCount }),
  };
  const ledger = { postWithin: vi.fn().mockResolvedValue({ id: 'txn-1' }) };
  const holds = { release: vi.fn().mockResolvedValue(undefined) };
  const transactionManager = {
    withTransaction: vi.fn((work: (session: unknown) => Promise<unknown>) => work(SESSION)),
  };
  const clock = new ClockService();
  clock.freeze(NOW);

  const service = new CardCaptureService(
    model as unknown as Model<CardAuthorisationDoc>,
    ledger as unknown as LedgerService,
    holds as unknown as HoldService,
    transactionManager as unknown as TransactionManager,
    clock,
  );
  return { service, model, ledger, holds, transactionManager };
}

describe('CardCaptureService.capture', () => {
  let deps: ReturnType<typeof setup>;

  beforeEach(() => {
    deps = setup(authorisationDoc());
  });

  it('captures the full authorised amount when no amount is given', async () => {
    const result = await deps.service.capture(AUTHORISATION_ID);

    expect(deps.holds.release).toHaveBeenCalledWith(
      'hold-1',
      'Card authorisation captured',
      SESSION,
    );
    expect(deps.model.updateOne).toHaveBeenCalledWith(
      { _id: AUTHORISATION_ID, status: 'approved' },
      {
        $set: {
          status: 'captured',
          capturedMinorUnits: 25_000,
          billingMinorUnits: 25_000,
          capturedAt: NOW,
          transactionId: 'txn-1',
        },
      },
      { session: SESSION },
    );
    expect(deps.transactionManager.withTransaction).toHaveBeenCalledWith(
      expect.any(Function),
      LOCK,
    );
    expect(result.status).toBe('captured');
  });

  it('posts a purchase debiting the customer and crediting card settlement', async () => {
    await deps.service.capture(AUTHORISATION_ID, 10_000);

    expect(deps.ledger.postWithin).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'card_purchase',
        sourceType: 'card',
        metadata: { authorisationId: AUTHORISATION_ID, arn: 'ARN123', mcc: '5411' },
        lines: [
          expect.objectContaining({
            accountRef: `acct:${ACCOUNT_ID}`,
            direction: 'debit',
            narrative: 'Shoprite Accra',
          }),
          expect.objectContaining({
            accountRef: 'gl:1200',
            direction: 'credit',
            narrative: 'Card settlement ARN123',
          }),
        ],
      }),
      SESSION,
    );
    expect(deps.model.updateOne).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        $set: expect.objectContaining({ capturedMinorUnits: 10_000 }),
      }),
      expect.anything(),
    );
  });

  it('settles an ATM authorisation as a cash withdrawal', async () => {
    const { service, ledger } = setup(authorisationDoc({ channel: 'atm' }));

    await service.capture(AUTHORISATION_ID);

    expect(ledger.postWithin).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'atm_withdrawal' }),
      SESSION,
    );
  });

  it('falls back to the authorisation id in the narrative when no ARN was issued', async () => {
    const { service, ledger } = setup(authorisationDoc({ arn: null }));

    await service.capture(AUTHORISATION_ID);

    expect(ledger.postWithin).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({ arn: '' }),
        lines: [
          expect.anything(),
          expect.objectContaining({ narrative: `Card settlement ${AUTHORISATION_ID}` }),
        ],
      }),
      SESSION,
    );
  });

  it('settles without touching the hold service when no hold was placed', async () => {
    const { service, holds, model } = setup(authorisationDoc({ holdId: null }));

    await service.capture(AUTHORISATION_ID);

    expect(holds.release).not.toHaveBeenCalled();
    expect(model.updateOne).toHaveBeenCalled();
  });

  it.each([0, -500, 10.5])('rejects a non-positive or fractional capture of %i', async (amount) => {
    await expect(deps.service.capture(AUTHORISATION_ID, amount)).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
    });
    expect(deps.transactionManager.withTransaction).not.toHaveBeenCalled();
  });

  it('refuses a capture above the authorised amount', async () => {
    await expect(deps.service.capture(AUTHORISATION_ID, 25_001)).rejects.toThrow(ConflictError);
    expect(deps.transactionManager.withTransaction).not.toHaveBeenCalled();
  });

  it('aborts when a concurrent request settled the authorisation first', async () => {
    const { service, transactionManager } = setup(authorisationDoc(), 0);

    await expect(service.capture(AUTHORISATION_ID)).rejects.toThrow(ConflictError);
    expect(transactionManager.withTransaction).toHaveBeenCalled();
  });

  it('throws a typed not-found for an unknown authorisation', async () => {
    const { service, transactionManager } = setup(null);

    await expect(service.capture(AUTHORISATION_ID)).rejects.toThrow(NotFoundError);
    expect(transactionManager.withTransaction).not.toHaveBeenCalled();
  });

  it('refuses to capture an authorisation that was already reversed', async () => {
    const { service, transactionManager } = setup(authorisationDoc({ status: 'reversed' }));

    await expect(service.capture(AUTHORISATION_ID)).rejects.toThrow(ConflictError);
    expect(transactionManager.withTransaction).not.toHaveBeenCalled();
  });
});
