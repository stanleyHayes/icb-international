import { CalendarClock, Lock, Percent, TrendingUp } from 'lucide-react';

import type { ProductPageCopy } from './types';

export const PERSONAL_DEPOSITS_PAGE: ProductPageCopy = {
  category: 'Personal',
  categoryHref: '/personal',
  slug: 'deposits',
  name: 'Fixed Term Deposit',
  tagline: 'A rate you lock in',
  metaDescription:
    'Fixed term deposits from 1 to 60 months at up to 5.20% fixed. Early-break penalty quoted before you confirm, maturity instruction set at opening.',
  heroLead:
    'Commit a sum for a term and take a fixed rate for the whole of it, whatever the market does. The interest projection, the maturity instruction and the early-break penalty are all settled before you commit a cent.',
  headline: '5.20%',
  headlineNote: 'fixed, 12-month term',
  features: [
    { icon: Percent, title: 'Fixed means fixed', body: 'The rate at opening is the rate at maturity. Market moves in between are not your problem.' },
    { icon: CalendarClock, title: 'Terms that fit', body: 'From one month to five years, with the rate for each term stated in the same table.' },
    { icon: TrendingUp, title: 'Projected to the cent', body: 'The exact interest you will earn is shown before you confirm, not estimated after.' },
    { icon: Lock, title: 'An honest exit', body: 'If you must break early, the penalty is quoted to the cent before you confirm the break.' },
  ],
  rates: [
    { label: '3-month term', value: '4.40%' },
    { label: '6-month term', value: '4.85%' },
    { label: '12-month term', value: '5.20%' },
    { label: '24-month term', value: '5.05%' },
    { label: 'Minimum deposit', value: '1,000' },
  ],
  eligibility: [
    'Aged 18 or over',
    'An ICB Everyday Current account to fund and receive maturity proceeds',
    'At least 1,000 you can commit for the full term',
  ],
  faqs: [
    {
      question: 'What happens at maturity?',
      answer: 'Whatever you told us at opening: roll into a new term at the then-current rate, or transfer principal and interest to your current account. We remind you before the date and never roll silently.',
    },
    {
      question: 'Can I break the deposit early?',
      answer: 'Yes. The penalty depends on how much of the term has elapsed and is quoted to the cent before you confirm. You will never discover the cost after the fact.',
    },
    {
      question: 'Why is the 24-month rate lower than the 12-month?',
      answer: 'Because that is where the market prices two-year money today. We quote the curve as it is rather than smoothing it into something that looks tidier.',
    },
  ],
};
