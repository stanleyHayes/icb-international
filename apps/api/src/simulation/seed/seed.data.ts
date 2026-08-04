/* eslint-disable sonarjs/no-hardcoded-passwords -- demo credentials, printed by `pnpm seed` */

/**
 * Seed inputs.
 *
 * Held as data so the shape of the demo bank is legible in one file and can be tuned without
 * touching generation logic.
 */

export interface SeedPersona {
  readonly email: string;
  readonly password: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly phone: string;
  readonly tier: 'standard' | 'plus' | 'premier' | 'private';
  readonly city: string;
  readonly country: string;
  /** Monthly salary in major units, credited on the 25th of each seeded month. */
  readonly monthlySalary: number;
  readonly currency: 'USD' | 'GBP' | 'EUR' | 'GHS';
  readonly openingBalance: number;
  readonly savingsBalance: number;
}

export const SEED_PERSONAS: readonly SeedPersona[] = [
  {
    email: 'demo@icb.example',
    password: 'Demo!2345678',
    firstName: 'Amara',
    lastName: 'Boateng',
    phone: '+233201234567',
    tier: 'premier',
    city: 'Accra',
    country: 'GH',
    monthlySalary: 8400,
    currency: 'USD',
    openingBalance: 24_500,
    savingsBalance: 62_000,
  },
  {
    email: 'kwame@icb.example',
    password: 'Kwame!2345678',
    firstName: 'Kwame',
    lastName: 'Mensah',
    phone: '+233241112233',
    tier: 'standard',
    city: 'Kumasi',
    country: 'GH',
    monthlySalary: 3200,
    currency: 'GHS',
    openingBalance: 8_900,
    savingsBalance: 14_200,
  },
  {
    email: 'lena@icb.example',
    password: 'Lena!23456789',
    firstName: 'Lena',
    lastName: 'Fischer',
    phone: '+491701234567',
    tier: 'plus',
    city: 'Berlin',
    country: 'DE',
    monthlySalary: 5600,
    currency: 'EUR',
    openingBalance: 17_300,
    savingsBalance: 31_500,
  },
  {
    email: 'olu@icb.example',
    password: 'Olu!234567890',
    firstName: 'Olu',
    lastName: 'Adeyemi',
    phone: '+2348031234567',
    tier: 'private',
    city: 'Lagos',
    country: 'NG',
    monthlySalary: 21_000,
    currency: 'USD',
    openingBalance: 148_000,
    savingsBalance: 410_000,
  },
  {
    email: 'sara@icb.example',
    password: 'Sara!234567890',
    firstName: 'Sara',
    lastName: 'Whitfield',
    phone: '+447700900123',
    tier: 'standard',
    city: 'Manchester',
    country: 'GB',
    monthlySalary: 4100,
    currency: 'GBP',
    openingBalance: 6_450,
    savingsBalance: 9_800,
  },
];

export const SEED_STAFF = [
  { email: 'ops@icb.example', firstName: 'Nadia', lastName: 'Osei', roles: ['operations', 'admin'] },
  { email: 'risk@icb.example', firstName: 'Tobi', lastName: 'Adeleke', roles: ['fraud_analyst'] },
  { email: 'aml@icb.example', firstName: 'Grace', lastName: 'Owusu', roles: ['aml_officer', 'compliance'] },
  { email: 'lend@icb.example', firstName: 'Marcus', lastName: 'Bello', roles: ['underwriter'] },
] as const;

export const STAFF_PASSWORD = 'Staff!2345678';

/**
 * Recurring outgoings, as (day of month, merchant, category hint, amount as a fraction of salary).
 * Fractions rather than absolute amounts so every persona's spending is proportionate to income.
 */
export const RECURRING_OUTGOINGS: readonly {
  day: number;
  merchant: string;
  fraction: number;
}[] = [
  { day: 1, merchant: 'Meridian Properties — rent', fraction: 0.28 },
  { day: 3, merchant: 'Volta Power — electricity', fraction: 0.022 },
  { day: 4, merchant: 'Aqua Utilities — water', fraction: 0.008 },
  { day: 5, merchant: 'FibreLink Internet', fraction: 0.014 },
  { day: 7, merchant: 'Netflix subscription', fraction: 0.004 },
  { day: 7, merchant: 'Spotify Premium', fraction: 0.0025 },
  { day: 12, merchant: 'Sentinel Insurance — cover', fraction: 0.031 },
  { day: 18, merchant: 'PhoneCo mobile plan', fraction: 0.009 },
  { day: 22, merchant: 'FitLab membership', fraction: 0.011 },
];

/** Discretionary merchants sampled a few times a week. */
export const DISCRETIONARY_MERCHANTS: readonly { name: string; min: number; max: number }[] = [
  { name: 'Palm Grove Supermarket', min: 18, max: 140 },
  { name: 'Kofi & Sons Grocers', min: 12, max: 85 },
  { name: 'The Copper Kettle café', min: 4, max: 22 },
  { name: 'Ember Kitchen restaurant', min: 22, max: 110 },
  { name: 'Bolt ride', min: 3, max: 28 },
  { name: 'Metro transit top-up', min: 5, max: 40 },
  { name: 'Shell fuel station', min: 25, max: 95 },
  { name: 'Northgate Pharmacy', min: 8, max: 60 },
  { name: 'Atlas Books', min: 10, max: 55 },
  { name: 'Harbour Cinema', min: 9, max: 38 },
  { name: 'Zenith Electronics', min: 40, max: 620 },
  { name: 'Marina Hotel', min: 90, max: 420 },
  { name: 'Skyline Airways', min: 150, max: 980 },
];

export const PRODUCTS = [
  {
    code: 'ICB-CURRENT',
    name: 'ICB Everyday Current',
    kind: 'current',
    interestRate: 0.25,
    overdraft: 50_000,
  },
  {
    code: 'ICB-SAVINGS',
    name: 'ICB Reserve Savings',
    kind: 'savings',
    interestRate: 4.15,
    overdraft: 0,
  },
] as const;
