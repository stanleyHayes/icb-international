import type { KycLevel } from '@icb/contracts';

import { PRODUCTS } from '../../simulation/seed/seed.data.js';
import type { RateChange } from './domain/rate-schedule.js';
import type { ProductLimitRow } from './domain/limit-matrix.js';
import type { FeeDefinition } from './domain/fee-calculation.js';
import type { EligibilityRules } from './domain/eligibility.js';

/** Seed defaults. The demo bank is USD-first; KYC floor is tier 1 for every product. */
export const DEFAULT_CURRENCY = 'USD';
export const BASE_KYC_LEVEL: KycLevel = 'tier_1';
export const ADULT_MINIMUM_AGE = 18;

/** Marketing copy for the two seeded products, keyed by product code. */
const SEED_COPY: Readonly<Record<string, { tagline: string; description: string; features: string[] }>> = {
  'ICB-CURRENT': {
    tagline: 'Everyday banking without the fine print',
    description:
      'A full-featured current account with an optional overdraft, instant internal transfers, and no monthly fee.',
    features: ['No monthly fee', 'Optional overdraft', 'Instant internal transfers', 'Debit card ready'],
  },
  'ICB-SAVINGS': {
    tagline: 'Watch your reserve grow',
    description:
      'An interest-bearing savings account with interest accrued daily and paid monthly, and no withdrawal penalties.',
    features: ['Interest accrued daily', 'Paid monthly', 'No withdrawal penalties', 'No minimum balance'],
  },
};

const FALLBACK_COPY = { tagline: '', description: '', features: [] as string[] };

export interface CatalogueSeedDocument {
  readonly code: string;
  readonly name: string;
  readonly tagline: string;
  readonly description: string;
  readonly kind: string;
  readonly currencies: readonly string[];
  readonly interestRate: number | null;
  readonly interestBands: null;
  readonly rateSchedule: readonly RateChange[];
  readonly minimumOpeningBalanceMinorUnits: number | null;
  readonly minimumBalanceMinorUnits: number | null;
  readonly monthlyFeeMinorUnits: number | null;
  readonly fees: readonly FeeDefinition[];
  readonly features: readonly string[];
  readonly eligibility: EligibilityRules;
  readonly limits: readonly ProductLimitRow[];
  readonly depositTerms: readonly [];
  readonly loanRateRange: null;
  readonly active: boolean;
  readonly displayOrder: number;
  readonly version: number;
}

const DEFAULT_ELIGIBILITY: EligibilityRules = {
  minimumAge: ADULT_MINIMUM_AGE,
  minimumKycLevel: BASE_KYC_LEVEL,
  residentsOnly: false,
  businessOnly: false,
};

function seedLimits(overdraftMinorUnits: number): ProductLimitRow[] {
  return [{ kycLevel: BASE_KYC_LEVEL, overdraftMinorUnits, ...OPEN_LIMITS }];
}

const OPEN_LIMITS = {
  singleTransactionMinorUnits: null,
  dailyMinorUnits: null,
  monthlyMinorUnits: null,
  maxBalanceMinorUnits: null,
} as const;

/**
 * The initial catalogue, derived from the hardcoded products in `simulation/seed/seed.data.ts`
 * (owned by SIM-04 — read here, never edited). The seed data only pins code, name, kind, rate,
 * and overdraft; everything else is a catalogue default defined here.
 */
export function buildCatalogueSeed(): CatalogueSeedDocument[] {
  return PRODUCTS.map((product, index) => {
    const copy = SEED_COPY[product.code] ?? FALLBACK_COPY;
    return {
      code: product.code,
      name: product.name,
      ...copy,
      kind: product.kind,
      currencies: [DEFAULT_CURRENCY],
      interestRate: product.interestRate,
      interestBands: null,
      rateSchedule: [],
      minimumOpeningBalanceMinorUnits: null,
      minimumBalanceMinorUnits: null,
      monthlyFeeMinorUnits: null,
      fees: [],
      eligibility: DEFAULT_ELIGIBILITY,
      limits: seedLimits(product.overdraft),
      depositTerms: [],
      loanRateRange: null,
      active: true,
      displayOrder: index + 1,
      version: 1,
    };
  });
}
