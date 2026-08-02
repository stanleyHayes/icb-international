import type { LoanProduct } from '@icb/contracts';
import { fromMinorUnits, type CurrencyCode, type Money } from '@icb/money';

import { NotFoundError } from '../../../common/errors/index.js';
import { toMoneyDto } from '../../accounts/infrastructure/account.mapper.js';

/**
 * ICB's lending catalogue.
 *
 * Held in code rather than the database because pricing is a *policy* decision that belongs under
 * review and version control: an amount band or an early-repayment fee that can be edited in a
 * collection is an amount band nobody can reconstruct six months later during a complaint.
 */

const CATALOGUE_CURRENCY: CurrencyCode = 'USD';

interface ProductSpec {
  readonly code: string;
  readonly name: string;
  readonly description: string;
  readonly minimum: number;
  readonly maximum: number;
  readonly minimumTermMonths: number;
  readonly maximumTermMonths: number;
  readonly fromRate: number;
  readonly toRate: number;
  readonly arrangementFeePercent: number;
  readonly earlyRepaymentFeePercent: number;
  readonly requiresCollateral: boolean;
}

function toProduct(spec: ProductSpec): LoanProduct {
  return {
    code: spec.code,
    name: spec.name,
    description: spec.description,
    currency: CATALOGUE_CURRENCY,
    minimumAmount: toMoneyDto(spec.minimum, CATALOGUE_CURRENCY),
    maximumAmount: toMoneyDto(spec.maximum, CATALOGUE_CURRENCY),
    minimumTermMonths: spec.minimumTermMonths,
    maximumTermMonths: spec.maximumTermMonths,
    fromRate: spec.fromRate,
    toRate: spec.toRate,
    arrangementFeePercent: spec.arrangementFeePercent,
    earlyRepaymentFeePercent: spec.earlyRepaymentFeePercent,
    requiresCollateral: spec.requiresCollateral,
  };
}

const SPECS: readonly ProductSpec[] = [
  {
    code: 'PERSONAL_STANDARD',
    name: 'Personal Loan',
    description: 'An unsecured loan for planned spending, repaid over a fixed term.',
    minimum: 100_000,
    maximum: 5_000_000,
    minimumTermMonths: 6,
    maximumTermMonths: 84,
    fromRate: 7.9,
    toRate: 19.9,
    arrangementFeePercent: 1,
    earlyRepaymentFeePercent: 1,
    requiresCollateral: false,
  },
  {
    code: 'DEBT_CONSOLIDATION',
    name: 'Consolidation Loan',
    description: 'Replaces several higher-cost commitments with one fixed monthly repayment.',
    minimum: 100_000,
    maximum: 4_000_000,
    minimumTermMonths: 12,
    maximumTermMonths: 72,
    fromRate: 8.9,
    toRate: 21.9,
    arrangementFeePercent: 1.25,
    earlyRepaymentFeePercent: 1,
    requiresCollateral: false,
  },
  {
    code: 'VEHICLE_FINANCE',
    name: 'Vehicle Finance',
    description: 'Secured against the vehicle, priced below an equivalent unsecured loan.',
    minimum: 500_000,
    maximum: 12_000_000,
    minimumTermMonths: 12,
    maximumTermMonths: 84,
    fromRate: 5.9,
    toRate: 13.9,
    arrangementFeePercent: 0.75,
    earlyRepaymentFeePercent: 0.5,
    requiresCollateral: true,
  },
  {
    code: 'HOME_IMPROVEMENT',
    name: 'Home Improvement Loan',
    description: 'Longer terms for renovation and extension work on a property you own.',
    minimum: 200_000,
    maximum: 7_500_000,
    minimumTermMonths: 12,
    maximumTermMonths: 120,
    fromRate: 6.4,
    toRate: 15.9,
    arrangementFeePercent: 1,
    earlyRepaymentFeePercent: 1,
    requiresCollateral: false,
  },
  {
    code: 'BUSINESS_TERM',
    name: 'Business Term Loan',
    description: 'Working capital and expansion funding for an incorporated business.',
    minimum: 1_000_000,
    maximum: 50_000_000,
    minimumTermMonths: 12,
    maximumTermMonths: 120,
    fromRate: 8.4,
    toRate: 17.9,
    arrangementFeePercent: 1.5,
    earlyRepaymentFeePercent: 1.5,
    requiresCollateral: true,
  },
];

const PRODUCTS: readonly LoanProduct[] = SPECS.map(toProduct);
const BY_CODE = new Map(PRODUCTS.map((product) => [product.code, product]));

export function listLoanProducts(): readonly LoanProduct[] {
  return PRODUCTS;
}

export function getLoanProduct(code: string): LoanProduct {
  const product = BY_CODE.get(code);
  if (!product) {
    throw new NotFoundError('Loan product', code);
  }
  return product;
}

/** The product's amount band as `Money`, so callers compare without re-deriving the scale. */
export function amountBand(product: LoanProduct): { minimum: Money; maximum: Money } {
  const currency = product.currency;
  return {
    minimum: fromMinorUnits(product.minimumAmount.minorUnits, currency),
    maximum: fromMinorUnits(product.maximumAmount.minorUnits, currency),
  };
}
