import { CalendarClock, PieChart, ReceiptText, TrendingUp } from 'lucide-react';

import type { ProductPageCopy } from './types';

export const WEALTH_INVESTMENTS_PAGE: ProductPageCopy = {
  category: 'Wealth',
  categoryHref: '/wealth',
  slug: 'investments',
  name: 'Investment Accounts',
  tagline: 'Invest from the same ledger you bank on',
  metaDescription:
    'General and tax-wrapped investment accounts with funds and listed securities, monthly investing from 50, and custody at 0.25% per year, capped.',
  heroLead:
    'Funds and listed securities held on the same ledger as the rest of your money. Trades settle from your current account, custody is one capped percentage, and the annual gains report is generated rather than requested.',
  headline: '0.25%',
  headlineNote: 'annual custody, capped at 500',
  features: [
    { icon: PieChart, title: 'Funds and listings', body: 'Build from funds and listed securities in one account, general or tax-wrapped, with the same fee either way.' },
    { icon: CalendarClock, title: 'Monthly investing', body: 'From 50 a month on a date you choose. The instruction executes and posts like any other — visibly.' },
    { icon: TrendingUp, title: 'Managed portfolios', body: 'A managed allocation from 0.55% per year, rebalanced on a stated rule you can read before you opt in.' },
    { icon: ReceiptText, title: 'Gains, reported', body: 'An annual capital gains report generated automatically, with every disposal and its basis itemised.' },
  ],
  rates: [
    { label: 'Custody', value: '0.25% p.a., capped at 500' },
    { label: 'Fund trade', value: 'Free' },
    { label: 'Listed security trade', value: '4.95' },
    { label: 'FX on trades', value: '0.35% spread' },
    { label: 'Managed portfolio', value: 'from 0.55% p.a.' },
  ],
  eligibility: [
    'Aged 18 or over',
    'An ICB Everyday Current account',
    'A short appropriateness assessment, completed once',
    'An understanding that capital is at risk — investments can fall as well as rise',
  ],
  faqs: [
    {
      question: 'Is my money protected like a deposit?',
      answer: 'No — and the difference matters. Deposits are protected up to 250,000; investments are not, because their value moves with the market. Your holdings are held separately from the bank’s own assets, so they are yours whatever happens to us.',
    },
    {
      question: 'What does the custody cap mean?',
      answer: 'Custody is 0.25% of holdings per year, charged monthly, and stops accruing at 500 a year. Above 200,000 invested, the effective rate falls every month you hold more.',
    },
    {
      question: 'Can I move an existing portfolio in?',
      answer: 'Yes. A transfer in keeps your holdings intact where the funds are supported, and the cash portion moves as a single posted transfer. We handle the instruction with your current provider.',
    },
  ],
};
