import { KYC_CHECK_KINDS } from '@icb/contracts';
import { describe, expect, it } from 'vitest';

import { deriveRiskRating, runChecks, type CheckSubject } from '../check-runner.js';
import { getLimitsFor, listTierLimits } from '../tier-limits.js';
import { nameSimilarity, screenName, WATCHLIST } from '../watchlist.js';

const AT = '2026-08-02T10:00:00.000Z';

function subject(overrides: Partial<CheckSubject> = {}): CheckSubject {
  return {
    customerId: '01JZ8QY3N7K4M2P9R5T6V8W0XA',
    customerName: 'Amara Mensah',
    customerType: 'individual',
    documentTypes: ['passport', 'selfie', 'proof_of_address'],
    completedAt: AT,
    ...overrides,
  };
}

describe('runChecks', () => {
  it('is deterministic for the same customer', () => {
    expect(runChecks(subject())).toEqual(runChecks(subject()));
  });

  it('gives different customers independent outcomes', () => {
    const a = runChecks(subject());
    const b = runChecks(subject({ customerId: '01JZ8QY3N7K4M2P9R5T6V8W0XB' }));
    expect(a).not.toEqual(b);
  });

  it('runs every identity check for an individual and adds the registry for a business', () => {
    const individual = runChecks(subject()).map((check) => check.kind);
    const business = runChecks(
      subject({ customerType: 'business', customerName: 'Northwind Trading' }),
    ).map((check) => check.kind);

    expect(individual).not.toContain('business_registry');
    expect(individual).toHaveLength(KYC_CHECK_KINDS.length - 1);
    expect(business).toHaveLength(KYC_CHECK_KINDS.length);
    expect(business).toContain('business_registry');
  });

  it('refers rather than fails when the evidence is missing', () => {
    const checks = runChecks(subject({ documentTypes: [] }));
    const faceMatch = checks.find((check) => check.kind === 'face_match');

    expect(faceMatch?.outcome).toBe('refer');
    expect(faceMatch?.score).toBeNull();
    expect(faceMatch?.detail).toContain('selfie');
  });

  it('always reports a detail and a completion time', () => {
    for (const check of runChecks(subject())) {
      expect(check.detail).toBeTruthy();
      expect(check.completedAt).toBe(AT);
    }
  });

  it('fails screening for a name on the watchlist', () => {
    const listed = WATCHLIST[0];
    if (!listed) {
      throw new Error('watchlist is empty');
    }
    const checks = runChecks(subject({ customerName: listed.name }));
    const sanctions = checks.find((check) => check.kind === 'sanctions_screening');

    expect(sanctions?.outcome).toBe('fail');
    expect(sanctions?.detail).toContain(listed.programme);
    expect(deriveRiskRating(checks)).toBe('high');
  });

  it('clears a name that is not on either list', () => {
    const checks = runChecks(subject({ customerName: 'Amara Mensah' }));
    const screening = checks.filter((check) => check.kind.endsWith('_screening'));

    expect(screening).toHaveLength(2);
    for (const check of screening) {
      expect(check.outcome).toBe('pass');
    }
  });

  /** The demo has to be usable: most customers must sail through. */
  it('passes the great majority of a synthetic population', () => {
    const outcomes = Array.from({ length: 200 }, (_, index) =>
      runChecks(subject({ customerId: `01JZ8QY3N7K4M2P9R5T6V8W${String(index).padStart(3, '0')}` })),
    );
    const clean = outcomes.filter((checks) =>
      checks.every((check) => check.outcome === 'pass'),
    ).length;

    // Most clear automatically; enough are referred that the review queue is never empty.
    expect(clean).toBeGreaterThan(120);
    expect(clean).toBeLessThan(190);
  });
});

describe('deriveRiskRating', () => {
  it('escalates on the worst outcome present', () => {
    expect(deriveRiskRating([])).toBe('low');
    expect(
      deriveRiskRating([
        { kind: 'liveness', outcome: 'pass', score: 0.9, detail: null, completedAt: AT },
        { kind: 'adverse_media', outcome: 'refer', score: 0.5, detail: null, completedAt: AT },
      ]),
    ).toBe('medium');
    expect(
      deriveRiskRating([
        { kind: 'adverse_media', outcome: 'refer', score: 0.5, detail: null, completedAt: AT },
        { kind: 'liveness', outcome: 'fail', score: 0.1, detail: null, completedAt: AT },
      ]),
    ).toBe('high');
  });
});

describe('watchlist matching', () => {
  it('is insensitive to case, diacritics, punctuation and name order', () => {
    expect(nameSimilarity('Viktor Anatoly Rusanov', 'rusanov, viktor anatoly')).toBe(1);
    expect(nameSimilarity('Rosalia Ximena Berrocal', 'Rosalía Ximena Berrocal')).toBe(1);
  });

  it('tolerates a transliteration slip', () => {
    const hit = screenName('Nikolay Petrovich Zvonarev', 'sanctions');
    expect(hit?.entry.country).toBe('RU');
    expect(hit?.similarity).toBeGreaterThan(0.9);
  });

  it('does not confuse two different people', () => {
    expect(screenName('Kwame Boateng', 'sanctions')).toBeNull();
    expect(screenName('Lena Fischer', 'pep')).toBeNull();
  });

  it('separates the two lists', () => {
    const pep = WATCHLIST.find((entry) => entry.kind === 'pep');
    expect(pep).toBeDefined();
    expect(screenName(pep?.name ?? '', 'sanctions')).toBeNull();
  });
});

describe('tier limits', () => {
  it('holds an unverified customer to tier 1', () => {
    expect(getLimitsFor(null)).toEqual(getLimitsFor('tier_1'));
  });

  it('states the tiers in USD minor units', () => {
    expect(getLimitsFor('tier_1').singleTransfer).toEqual({
      minorUnits: 50_000,
      currency: 'USD',
      scale: 2,
    });
    expect(getLimitsFor('tier_1').maxBalance?.minorUnits).toBe(1_000_000);
    expect(getLimitsFor('tier_2').maxBalance).toBeNull();
    expect(getLimitsFor('tier_3').monthlyTransfer.minorUnits).toBe(100_000_000);
  });

  it('gates international transfers on tier 3 alone', () => {
    expect(listTierLimits().filter((tier) => tier.internationalAllowed)).toHaveLength(1);
    expect(getLimitsFor('tier_3').internationalAllowed).toBe(true);
  });
});
