import type { BillerCategory } from '@icb/contracts';

/**
 * The biller directory ICB ships with.
 *
 * This is deliberately data rather than code: a biller is a row, and adding one is an edit here
 * plus a restart, not a new class. Each entry carries three things the payment path genuinely
 * needs and which differ between real billers:
 *
 *  - `referenceLabel` / `referencePattern` — what the customer's identifier with this biller is
 *    called and what it looks like. "Meter number" and "Policy number" are not interchangeable,
 *    and validating the shape up front stops a payment vanishing into an unknown account.
 *  - `supportsBalanceEnquiry` — prepaid vending and tax payments have no balance to fetch. Autopay
 *    on a full balance is impossible for those, and the rule is enforced rather than hoped for.
 *  - `feeMinorUnits` / `failureRate` — the two commercial facts that vary per biller. Both are
 *    stored on the document, so an operator can retune either without a deploy.
 */

export interface BillerSeed {
  readonly code: string;
  readonly name: string;
  readonly category: BillerCategory;
  readonly referenceLabel: string;
  readonly referencePattern: string | null;
  readonly supportsBalanceEnquiry: boolean;
  readonly minimumAmountMinorUnits: number | null;
  /** Flat convenience fee ICB charges for routing to this biller. Zero where none is charged. */
  readonly feeMinorUnits: number;
  /** Probability the biller rejects a payment it has already been debited for. */
  readonly failureRate: number;
  /** Anchor for the simulated balance enquiry; real bills vary around it month to month. */
  readonly typicalBillMinorUnits: number;
}

export const BILLER_LOGO_BASE_URL = 'https://assets.icb.example/billers/';

const METER_NUMBER = 'Meter number';
const ACCOUNT_NUMBER = 'Account number';
const PHONE_NUMBER = 'Phone number';
const SUBSCRIBER_ID = 'Subscriber ID';
const POLICY_NUMBER = 'Policy number';

const TEN_DIGITS = String.raw`^\d{10}$`;
const ELEVEN_DIGITS = String.raw`^\d{11}$`;
const LOCAL_PHONE = String.raw`^0\d{9}$`;

export const BILLER_DIRECTORY: readonly BillerSeed[] = [
  {
    code: 'NATIONAL_GRID_POSTPAID',
    name: 'National Grid Power — Postpaid',
    category: 'electricity',
    referenceLabel: METER_NUMBER,
    referencePattern: TEN_DIGITS,
    supportsBalanceEnquiry: true,
    minimumAmountMinorUnits: 500,
    feeMinorUnits: 100,
    failureRate: 0.02,
    typicalBillMinorUnits: 18_500,
  },
  {
    code: 'NATIONAL_GRID_PREPAID',
    name: 'National Grid Power — Prepaid Top-up',
    category: 'electricity',
    referenceLabel: METER_NUMBER,
    referencePattern: ELEVEN_DIGITS,
    supportsBalanceEnquiry: false,
    minimumAmountMinorUnits: 500,
    feeMinorUnits: 100,
    failureRate: 0.04,
    typicalBillMinorUnits: 6000,
  },
  {
    code: 'CITY_WATER_SEWERAGE',
    name: 'City Water & Sewerage',
    category: 'water',
    referenceLabel: ACCOUNT_NUMBER,
    referencePattern: String.raw`^[A-Z]{2}\d{8}$`,
    supportsBalanceEnquiry: true,
    minimumAmountMinorUnits: 500,
    feeMinorUnits: 100,
    failureRate: 0.03,
    typicalBillMinorUnits: 7400,
  },
  {
    code: 'FIBRELINK_BROADBAND',
    name: 'FibreLink Home Broadband',
    category: 'internet',
    referenceLabel: ACCOUNT_NUMBER,
    referencePattern: String.raw`^FL\d{8}$`,
    supportsBalanceEnquiry: true,
    minimumAmountMinorUnits: null,
    feeMinorUnits: 0,
    failureRate: 0.01,
    typicalBillMinorUnits: 42_000,
  },
  {
    code: 'SKYWAVE_WIRELESS',
    name: 'Skywave Wireless Internet',
    category: 'internet',
    referenceLabel: SUBSCRIBER_ID,
    referencePattern: String.raw`^\d{9}$`,
    supportsBalanceEnquiry: false,
    minimumAmountMinorUnits: 1000,
    feeMinorUnits: 0,
    failureRate: 0.02,
    typicalBillMinorUnits: 25_000,
  },
  {
    code: 'CELLONE_AIRTIME',
    name: 'CellOne Airtime Top-up',
    category: 'mobile',
    referenceLabel: PHONE_NUMBER,
    referencePattern: LOCAL_PHONE,
    supportsBalanceEnquiry: false,
    minimumAmountMinorUnits: 100,
    feeMinorUnits: 0,
    failureRate: 0.01,
    typicalBillMinorUnits: 2000,
  },
  {
    code: 'CELLONE_POSTPAID',
    name: 'CellOne Postpaid Mobile',
    category: 'mobile',
    referenceLabel: PHONE_NUMBER,
    referencePattern: LOCAL_PHONE,
    supportsBalanceEnquiry: true,
    minimumAmountMinorUnits: null,
    feeMinorUnits: 50,
    failureRate: 0.02,
    typicalBillMinorUnits: 12_500,
  },
  {
    code: 'STARVIEW_SATELLITE',
    name: 'StarView Satellite TV',
    category: 'tv',
    referenceLabel: 'Smartcard number',
    referencePattern: String.raw`^\d{10,11}$`,
    supportsBalanceEnquiry: true,
    minimumAmountMinorUnits: null,
    feeMinorUnits: 150,
    failureRate: 0.02,
    typicalBillMinorUnits: 29_900,
  },
  {
    code: 'STREAMPLUS_MEDIA',
    name: 'StreamPlus Media Subscription',
    category: 'tv',
    referenceLabel: SUBSCRIBER_ID,
    referencePattern: String.raw`^SP\d{7}$`,
    supportsBalanceEnquiry: true,
    minimumAmountMinorUnits: null,
    feeMinorUnits: 0,
    failureRate: 0.01,
    typicalBillMinorUnits: 5500,
  },
  {
    code: 'SENTINEL_LIFE_ASSURANCE',
    name: 'Sentinel Life Assurance',
    category: 'insurance',
    referenceLabel: POLICY_NUMBER,
    referencePattern: String.raw`^SL-\d{8}$`,
    supportsBalanceEnquiry: true,
    minimumAmountMinorUnits: 1000,
    feeMinorUnits: 200,
    failureRate: 0.02,
    typicalBillMinorUnits: 15_000,
  },
  {
    code: 'MERIDIAN_UNIVERSITY',
    name: 'Meridian University — Tuition',
    category: 'education',
    referenceLabel: 'Student ID',
    referencePattern: String.raw`^\d{8}$`,
    supportsBalanceEnquiry: true,
    minimumAmountMinorUnits: 5000,
    feeMinorUnits: 250,
    failureRate: 0.03,
    typicalBillMinorUnits: 250_000,
  },
  {
    code: 'REVENUE_AUTHORITY_TAX',
    name: 'Revenue Authority — Tax Payment',
    category: 'government',
    referenceLabel: 'Tax identification number',
    referencePattern: String.raw`^[A-Z]\d{10}$`,
    supportsBalanceEnquiry: false,
    minimumAmountMinorUnits: 1000,
    feeMinorUnits: 300,
    failureRate: 0.03,
    typicalBillMinorUnits: 120_000,
  },
  {
    code: 'HARBOUR_ESTATES_RENT',
    name: 'Harbour Estates Property Rent',
    category: 'rent',
    referenceLabel: 'Tenancy reference',
    referencePattern: String.raw`^TEN-\d{6}$`,
    supportsBalanceEnquiry: true,
    minimumAmountMinorUnits: 10_000,
    feeMinorUnits: 250,
    failureRate: 0.01,
    typicalBillMinorUnits: 180_000,
  },
  {
    code: 'HOPEBRIDGE_FOUNDATION',
    name: 'Hopebridge Foundation Donation',
    category: 'other',
    referenceLabel: 'Donor reference',
    referencePattern: null,
    supportsBalanceEnquiry: false,
    minimumAmountMinorUnits: 500,
    feeMinorUnits: 0,
    failureRate: 0.01,
    typicalBillMinorUnits: 5000,
  },
];
