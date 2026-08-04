import type { Model } from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ConflictError, NotFoundError } from '../../../common/errors/index.js';
import { type TransactionManager } from '../../../infrastructure/database/transaction.manager.js';
import { ClockService } from '../../../simulation/clock/clock.service.js';
import { type HoldService } from '../../ledger/hold.service.js';
import { type LedgerService } from '../../ledger/ledger.service.js';
import { CardCaptureService } from '../application/card-capture.service.js';
import type { CardAuthorisationDoc } from '../infrastructure/card-authorisation.schemas.js';
import { AUTHORISATION_ID, CARD_ID, NOW, authorisationDoc, chainQuery } from './fixtures.js';

const REASON = 'Merchant confirmed the sale is abandoned';

function setup(authorisation: CardAuthorisationDoc | null) {
  const model = {
    // The first read is the guard in `loadApproved`; the second is the reload after the write.
    findById: vi
      .fn()
      .mockReturnValueOnce(chainQuery(authorisation))
      .mockReturnValue(chainQuery(authorisation ? { ...authorisation, status: 'expired' } : null)),
    updateOne: vi.fn().mockResolvedValue({ matchedCount: 1 }),
  };
  const ledger = { postWithin: vi.fn() };
  const holds = { release: vi.fn().mockResolvedValue(undefined) };
  const transactionManager = {
    withTransaction: vi.fn((work: (session: unknown) => Promise<unknown>) => work({ id: 's' })),
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
  return { service, model, holds, transactionManager };
}

describe('CardCaptureService.expireForCard', () => {
  let deps: ReturnType<typeof setup>;

  beforeEach(() => {
    deps = setup(authorisationDoc());
  });

  it('releases the hold with the staff reason and marks the authorisation expired', async () => {
    const result = await deps.service.expireForCard(CARD_ID, AUTHORISATION_ID, REASON);

    expect(deps.holds.release).toHaveBeenCalledWith('hold-1', REASON, { id: 's' });
    expect(deps.model.updateOne).toHaveBeenCalledWith(
      { _id: AUTHORISATION_ID, status: 'approved' },
      { $set: { status: 'expired' } },
      { session: { id: 's' } },
    );
    expect(result.status).toBe('expired');
    expect(result.id).toBe(AUTHORISATION_ID);
  });

  it('reports an authorisation on another card as not found and touches nothing', async () => {
    const { service, model, holds } = setup(authorisationDoc({ cardId: 'another-card' }));

    await expect(service.expireForCard(CARD_ID, AUTHORISATION_ID, REASON)).rejects.toThrow(
      NotFoundError,
    );
    expect(holds.release).not.toHaveBeenCalled();
    expect(model.updateOne).not.toHaveBeenCalled();
  });

  it('throws a typed not-found for an unknown authorisation', async () => {
    const { service, holds } = setup(null);

    await expect(service.expireForCard(CARD_ID, AUTHORISATION_ID, REASON)).rejects.toThrow(
      NotFoundError,
    );
    expect(holds.release).not.toHaveBeenCalled();
  });

  it('refuses to expire an authorisation that already settled', async () => {
    const { service, model, holds } = setup(authorisationDoc({ status: 'captured' }));

    await expect(service.expireForCard(CARD_ID, AUTHORISATION_ID, REASON)).rejects.toThrow(
      ConflictError,
    );
    expect(holds.release).not.toHaveBeenCalled();
    expect(model.updateOne).not.toHaveBeenCalled();
  });
});
