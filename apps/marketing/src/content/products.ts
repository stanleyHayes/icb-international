/**
 * Product copy.
 *
 * Held as data so the personal and business pages render from one shape, and so a rate or a fee
 * appears in exactly one place. Every figure here must match what the API's product catalogue
 * actually returns — a marketing page that quotes a rate the bank does not offer is a lie the
 * product then has to explain.
 */

export interface ProductCopy {
  readonly slug: string;
  readonly name: string;
  readonly tagline: string;
  readonly description: string;
  readonly headline: string;
  readonly headlineNote: string;
  readonly features: readonly string[];
  readonly fees: readonly { label: string; value: string }[];
}

export const PERSONAL_PRODUCTS: readonly ProductCopy[] = [
  {
    slug: 'current',
    name: 'Everyday Current',
    tagline: 'The account your salary lands in',
    description:
      'A current account in any of fifteen currencies, with a debit card, instant transfers to other ICB customers, and an arranged overdraft you can see before you use it.',
    headline: '0.25%',
    headlineNote: 'AER on credit balances',
    features: [
      'Instant transfers between ICB accounts, any hour',
      'Arranged overdraft up to 500, shown as part of available balance',
      'Debit card with per-category and per-channel controls',
      'Real-time notifications on every authorisation',
      'Statements as PDF, generated from the ledger itself',
    ],
    fees: [
      { label: 'Monthly maintenance', value: 'Free' },
      { label: 'Domestic transfer', value: 'Free' },
      { label: 'Same-day wire', value: '12.00' },
      { label: 'Arranged overdraft', value: '14.9% EAR' },
    ],
  },
  {
    slug: 'savings',
    name: 'Reserve Savings',
    tagline: 'Interest that accrues daily',
    description:
      'Instant-access savings with interest accrued every day and capitalised monthly. Set goals, round up your spending into them, and watch the progress against a date you choose.',
    headline: '4.15%',
    headlineNote: 'AER, variable',
    features: [
      'Interest accrued daily on cleared balance, ACT/365',
      'Named goals with target dates and progress tracking',
      'Round-ups from your current account, automatically',
      'No notice period, no withdrawal penalty',
      'Automatic contributions weekly, fortnightly or monthly',
    ],
    fees: [
      { label: 'Monthly maintenance', value: 'Free' },
      { label: 'Withdrawals', value: 'Free, instant' },
      { label: 'Minimum balance', value: 'None' },
    ],
  },
  {
    slug: 'deposits',
    name: 'Fixed Term Deposit',
    tagline: 'A rate you lock in',
    description:
      'Commit for a term between one month and five years and take a fixed rate for the whole of it. Break early if you must — the penalty is quoted before you confirm, never after.',
    headline: '5.20%',
    headlineNote: 'fixed, 12-month term',
    features: [
      'Terms from 1 to 60 months',
      'Rate fixed for the full term regardless of the market',
      'Maturity instruction set at opening: roll over or transfer out',
      'Early-break penalty quoted in advance, to the cent',
      'Interest projection shown before you commit',
    ],
    fees: [
      { label: '3-month term', value: '4.40%' },
      { label: '6-month term', value: '4.85%' },
      { label: '12-month term', value: '5.20%' },
      { label: '24-month term', value: '5.05%' },
    ],
  },
  {
    slug: 'cards',
    name: 'Debit & Virtual Cards',
    tagline: 'Controls that actually decline',
    description:
      'Physical and virtual cards with limits and controls enforced at authorisation. Freeze in one tap, unfreeze in one tap, and see the hold appear on your balance the moment it is placed.',
    headline: '0.00',
    headlineNote: 'to issue a virtual card',
    features: [
      'Freeze and unfreeze instantly, as often as you like',
      'Per-channel switches: online, contactless, ATM, international',
      'Block whole spending categories',
      'Per-transaction, daily and monthly limits',
      'Report lost or stolen and reissue in the same flow',
    ],
    fees: [
      { label: 'Virtual card', value: 'Free, unlimited' },
      { label: 'Physical card', value: 'Free, one per account' },
      { label: 'Replacement', value: '8.00' },
      { label: 'Foreign transaction', value: '0.35% spread' },
    ],
  },
  {
    slug: 'loans',
    name: 'Personal Loan',
    tagline: 'A decision you can read',
    description:
      'Borrow between 1,000 and 50,000 over one to seven years. Every decision comes with the factors that produced it — approved or declined, you see the reasoning.',
    headline: 'from 8.9%',
    headlineNote: 'representative APR',
    features: [
      'Indicative quote with a full schedule before you apply',
      'Decision factors shown in plain language',
      'Overpay or settle early with a quoted payoff figure',
      'Repayments allocated fees, then interest, then principal',
      'No early-settlement penalty after twelve months',
    ],
    fees: [
      { label: 'Arrangement fee', value: '1.0% of advance' },
      { label: 'Early settlement (yr 1)', value: '1.0% of balance' },
      { label: 'Early settlement (after)', value: 'Free' },
      { label: 'Missed payment', value: '15.00' },
    ],
  },
] as const;

export const BUSINESS_PRODUCTS: readonly ProductCopy[] = [
  {
    slug: 'business-current',
    name: 'Business Current',
    tagline: 'Multi-currency, multi-user',
    description:
      'A current account for companies, with role-based access for your team, bulk payments by CSV, and every posting exportable for your accountant.',
    headline: '15',
    headlineNote: 'currencies in one account',
    features: [
      'Bulk payments: upload a CSV, validate the batch, execute once',
      'Role-based access with a four-eyes control on high-value payments',
      'Standing orders on an RRULE schedule',
      'Export to CSV, OFX or PDF for any period',
      'Full posting breakdown on every transaction',
    ],
    fees: [
      { label: 'Monthly maintenance', value: '18.00' },
      { label: 'Domestic transfer', value: 'Free' },
      { label: 'Bulk payment batch', value: '0.15 per row' },
      { label: 'International payment', value: '0.35% spread' },
    ],
  },
  {
    slug: 'payments',
    name: 'Payments & Collections',
    tagline: 'Every rail, one interface',
    description:
      'Internal, domestic, same-day wire and international payments from one screen. Each quotes its rail, its fee and its arrival time before you confirm.',
    headline: 'T+0',
    headlineNote: 'for same-day wires before 16:00',
    features: [
      'Rail chosen for you from the destination, then shown back',
      'Cut-off times stated before you commit, not after',
      'Idempotency keys on every instruction so a retry is safe',
      'Settlement state visible on the transaction, not inferred',
      'Returns surfaced with their reason code',
    ],
    fees: [
      { label: 'Internal / on-us', value: 'Free, instant' },
      { label: 'Domestic (T+1)', value: 'Free' },
      { label: 'Same-day wire', value: '18.00' },
      { label: 'International (T+2)', value: '0.35% spread' },
    ],
  },
  {
    slug: 'trade',
    name: 'Trade Finance',
    tagline: 'Working capital that moves with the shipment',
    description:
      'Letters of credit, documentary collections and invoice finance for importers and exporters, priced against the corridor rather than a flat book rate.',
    headline: '0.35%',
    headlineNote: 'FX spread on trade corridors',
    features: [
      'Letters of credit issued against your facility',
      'Documentary collections with status at every hop',
      'Invoice finance up to 85% of the invoice value',
      'Corridor-specific pricing, quoted per transaction',
      'Correspondent hops visible on the payment timeline',
    ],
    fees: [
      { label: 'LC issuance', value: '0.75% per quarter' },
      { label: 'Documentary collection', value: '65.00' },
      { label: 'Invoice finance', value: 'from 9.4% APR' },
    ],
  },
  {
    slug: 'lending',
    name: 'Business Lending',
    tagline: 'Term loans and revolving facilities',
    description:
      'Borrow against your trading history rather than a form. Term loans to 250,000 and revolving facilities that draw and repay as your cash cycle demands.',
    headline: 'from 7.4%',
    headlineNote: 'representative APR',
    features: [
      'Term loans from 10,000 to 250,000',
      'Revolving facility with interest on the drawn balance only',
      'Underwriting factors shown to you, not just to us',
      'Restructure without a new application',
      'Repayments allocated fees, interest, then principal',
    ],
    fees: [
      { label: 'Arrangement fee', value: '1.5% of facility' },
      { label: 'Non-utilisation', value: '0.5% per annum' },
      { label: 'Early settlement', value: '1.0% in year one' },
    ],
  },
] as const;
