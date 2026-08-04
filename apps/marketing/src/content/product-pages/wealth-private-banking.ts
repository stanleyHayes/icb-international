import { Landmark, LineChart, Phone, UserRound } from 'lucide-react';

import type { ProductPageCopy } from './types';

export const WEALTH_PRIVATE_PAGE: ProductPageCopy = {
  category: 'Wealth',
  categoryHref: '/wealth',
  slug: 'private-banking',
  name: 'Private Banking',
  tagline: 'A banker, not a ticket queue',
  metaDescription:
    'Private banking from a 150,000 relationship balance: a named banker, portfolio-secured credit from 5.9%, preferential rates and family reporting.',
  heroLead:
    'For clients with 150,000 or more across deposits and investments: a named banker who answers their own messages, credit secured against your portfolio, and preferential pricing across everything you hold with us.',
  headline: '150,000',
  headlineNote: 'minimum relationship balance',
  features: [
    { icon: UserRound, title: 'A named banker', body: 'One person who knows your file and answers their own secure messages — not a queue, not a rota.' },
    { icon: Landmark, title: 'Portfolio-secured credit', body: 'Borrow against your investment portfolio from 5.9% per year, without selling a position to fund a purchase.' },
    { icon: LineChart, title: 'Preferential pricing', body: 'Improved rates across savings, deposits and FX, applied automatically once you qualify — no annual negotiation.' },
    { icon: Phone, title: 'Family, consolidated', body: 'Reporting across family accounts with each holder’s consent, and same-day execution on large FX and transfers.' },
  ],
  rates: [
    { label: 'Relationship fee', value: '150 per quarter' },
    { label: 'Above 500,000', value: 'Fee waived' },
    { label: 'Secured credit line', value: 'from 5.9% p.a.' },
    { label: 'Large-trade FX', value: '0.25% spread' },
  ],
  eligibility: [
    'At least 150,000 across ICB deposits and investments',
    'Evidence of source of funds, as regulation requires',
    'An ICB Everyday Current account',
  ],
  faqs: [
    {
      question: 'What counts toward the relationship balance?',
      answer: 'Everything you hold with us: current and savings balances, fixed deposits and investment holdings, valued daily. The fee is charged or waived on the average across the quarter, not a snapshot.',
    },
    {
      question: 'How does portfolio-secured credit work?',
      answer: 'Your investment portfolio acts as collateral for a credit line, typically up to 60% of its value depending on what you hold. Interest accrues only on the drawn balance, and the loan-to-value is monitored visibly — you see the same margin position we do.',
    },
    {
      question: 'Is the fee really waived above 500,000?',
      answer: 'Yes. At that level the relationship covers its own cost, so the quarterly fee falls away entirely. Between 150,000 and 500,000 the fee is 150 per quarter, and that is the only private-banking-specific charge.',
    },
  ],
};
