import { BellRing, CreditCard, FileText, Zap } from 'lucide-react';

import type { ProductPageCopy } from './types';

export const PERSONAL_CURRENT_PAGE: ProductPageCopy = {
  category: 'Personal',
  categoryHref: '/personal',
  slug: 'current',
  name: 'Everyday Current',
  tagline: 'The account your salary lands in',
  metaDescription:
    'A current account in fifteen currencies with a debit card, instant transfers and an arranged overdraft you can see before you use it. Free monthly maintenance.',
  heroLead:
    'One account for the money you live on: paid in, spent, moved and saved from. Fifteen currencies, a card whose controls actually decline, and every posting visible the moment it happens.',
  headline: '0.25%',
  headlineNote: 'AER on credit balances',
  features: [
    { icon: Zap, title: 'Instant, any hour', body: 'Transfers to other ICB customers settle in seconds, at 3pm or 3am, weekends included.' },
    { icon: CreditCard, title: 'A card you control', body: 'Per-channel and per-category switches are enforced at authorisation, not merely recorded.' },
    { icon: BellRing, title: 'Told as it happens', body: 'A notification on every authorisation, hold and posting — the balance never moves silently.' },
    { icon: FileText, title: 'Statements from the ledger', body: 'Every PDF is generated from the ledger itself, so it always reconciles to the cent.' },
  ],
  rates: [
    { label: 'Credit interest', value: '0.25% AER' },
    { label: 'Monthly maintenance', value: 'Free' },
    { label: 'Domestic transfer', value: 'Free' },
    { label: 'Same-day wire', value: '12.00' },
    { label: 'Arranged overdraft', value: '14.9% EAR' },
  ],
  eligibility: [
    'Aged 18 or over',
    'Resident in a supported country',
    'A valid photo ID — passport or driving licence',
    'Proof of address dated within the last three months',
  ],
  faqs: [
    {
      question: 'Is there really no monthly fee?',
      answer: 'None. Everyday Current is free to hold. You pay only for the things listed above — a same-day wire, a replacement card, an overdraft you actually use.',
    },
    {
      question: 'How does the arranged overdraft work?',
      answer: 'You request a limit up to 500 and see the cost, at 14.9% EAR, before you accept. The limit then shows as part of your available balance, so you can never drift into it unknowingly. Unarranged borrowing is declined, not charged.',
    },
    {
      question: 'Which currencies can I hold?',
      answer: 'Fifteen, including GBP, EUR, USD and GHS. Each has its own account details, and converting between them costs a single 0.35% spread with no fixed fee.',
    },
  ],
};
