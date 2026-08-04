import { fromMinorUnits } from '@icb/money';
import type { Model } from 'mongoose';
import { describe, expect, it, vi } from 'vitest';

import { ClockService } from '../../../simulation/clock/clock.service.js';
import type { BeneficiaryTargetResolver } from '../application/beneficiary-target.resolver.js';
import { BeneficiariesService } from '../beneficiaries.service.js';
import {
  BeneficiaryCoolingOffError,
  BeneficiaryUnverifiedError,
} from '../domain/beneficiary-errors.js';
import type { BeneficiaryDoc } from '../infrastructure/beneficiary.schemas.js';
import { BENEFICIARY_ID, CUSTOMER_ID, NOW, beneficiaryDoc, chainQuery } from './fixtures.js';

const PAST = new Date(NOW.getTime() - 3_600_000);
const UNDER_COOLING_CAP = fromMinorUnits(10_000, 'GBP'); // exactly £100, the cap
const OVER_COOLING_CAP = fromMinorUnits(10_001, 'GBP');
const UNDER_UNVERIFIED_CAP = fromMinorUnits(100_000, 'GBP'); // exactly £1,000, the cap
const OVER_UNVERIFIED_CAP = fromMinorUnits(100_001, 'GBP');

function setup(doc: BeneficiaryDoc | null = null) {
  const chain = chainQuery({ acknowledged: true });
  const model = {
    findOne: vi.fn().mockReturnValue(chainQuery(doc)),
    updateOne: vi.fn().mockReturnValue(chain),
  };
  const targets = { resolve: vi.fn() };
  const clock = new ClockService();
  clock.freeze(NOW);

  const service = new BeneficiariesService(
    model as unknown as Model<BeneficiaryDoc>,
    targets as unknown as BeneficiaryTargetResolver,
    clock,
  );
  return { service, model, chain };
}

describe('BeneficiariesService.loadOwned', () => {
  it('loads by id alone when no customer scope is given (internal callers)', async () => {
    const { service, model } = setup(beneficiaryDoc());

    const doc = await service.loadOwned(BENEFICIARY_ID);

    expect(model.findOne).toHaveBeenCalledWith({ _id: BENEFICIARY_ID });
    expect(doc._id).toBe(BENEFICIARY_ID);
  });
});

describe('BeneficiariesService.assertUsable', () => {
  it('allows a payment at the cooling-off cap for a fresh payee', async () => {
    const { service } = setup(beneficiaryDoc());

    const doc = await service.assertUsable(BENEFICIARY_ID, UNDER_COOLING_CAP, CUSTOMER_ID);

    expect(doc._id).toBe(BENEFICIARY_ID);
  });

  it('caps a payment over the cooling-off ceiling while the window is open', async () => {
    const { service } = setup(beneficiaryDoc({ verified: true }));

    const attempt = service.assertUsable(BENEFICIARY_ID, OVER_COOLING_CAP, CUSTOMER_ID);

    await expect(attempt).rejects.toBeInstanceOf(BeneficiaryCoolingOffError);
    await expect(attempt).rejects.toMatchObject({
      context: { beneficiaryId: BENEFICIARY_ID, capMinorUnits: 10_000, currency: 'GBP' },
    });
  });

  it('allows an unverified payee at the unverified cap once cooling-off has passed', async () => {
    const { service } = setup(beneficiaryDoc({ coolingOffUntil: PAST }));

    const doc = await service.assertUsable(BENEFICIARY_ID, UNDER_UNVERIFIED_CAP, CUSTOMER_ID);

    expect(doc._id).toBe(BENEFICIARY_ID);
  });

  it('caps an unverified payee over the unverified ceiling once cooling-off has passed', async () => {
    const { service } = setup(beneficiaryDoc({ coolingOffUntil: PAST }));

    const attempt = service.assertUsable(BENEFICIARY_ID, OVER_UNVERIFIED_CAP, CUSTOMER_ID);

    await expect(attempt).rejects.toBeInstanceOf(BeneficiaryUnverifiedError);
    await expect(attempt).rejects.toMatchObject({
      context: { beneficiaryId: BENEFICIARY_ID, capMinorUnits: 100_000, currency: 'GBP' },
    });
  });

  it('allows a verified payee any amount once cooling-off has passed', async () => {
    const { service } = setup(beneficiaryDoc({ verified: true, coolingOffUntil: PAST }));

    const doc = await service.assertUsable(BENEFICIARY_ID, OVER_UNVERIFIED_CAP, CUSTOMER_ID);

    expect(doc.verified).toBe(true);
  });
});

describe('BeneficiariesService.recordUsage', () => {
  it('joins the caller session when one is supplied', async () => {
    const { service, model, chain } = setup();
    const session = { id: 'session-1' };

    await service.recordUsage(BENEFICIARY_ID, session as never);

    expect(model.updateOne).toHaveBeenCalledWith(
      { _id: BENEFICIARY_ID },
      { $inc: { useCount: 1 }, $set: { lastUsedAt: NOW } },
    );
    expect(chain.session).toHaveBeenCalledWith(session);
  });

  it('runs standalone when no session is supplied', async () => {
    const { service, chain } = setup();

    await service.recordUsage(BENEFICIARY_ID);

    expect(chain.session).not.toHaveBeenCalled();
  });
});
