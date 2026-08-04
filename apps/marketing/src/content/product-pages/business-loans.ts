import { Building2, FileSearch, LineChart, RefreshCw } from 'lucide-react';

import type { ProductPageCopy } from './types';

export const BUSINESS_LOANS_PAGE: ProductPageCopy = {
  category: 'Business',
  categoryHref: '/business',
  slug: 'business-loans',
  name: 'Business Lending',
  tagline: 'Term loans and revolving facilities',
  metaDescription:
    'Business term loans from 10,000 to 250,000 and revolving facilities, from 7.4% representative APR, underwritten against your trading history.',
  heroLead:
    'Borrow against your trading history rather than a form. Term loans to 250,000 and revolving facilities that draw and repay as your cash cycle demands — underwritten with the factors shown to you, not just to us.',
  headline: 'from 7.4%',
  headlineNote: 'representative APR',
  features: [
    { icon: Building2, title: 'Term loans', body: '10,000 to 250,000 over one to six years, with the full amortisation schedule quoted before you sign.' },
    { icon: RefreshCw, title: 'Revolving facilities', body: 'Draw, repay and redraw within your limit. Interest accrues on the drawn balance only, day by day.' },
    { icon: FileSearch, title: 'Underwriting in the open', body: 'The scorecard factors behind your decision are listed — turnover consistency, cash coverage, sector — in plain language.' },
    { icon: LineChart, title: 'Restructure, not reapply', body: 'Extend a term or adjust a facility against the same underwriting file. No new application, no new search.' },
  ],
  rates: [
    { label: 'Interest rate', value: 'from 7.4% rep. APR' },
    { label: 'Arrangement fee', value: '1.5% of facility' },
    { label: 'Non-utilisation', value: '0.5% per annum' },
    { label: 'Early settlement', value: '1.0% in year one' },
  ],
  eligibility: [
    'At least twelve months of trading history',
    'Turnover evidenced by your account history, here or elsewhere',
    'Director guarantees for facilities above 50,000',
    'An ICB Business Current account for drawdown',
  ],
  faqs: [
    {
      question: 'What do you lend against?',
      answer: 'Primarily your trading history: turnover consistency, seasonality, cash coverage of the proposed repayment. Twelve months of account history — with us or via statements — usually replaces the business plan entirely.',
    },
    {
      question: 'How fast is a decision?',
      answer: 'An indicative limit is shown immediately from your declared figures. A full decision with verified history typically lands within three business days, and either way the factors behind it are shown to you.',
    },
    {
      question: 'What does non-utilisation mean?',
      answer: 'On a revolving facility, the undrawn portion costs 0.5% per annum — the price of keeping the capital committed to you. The drawn portion accrues the agreed interest rate instead, never both.',
    },
  ],
};
