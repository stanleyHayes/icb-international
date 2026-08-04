import { ShieldAlert, SlidersHorizontal, Snowflake, Siren } from 'lucide-react';

import type { ProductPageCopy } from './types';

export const PERSONAL_CARDS_PAGE: ProductPageCopy = {
  category: 'Personal',
  categoryHref: '/personal',
  slug: 'cards',
  name: 'Debit & Virtual Cards',
  tagline: 'Controls that actually decline',
  metaDescription:
    'Physical and virtual debit cards with per-channel and per-category controls enforced at authorisation. Freeze instantly, reissue in the same flow.',
  heroLead:
    'A control you can see but that does not decline is worse than none. Every switch on an ICB card — freeze, channel, category, limit — is enforced at authorisation, and the hold shows on your balance the moment it is placed.',
  headline: '0.00',
  headlineNote: 'to issue a virtual card',
  features: [
    { icon: Snowflake, title: 'Freeze in one tap', body: 'Takes effect at the next authorisation attempt, however many times you flip it. Unfreeze is just as fast.' },
    { icon: SlidersHorizontal, title: 'Channels and categories', body: 'Switch online, contactless, ATM and international independently — or block whole spending categories.' },
    { icon: ShieldAlert, title: 'Limits that hold', body: 'Per-transaction, daily and monthly caps are checked during authorisation, with the decline reason shown.' },
    { icon: Siren, title: 'Lost or stolen', body: 'Report and reissue in one flow. The old card dies immediately and its pending holds are released.' },
  ],
  rates: [
    { label: 'Virtual card', value: 'Free, unlimited' },
    { label: 'Physical card', value: 'Free, one per account' },
    { label: 'Replacement', value: '8.00' },
    { label: 'Foreign transaction', value: '0.35% spread' },
  ],
  eligibility: [
    'Aged 18 or over',
    'An ICB Everyday Current account',
    'A verified address for physical card delivery',
  ],
  faqs: [
    {
      question: 'How fast is a freeze, really?',
      answer: 'The next authorisation attempt on that card is declined. There is no batch, no overnight job — the switch is read during authorisation itself.',
    },
    {
      question: 'Do controls apply to subscriptions and saved cards?',
      answer: 'Yes. A blocked category or a frozen card declines recurring authorisations too, and you are told which subscription was declined rather than discovering it from a cancellation email.',
    },
    {
      question: 'What is the 0.35% foreign transaction spread?',
      answer: 'When you spend in a currency you do not hold, we convert at the mid-market rate plus a single 0.35% spread. No fixed fee, no weekend markup, and the converted amount is shown on the authorisation.',
    },
  ],
};
