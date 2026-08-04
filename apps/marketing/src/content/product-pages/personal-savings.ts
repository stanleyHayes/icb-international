import { PiggyBank, Repeat, Target, TrendingUp } from 'lucide-react';

import type { ProductPageCopy } from './types';

export const PERSONAL_SAVINGS_PAGE: ProductPageCopy = {
  category: 'Personal',
  categoryHref: '/personal',
  slug: 'savings',
  name: 'Reserve Savings',
  tagline: 'Interest that accrues daily',
  metaDescription:
    'Instant-access savings at 4.15% AER variable, with interest accrued daily, named goals, automatic round-ups and no withdrawal penalty.',
  heroLead:
    'Instant-access savings that behave like they should: interest accrued every day, goals with dates you choose, and withdrawals that arrive in your current account the second you ask.',
  headline: '4.15%',
  headlineNote: 'AER, variable',
  features: [
    { icon: TrendingUp, title: 'Accrued daily', body: 'Interest is calculated on your cleared balance every day (ACT/365) and capitalised monthly.' },
    { icon: Target, title: 'Goals with dates', body: 'Name a goal, set a target and a date, and see exactly whether you are on pace.' },
    { icon: Repeat, title: 'Round-ups', body: 'Card spending rounds up into savings automatically — the transfer posts with the purchase.' },
    { icon: PiggyBank, title: 'No traps', body: 'No notice period, no withdrawal penalty, no minimum balance. It is your money.' },
  ],
  rates: [
    { label: 'Interest rate', value: '4.15% AER, variable' },
    { label: 'Monthly maintenance', value: 'Free' },
    { label: 'Withdrawals', value: 'Free, instant' },
    { label: 'Minimum balance', value: 'None' },
  ],
  eligibility: [
    'Aged 18 or over',
    'An ICB Everyday Current account',
    'Any opening amount — there is no minimum',
  ],
  faqs: [
    {
      question: 'Is the rate fixed?',
      answer: 'No — 4.15% AER is variable and moves with the market. What never changes is the basis: daily accrual on your cleared balance, ACT/365, capitalised monthly. Any rate change is announced before it takes effect.',
    },
    {
      question: 'How do round-ups work?',
      answer: 'Each card purchase is rounded up to the nearest whole unit and the difference moves to your savings goal as its own posting. You can cap it, pause it, or turn it off at any time.',
    },
    {
      question: 'Is my money protected?',
      answer: 'Yes. Eligible deposits are protected up to 250,000 per depositor, counted across all your ICB accounts combined.',
    },
  ],
};
