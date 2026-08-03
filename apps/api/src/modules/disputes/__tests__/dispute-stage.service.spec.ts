import type { DisputeOutcome, DisputeStage } from '@icb/contracts';
import { describe, expect, it, vi } from 'vitest';
import type { Model } from 'mongoose';

import { ConflictError, ValidationError } from '../../../common/errors/index.js';
import { ClockService } from '../../../simulation/clock/clock.service.js';
import type { DisputeCreditService } from '../../risk/application/dispute-credit.service.js';
import {
  DisputeStageService,
  type AdvanceDisputeRequest,
  type StaffActor,
} from '../../risk/application/dispute-stage.service.js';
import type { DisputeDoc, ProvisionalCreditSub } from '../../risk/infrastructure/dispute.schemas.js';

/**
 * Guarded transitions and outcome-to-money mapping (implementation lives in the risk module).
 * The credit service is mocked, so these tests pin *which* money operation each transition and
 * outcome selects — the posting shapes themselves are covered in dispute-credit.service.spec.
 */
const NOW = new Date('2026-08-02T12:00:00.000Z');
const STAFF: StaffActor = { id: 'staff-1', label: 'Fraud analyst' };

const LIVE_CREDIT: ProvisionalCreditSub = {
  minorUnits: 12_345,
  currency: 'GBP',
  transactionId: 'txn-credit-1',
  grantedAt: NOW,
  clawbackTransactionId: null,
  clawedBackAt: null,
};

function dispute(overrides: Partial<DisputeDoc> = {}): DisputeDoc {
  return {
    _id: 'dsp-1',
    reference: 'DSP-ABC123XY',
    accountId: 'acct-42',
    reason: 'unauthorised',
    stage: 'investigating',
    outcome: null,
    provisionalCredit: null,
    resolvedAt: null,
    assignedTo: null,
    ...overrides,
  } as DisputeDoc;
}

function setup(doc: DisputeDoc) {
  const model = {
    findById: vi.fn(() => ({ lean: vi.fn().mockResolvedValue(doc) })),
    updateOne: vi.fn().mockResolvedValue({ acknowledged: true }),
  };
  const credits = {
    grant: vi.fn().mockResolvedValue(LIVE_CREDIT),
    clawBack: vi.fn().mockResolvedValue({ ...LIVE_CREDIT, clawedBackAt: NOW }),
  };
  const clock = new ClockService();
  clock.freeze(NOW);
  const service = new DisputeStageService(
    model as unknown as Model<DisputeDoc>,
    credits as unknown as DisputeCreditService,
    clock,
  );
  return { model, credits, service };
}

function advance(stage: DisputeStage, outcome?: DisputeOutcome): AdvanceDisputeRequest {
  return { stage, note: 'Moving the case along', ...(outcome === undefined ? {} : { outcome }) };
}

describe('guarded transitions', () => {
  it('refuses an illegal jump and touches neither money nor storage', async () => {
    const { model, credits, service } = setup(dispute({ stage: 'submitted' }));

    await expect(service.advance('dsp-1', STAFF, advance('arbitration'))).rejects.toThrow(
      ConflictError,
    );
    expect(credits.grant).not.toHaveBeenCalled();
    expect(credits.clawBack).not.toHaveBeenCalled();
    expect(model.updateOne).not.toHaveBeenCalled();
  });

  it('writes the new stage and appends to the timeline on a legal move', async () => {
    const { model, service } = setup(dispute({ stage: 'submitted' }));

    await service.advance('dsp-1', STAFF, advance('investigating'));

    expect(model.updateOne).toHaveBeenCalledOnce();
    const [filter, update] = model.updateOne.mock.calls[0] as [
      Record<string, unknown>,
      { $set: Record<string, unknown>; $push: { timeline: Record<string, unknown> } },
    ];
    expect(filter).toEqual({ _id: 'dsp-1' });
    expect(update.$set).toMatchObject({ stage: 'investigating', updatedAt: NOW });
    expect(update.$push.timeline).toMatchObject({ at: NOW, stage: 'investigating' });
  });

  it('demands an outcome when resolving', async () => {
    const { model, service } = setup(dispute());

    await expect(service.advance('dsp-1', STAFF, advance('resolved'))).rejects.toThrow(
      ValidationError,
    );
    expect(model.updateOne).not.toHaveBeenCalled();
  });

  it('refuses provisional credit for a reason that does not qualify', async () => {
    const { credits, service } = setup(dispute({ reason: 'goods_not_received' }));

    await expect(service.advance('dsp-1', STAFF, advance('provisional_credit'))).rejects.toThrow(
      ConflictError,
    );
    expect(credits.grant).not.toHaveBeenCalled();
  });
});

describe('outcome GL mapping', () => {
  it('grants provisional credit on entering the provisional_credit stage', async () => {
    const { credits, service } = setup(dispute());

    await service.advance('dsp-1', STAFF, advance('provisional_credit'));

    expect(credits.grant).toHaveBeenCalledOnce();
  });

  it('resolved + upheld with no prior credit grants it — the loss moves to GL 5100', async () => {
    const { credits, service } = setup(dispute({ stage: 'arbitration' }));

    await service.advance('dsp-1', STAFF, advance('resolved', 'upheld'));

    expect(credits.grant).toHaveBeenCalledOnce();
    expect(credits.clawBack).not.toHaveBeenCalled();
  });

  it('resolved + upheld with a live credit leaves it standing', async () => {
    const { credits, service } = setup(
      dispute({ stage: 'arbitration', provisionalCredit: LIVE_CREDIT }),
    );

    await service.advance('dsp-1', STAFF, advance('resolved', 'upheld'));

    expect(credits.grant).not.toHaveBeenCalled();
    expect(credits.clawBack).not.toHaveBeenCalled();
  });

  it('resolved + partial keeps a live credit but never creates one', async () => {
    const withCredit = setup(dispute({ stage: 'arbitration', provisionalCredit: LIVE_CREDIT }));
    await withCredit.service.advance('dsp-1', STAFF, advance('resolved', 'partial'));
    expect(withCredit.credits.grant).not.toHaveBeenCalled();
    expect(withCredit.credits.clawBack).not.toHaveBeenCalled();

    const withoutCredit = setup(dispute({ stage: 'arbitration' }));
    await withoutCredit.service.advance('dsp-1', STAFF, advance('resolved', 'partial'));
    expect(withoutCredit.credits.grant).not.toHaveBeenCalled();
    expect(withoutCredit.credits.clawBack).not.toHaveBeenCalled();
  });

  it.each(['rejected', 'withdrawn'] as const)(
    'resolved + %s claws a live credit back through a ledger reversal',
    async (outcome) => {
      const { credits, service } = setup(
        dispute({ stage: 'arbitration', provisionalCredit: LIVE_CREDIT }),
      );

      await service.advance('dsp-1', STAFF, advance('resolved', outcome));

      expect(credits.clawBack).toHaveBeenCalledOnce();
      expect(credits.grant).not.toHaveBeenCalled();
    },
  );

  it('resolved + rejected with no credit taken posts nothing', async () => {
    const { credits, service } = setup(dispute({ stage: 'arbitration' }));

    await service.advance('dsp-1', STAFF, advance('resolved', 'rejected'));

    expect(credits.grant).not.toHaveBeenCalled();
    expect(credits.clawBack).not.toHaveBeenCalled();
  });

  it('stamps resolvedAt and the outcome when the terminal stage is written', async () => {
    const { model, service } = setup(dispute({ stage: 'arbitration' }));

    await service.advance('dsp-1', STAFF, advance('resolved', 'upheld'));

    const [, update] = model.updateOne.mock.calls[0] as [
      unknown,
      { $set: Record<string, unknown> },
    ];
    expect(update.$set).toMatchObject({
      stage: 'resolved',
      outcome: 'upheld',
      resolvedAt: NOW,
    });
  });
});
