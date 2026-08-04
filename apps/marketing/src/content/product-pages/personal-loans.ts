import { Calculator, FileSearch, HandCoins, Scale } from 'lucide-react';

import type { ProductPageCopy } from './types';

export const PERSONAL_LOANS_PAGE: ProductPageCopy = {
  category: 'Personal',
  categoryHref: '/personal',
  slug: 'loans',
  name: 'Personal Loan',
  tagline: 'A decision you can read',
  metaDescription:
    'Personal loans from 1,000 to 50,000 over one to seven years, from 8.9% representative APR. Every decision shows the factors that produced it.',
  heroLead:
    'Borrow between 1,000 and 50,000 over one to seven years. The quote shows the full schedule before you apply, and the decision — approved or declined — shows the factors that produced it, in plain language.',
  headline: 'from 8.9%',
  headlineNote: 'representative APR',
  features: [
    { icon: Calculator, title: 'The schedule first', body: 'An indicative quote with every repayment, the total cost and the APR — before any application exists.' },
    { icon: FileSearch, title: 'Reasons, not references', body: 'Approved or declined, the factors behind the decision are listed in plain language, not a code.' },
    { icon: HandCoins, title: 'Overpay freely', body: 'Overpay any time and settle early with a payoff figure quoted to the day, free after month twelve.' },
    { icon: Scale, title: 'Fair allocation', body: 'Every repayment is allocated fees, then interest, then principal — the order that costs you least.' },
  ],
  rates: [
    { label: 'Interest rate', value: 'from 8.9% rep. APR' },
    { label: 'Arrangement fee', value: '1.0% of advance' },
    { label: 'Early settlement (yr 1)', value: '1.0% of balance' },
    { label: 'Early settlement (after)', value: 'Free' },
    { label: 'Missed payment', value: '15.00' },
  ],
  eligibility: [
    'Aged 18 or over',
    'Twelve months of address history',
    'A regular, verifiable income',
    'An ICB Everyday Current account for drawdown and repayments',
  ],
  faqs: [
    {
      question: 'Will the quote affect my credit score?',
      answer: 'No. The indicative quote is computed without a credit-file search. A full search happens only when you submit an application, and you are told before it does.',
    },
    {
      question: 'What does “representative APR” mean here?',
      answer: 'At least 51% of customers accepted for this loan receive 8.9% APR or better. Your personal rate depends on the amount, the term and your circumstances — and is quoted before you commit.',
    },
    {
      question: 'Can I repay early?',
      answer: 'Any time. Request a payoff quote and you get the exact settlement figure for that day. After twelve months there is no early-settlement charge at all; in the first year it is 1.0% of the outstanding balance.',
    },
  ],
};
