import type { Route } from 'next';
import { productRoute } from '@/lib/routes';

/**
 * Product copy.
 *
 * Held as data so the personal, business and wealth pages render from one shape, and so a rate
 * or a fee appears in exactly one place. Every figure here must match what the API's product
 * catalogue actually returns — a marketing page that quotes a rate the bank does not offer is a
 * lie the product then has to explain. `href` points at the product's detail page.
 */

export interface ProductCopy {
  readonly slug: string;
  readonly name: string;
  readonly tagline: string;
  readonly description: string;
  readonly headline: string;
  readonly headlineNote: string;
  readonly href: Route;
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
    href: productRoute('/personal/current'),
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
    href: productRoute('/personal/savings'),
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
    href: productRoute('/personal/deposits'),
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
    href: productRoute('/personal/cards'),
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
    href: productRoute('/personal/loans'),
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
  {
    slug: 'mortgages',
    name: 'Mortgages',
    tagline: 'A decision in principle in minutes',
    description:
      'Fixed and tracker mortgages for first-time buyers, movers and remortgages. The decision in principle is free, does not touch your credit file, and shows the exact borrowing figure it is based on.',
    headline: 'from 4.85%',
    headlineNote: '2-year fixed, 60% LTV',
    href: productRoute('/personal/mortgages'),
    features: [
      'Decision in principle in minutes, with no credit-file footprint',
      'Fixed terms from 2 to 10 years, trackers from 2',
      'Overpay up to 10% of the balance each year, penalty-free',
      'Borrow up to 4.5 times verified income',
      'A named case manager from offer to completion',
    ],
    fees: [
      { label: 'Arrangement fee', value: '999' },
      { label: 'Valuation', value: 'Free' },
      { label: 'Early repayment', value: '2% during fixed term' },
      { label: 'Representative APRC', value: '5.1%' },
    ],
  },
] as const;
