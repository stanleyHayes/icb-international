import type { BeneficiaryVerification } from '@icb/contracts';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { BeneficiaryVerificationController } from '../beneficiary-verification.controller.js';
import type { BeneficiaryVerificationService } from '../beneficiary-verification.service.js';

const CUSTOMER_ID = 'cust-1';
const BENEFICIARY_ID = 'ben-1';
const VERIFICATION = {
  beneficiaryId: BENEFICIARY_ID,
  status: 'pending',
} as unknown as BeneficiaryVerification;

function setup() {
  const verification = {
    sendMicroDeposits: vi.fn().mockResolvedValue(VERIFICATION),
    confirm: vi.fn().mockResolvedValue(VERIFICATION),
    status: vi.fn().mockResolvedValue(VERIFICATION),
  };
  const controller = new BeneficiaryVerificationController(
    verification as unknown as BeneficiaryVerificationService,
  );
  return { controller, verification };
}

describe('BeneficiaryVerificationController', () => {
  let deps: ReturnType<typeof setup>;

  beforeEach(() => {
    deps = setup();
  });

  it('sends micro-deposits for the token customer and path beneficiary', async () => {
    const result = await deps.controller.send(CUSTOMER_ID, BENEFICIARY_ID);

    expect(deps.verification.sendMicroDeposits).toHaveBeenCalledWith(CUSTOMER_ID, BENEFICIARY_ID);
    expect(result).toBe(VERIFICATION);
  });

  it('maps the contract amount fields onto the service call', async () => {
    const body = { firstAmountMinorUnits: 12, secondAmountMinorUnits: 34 };

    const result = await deps.controller.confirm(CUSTOMER_ID, BENEFICIARY_ID, body);

    expect(deps.verification.confirm).toHaveBeenCalledWith(CUSTOMER_ID, BENEFICIARY_ID, {
      first: 12,
      second: 34,
    });
    expect(result).toBe(VERIFICATION);
  });

  it('reports verification status for the owning customer', async () => {
    const result = await deps.controller.status(CUSTOMER_ID, BENEFICIARY_ID);

    expect(deps.verification.status).toHaveBeenCalledWith(CUSTOMER_ID, BENEFICIARY_ID);
    expect(result).toBe(VERIFICATION);
  });

  it('propagates service failures (exhausted attempts) untouched', async () => {
    const failure = new Error('verification attempts exhausted');
    deps.verification.confirm.mockRejectedValue(failure);

    await expect(
      deps.controller.confirm(CUSTOMER_ID, BENEFICIARY_ID, {
        firstAmountMinorUnits: 1,
        secondAmountMinorUnits: 2,
      }),
    ).rejects.toBe(failure);
  });
});
