import { describe, expect, it } from 'vitest';

import { toBeneficiary, toBeneficiaryVerification } from '../infrastructure/beneficiary.mapper.js';
import { BENEFICIARY_ID, NOW, beneficiaryDoc } from './fixtures.js';

const LATER = new Date(NOW.getTime() + 3_600_000);

describe('toBeneficiary', () => {
  it('serialises lastUsedAt when the payee has been used', () => {
    const result = toBeneficiary(beneficiaryDoc({ lastUsedAt: LATER }));

    expect(result.lastUsedAt).toBe(LATER.toISOString());
  });
});

describe('toBeneficiaryVerification', () => {
  it('serialises depositsSentAt and verifiedAt when both are set', () => {
    const doc = beneficiaryDoc({
      verificationState: 'verified',
      depositsSentAt: NOW,
      verifiedAt: LATER,
    });

    const result = toBeneficiaryVerification(doc);

    expect(result).toEqual({
      beneficiaryId: BENEFICIARY_ID,
      state: 'verified',
      attemptsRemaining: 3,
      depositsSentAt: NOW.toISOString(),
      verifiedAt: LATER.toISOString(),
    });
  });

  it('maps unset timestamps to null and clamps a negative attempt budget', () => {
    const doc = beneficiaryDoc({ verificationAttemptsRemaining: -1 });

    const result = toBeneficiaryVerification(doc);

    expect(result.depositsSentAt).toBeNull();
    expect(result.verifiedAt).toBeNull();
    expect(result.attemptsRemaining).toBe(0);
  });
});
