import { ArrowLeftRight, BellRing, CalendarClock, Globe } from 'lucide-react';

import type { ProductPageCopy } from './types';

export const WEALTH_FX_PAGE: ProductPageCopy = {
  category: 'Wealth',
  categoryHref: '/wealth',
  slug: 'fx',
  name: 'Foreign Exchange',
  tagline: 'Fifteen currencies, one spread',
  metaDescription:
    'Convert and hold fifteen currencies at a single 0.35% spread with no fixed fee. Rate alerts, forward conversions to twelve months, mid-market shown.',
  heroLead:
    'Hold, convert and send fifteen currencies at a single stated spread. No fixed fee, no tiered margins, and the mid-market rate shown beside yours on every conversion — so the cost of the trade is never a thing you reconstruct later.',
  headline: '0.35%',
  headlineNote: 'spread, no fixed fee',
  features: [
    { icon: ArrowLeftRight, title: 'The quoted rate is the rate', body: 'A quote is held while you confirm. What you accept is what posts — there is no slippage after the fact.' },
    { icon: Globe, title: 'Fifteen currencies held', body: 'Each currency has its own account details, so you can receive locally and convert when the rate suits you.' },
    { icon: BellRing, title: 'Rate alerts', body: 'Set a level on any pair and get told when it trades there. Convert from the alert in one step.' },
    { icon: CalendarClock, title: 'Forwards to twelve months', body: 'Fix a rate today for a conversion up to a year out, with the margin stated in the same quote.' },
  ],
  rates: [
    { label: 'Conversion spread', value: '0.35%' },
    { label: 'Fixed fee', value: 'None' },
    { label: 'Forward conversion', value: '0.35% + forward points' },
    { label: 'International payment', value: 'T+2, spread only' },
  ],
  eligibility: [
    'Aged 18 or over',
    'An ICB Everyday Current account',
    'Forward conversions require a short credit assessment',
  ],
  faqs: [
    {
      question: 'Is 0.35% really the whole cost?',
      answer: 'Yes. The spread is the difference between the mid-market rate and your rate, and it is the only charge — shown as a figure, in your currency, before you confirm. There is no fixed fee and no separate commission.',
    },
    {
      question: 'What is a forward conversion?',
      answer: 'A rate fixed now for a conversion dated up to twelve months ahead. The forward points — the interest-rate difference between the two currencies — are stated in the quote, so the all-in rate is known before you commit.',
    },
    {
      question: 'How fast do conversions settle?',
      answer: 'Between your own ICB currency accounts, immediately — both postings happen in the same transaction. Conversions attached to an international payment settle on the payment’s own rail, quoted before you confirm.',
    },
  ],
};
