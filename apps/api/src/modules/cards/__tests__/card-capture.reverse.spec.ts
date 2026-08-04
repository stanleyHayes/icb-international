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

function setup(authorisation: CardAuthorisationDoc | null, matchedCount = 1) {
  const model = {
    // The first read is the guard in `loadApproved`; the second is the reload after the write.
    findById: vi
      .fn()
      .mockReturnValueOnce(chainQuery(authorisation))
      .mockReturnValue(chainQuery(authorisation ? { ...authorisation, status: 'reversed' } : null)),
    updateOne: vi.fn().mockResolvedValue({ matchedCount }),
  };
  const ledger = { postWithin: vi.fn() };
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

describe('CardCaptureService.reverse', () => {
  let deps: ReturnType<typeof setup>;

  beforeEach(() => {
    deps = setup(authorisationDoc());
  });

  it('releases the hold and marks the authorisation reversed without posting anything', async () => {
    const result = await deps.service.reverse(AUTHORISATION_ID);

    expect(deps.holds.release).toHaveBeenCalledWith(
      'hold-1',
      'Card authorisation reversed',
      SESSION,
    );
    // A reversal of an unsettled authorisation is not a ledger event.
    expect(deps.ledger.postWithin).not.toHaveBeenCalled();
    expect(deps.model.updateOne).toHaveBeenCalledWith(
      { _id: AUTHORISATION_ID, status: 'approved' },
      { $set: { status: 'reversed', reversedAt: NOW } },
      { session: SESSION },
    );
    expect(deps.transactionManager.withTransaction).toHaveBeenCalledWith(expect.any(Function), {
      lockKeys: [`balance:acct:${ACCOUNT_ID}:USD`],
    });
    expect(result.status).toBe('reversed');
  });

  it('reverses without touching the hold service when no hold was placed', async () => {
    const { service, holds, model } = setup(authorisationDoc({ holdId: null }));

    await service.reverse(AUTHORISATION_ID);

    expect(holds.release).not.toHaveBeenCalled();
    expect(model.updateOne).toHaveBeenCalled();
  });

  it('aborts when a concurrent request settled the authorisation first', async () => {
    const { service } = setup(authorisationDoc(), 0);

    await expect(service.reverse(AUTHORISATION_ID)).rejects.toThrow(ConflictError);
  });

  it('throws a typed not-found for an unknown authorisation', async () => {
    const { service, holds } = setup(null);

    await expect(service.reverse(AUTHORISATION_ID)).rejects.toThrow(NotFoundError);
    expect(holds.release).not.toHaveBeenCalled();
  });

  it('refuses to reverse an authorisation that already captured', async () => {
    const { service, holds, model } = setup(authorisationDoc({ status: 'captured' }));

    await expect(service.reverse(AUTHORISATION_ID)).rejects.toThrow(ConflictError);
    expect(holds.release).not.toHaveBeenCalled();
    expect(model.updateOne).not.toHaveBeenCalled();
  });
});
