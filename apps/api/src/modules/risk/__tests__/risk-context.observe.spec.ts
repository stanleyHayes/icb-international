import type { Model } from 'mongoose';
import { describe, expect, it, vi } from 'vitest';

import { ClockService } from '../../../simulation/clock/clock.service.js';
import type { AccountDoc } from '../../accounts/infrastructure/account.schemas.js';
import type { CustomerDoc } from '../../customers/infrastructure/customer.schemas.js';
import type { LedgerEntryDoc } from '../../ledger/infrastructure/ledger.schemas.js';
import {
  RiskContextService,
  type ContextRequest,
} from '../application/risk-context.service.js';
import type { RiskProfileDoc } from '../infrastructure/risk-rule.schemas.js';
import { CUSTOMER_ID, NOW } from './fixtures.js';

function setup() {
  const profileModel = { updateOne: vi.fn().mockResolvedValue({ matchedCount: 1 }) };
  const clock = new ClockService();
  clock.freeze(NOW);

  const service = new RiskContextService(
    {} as unknown as Model<AccountDoc>,
    {} as unknown as Model<LedgerEntryDoc>,
    {} as unknown as Model<CustomerDoc>,
    profileModel as unknown as Model<RiskProfileDoc>,
    clock,
  );
  return { service, profileModel };
}

function request(signals: ContextRequest['signals']): ContextRequest {
  return { customerId: CUSTOMER_ID, amountMinorUnits: 125_000, currency: 'GBP', signals };
}

describe('RiskContextService.observe', () => {
  it('folds the device, beneficiary and country into the baseline and bumps the count', async () => {
    const { service, profileModel } = setup();

    await service.observe(
      request({ deviceId: 'device-9', beneficiaryId: 'ben-9', countryCode: 'NG' }),
    );

    expect(profileModel.updateOne).toHaveBeenCalledWith(
      { customerId: CUSTOMER_ID },
      {
        $set: { lastAssessedAt: NOW, lastCountryCode: 'NG', lastCountryAt: NOW },
        $inc: { assessmentCount: 1 },
        $addToSet: { knownDeviceIds: 'device-9', knownBeneficiaryIds: 'ben-9' },
        $setOnInsert: { _id: expect.any(String), customerId: CUSTOMER_ID },
      },
      { upsert: true },
    );
  });

  it('omits the $addToSet operator entirely when no device or beneficiary was seen', async () => {
    const { service, profileModel } = setup();

    await service.observe(request({ countryCode: 'GH' }));

    expect(profileModel.updateOne).toHaveBeenCalledWith(
      { customerId: CUSTOMER_ID },
      {
        $set: { lastAssessedAt: NOW, lastCountryCode: 'GH', lastCountryAt: NOW },
        $inc: { assessmentCount: 1 },
        $setOnInsert: { _id: expect.any(String), customerId: CUSTOMER_ID },
      },
      { upsert: true },
    );
  });

  it('does not backfill a country when the event carried none', async () => {
    const { service, profileModel } = setup();

    await service.observe(request({ deviceId: 'device-9' }));

    expect(profileModel.updateOne).toHaveBeenCalledWith(
      { customerId: CUSTOMER_ID },
      {
        $set: { lastAssessedAt: NOW },
        $inc: { assessmentCount: 1 },
        $addToSet: { knownDeviceIds: 'device-9' },
        $setOnInsert: { _id: expect.any(String), customerId: CUSTOMER_ID },
      },
      { upsert: true },
    );
  });
});
