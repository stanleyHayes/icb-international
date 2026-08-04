import { FileCheck, Home, Percent, UserRound } from 'lucide-react';

import type { ProductPageCopy } from './types';

export const PERSONAL_MORTGAGES_PAGE: ProductPageCopy = {
  category: 'Personal',
  categoryHref: '/personal',
  slug: 'mortgages',
  name: 'Mortgages',
  tagline: 'A decision in principle in minutes',
  metaDescription:
    'Fixed and tracker mortgages from 4.85% with a free decision in principle that does not touch your credit file. Overpay 10% a year, penalty-free.',
  heroLead:
    'First home, next home or a remortgage: the decision in principle takes minutes, leaves no footprint on your credit file, and shows the exact borrowing figure it is based on. The rate table below is the rate table — no “from” games beyond what risk pricing genuinely means.',
  headline: 'from 4.85%',
  headlineNote: '2-year fixed, 60% LTV',
  features: [
    { icon: FileCheck, title: 'Decision in minutes', body: 'A decision in principle based on verified income, with the figure and its basis shown — and no credit-file footprint.' },
    { icon: Percent, title: 'Fixed and tracker', body: 'Fix for two to ten years, or track for two. The early-repayment charge for each is stated beside the rate.' },
    { icon: Home, title: 'Overpay 10% a year', body: 'Pay up to a tenth of the balance off each year with no charge, and see the term shorten in the app.' },
    { icon: UserRound, title: 'A named case manager', body: 'One person from offer to completion, reachable by secure message, who already knows your file.' },
  ],
  rates: [
    { label: '2-year fixed, 60% LTV', value: 'from 4.85%' },
    { label: 'Arrangement fee', value: '999' },
    { label: 'Valuation', value: 'Free' },
    { label: 'Early repayment', value: '2% during fixed term' },
    { label: 'Representative APRC', value: '5.1%' },
  ],
  eligibility: [
    'Aged 18 or over',
    'A deposit of at least 10% of the purchase price',
    'Verified income — payslips if employed, twelve months of accounts if self-employed',
    'Borrowing up to 4.5 times verified income, subject to affordability',
  ],
  faqs: [
    {
      question: 'How much can I borrow?',
      answer: 'Up to 4.5 times your verified income, capped by an affordability assessment that accounts for your actual committed spending. The decision in principle shows the figure and every input that produced it.',
    },
    {
      question: 'Does the decision in principle affect my credit file?',
      answer: 'No. It is computed from the income and commitments you declare, verified against your account history. A full credit search happens only when you proceed to a full application, with your consent first.',
    },
    {
      question: 'What does the 2% early repayment charge apply to?',
      answer: 'Repayments above the 10% annual allowance, made during the fixed or tracker period. After the initial period ends, the charge falls away entirely.',
    },
  ],
};
