
import type { ProductCopy } from './products';
import { productRoute } from '@/lib/routes';

/**
 * Wealth product copy — same shape and same rule as `products.ts`: a rate or a fee appears in
 * exactly one place, and every figure matches the API's product catalogue.
 */
export const WEALTH_PRODUCTS: readonly ProductCopy[] = [
  {
    slug: 'investments',
    name: 'Investment Accounts',
    tagline: 'Invest from the same ledger you bank on',
    description:
      'A general investment account and a tax-wrapped savings account holding funds and listed securities, with monthly investing from 50 and custody charged as a single capped percentage.',
    headline: '0.25%',
    headlineNote: 'annual custody, capped at 500',
    href: productRoute('/wealth/investments'),
    features: [
      'Funds and listed securities in one account',
      'Monthly investing from 50, on a date you choose',
      'Trades settled from your current account, same ledger',
      'Annual capital gains report, generated automatically',
      'Managed portfolios from 0.55% per year',
    ],
    fees: [
      { label: 'Custody', value: '0.25% p.a., capped' },
      { label: 'Fund trade', value: 'Free' },
      { label: 'Listed security trade', value: '4.95' },
      { label: 'FX on trades', value: '0.35% spread' },
    ],
  },
  {
    slug: 'fx',
    name: 'Foreign Exchange',
    tagline: 'Fifteen currencies, one spread',
    description:
      'Hold, convert and send fifteen currencies at a single stated spread — no fixed fee, no tiered margins that depend on how much you complain. The rate you confirm is the rate that posts.',
    headline: '0.35%',
    headlineNote: 'spread, no fixed fee',
    href: productRoute('/wealth/fx'),
    features: [
      'Convert between any held currencies, any hour',
      'The quoted rate is held while you confirm — no slippage after',
      'Rate alerts on the pairs you care about',
      'Forward-dated conversions up to twelve months out',
      'Every conversion shows the mid-market rate beside yours',
    ],
    fees: [
      { label: 'Conversion spread', value: '0.35%' },
      { label: 'Fixed fee', value: 'None' },
      { label: 'International payment', value: 'T+2, spread only' },
    ],
  },
  {
    slug: 'private-banking',
    name: 'Private Banking',
    tagline: 'A banker, not a ticket queue',
    description:
      'A dedicated banker for clients with 150,000 or more across deposits and investments: multi-currency credit secured against your portfolio, preferential deposit rates and consolidated family reporting.',
    headline: '150,000',
    headlineNote: 'minimum relationship balance',
    href: productRoute('/wealth/private-banking'),
    features: [
      'A named banker who answers their own messages',
      'Portfolio-secured credit lines from 5.9% per year',
      'Preferential rates across savings and deposits',
      'Consolidated reporting across family accounts',
      'Same-day execution on large FX and transfers',
    ],
    fees: [
      { label: 'Relationship fee', value: '150 per quarter' },
      { label: 'Above 500,000', value: 'Fee waived' },
      { label: 'Secured credit line', value: 'from 5.9% p.a.' },
    ],
  },
] as const;
