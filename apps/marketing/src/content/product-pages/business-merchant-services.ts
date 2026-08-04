import { Link2, ReceiptText, ShieldCheck, Store } from 'lucide-react';

import type { ProductPageCopy } from './types';

export const BUSINESS_MERCHANT_PAGE: ProductPageCopy = {
  category: 'Business',
  categoryHref: '/business',
  slug: 'merchant-services',
  name: 'Merchant Services',
  tagline: 'Get paid, settle next day',
  metaDescription:
    'Card acceptance online and in-person from 0.9%, settling into your ICB business current account the next business day, with a built-in chargeback console.',
  heroLead:
    'Card acceptance that settles where your banking lives. Online and in-person sales land in your business current account the next business day, reconciled to the individual sale — no third-party balance, no payout roulette.',
  headline: '1.2%',
  headlineNote: 'per domestic consumer card transaction',
  features: [
    { icon: Link2, title: 'Payment links', body: 'Send a link, get paid. Hosted checkout handles the card capture; you never touch a card number.' },
    { icon: Store, title: 'In-person acceptance', body: 'Contactless and chip acceptance for the counter, at a flat 0.9% with settlement the next business day.' },
    { icon: ReceiptText, title: 'Reconciled to the sale', body: 'Every settlement breaks down to the individual transactions inside it — fees itemised, not blended.' },
    { icon: ShieldCheck, title: 'Chargebacks, handled', body: 'A dispute console with evidence upload, deadlines tracked, and the reason code shown in plain language.' },
  ],
  rates: [
    { label: 'Online (consumer cards)', value: '1.2% + 0.20' },
    { label: 'In-person', value: '0.9%' },
    { label: 'Settlement', value: 'Free, next business day' },
    { label: 'Chargeback', value: '15.00' },
  ],
  eligibility: [
    'An ICB Business Current account',
    'Trading history or a credible forecast for new businesses',
    'A website with refund and delivery terms for online acceptance',
  ],
  faqs: [
    {
      question: 'When do I actually get the money?',
      answer: 'Sales taken before the 21:00 cut-off settle into your business current account the next business day. The settlement is a single posting with a full breakdown, so reconciliation is a lookup, not a project.',
    },
    {
      question: 'How are chargebacks handled?',
      answer: 'You are notified the moment a dispute opens, with the reason code explained and the evidence deadline stated. Upload your evidence in the console and the status is tracked to outcome. If you win, the 15.00 fee is refunded.',
    },
    {
      question: 'Are there monthly minimums or PCI fees?',
      answer: 'No monthly minimum, no PCI non-compliance fee — the hosted checkout keeps card data away from you entirely. You pay the rates above and nothing else.',
    },
  ],
};
