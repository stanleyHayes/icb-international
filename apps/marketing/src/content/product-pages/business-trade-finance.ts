import { FileCheck, Globe2, Handshake, Ship } from 'lucide-react';

import type { ProductPageCopy } from './types';

export const BUSINESS_TRADE_PAGE: ProductPageCopy = {
  category: 'Business',
  categoryHref: '/business',
  slug: 'trade-finance',
  name: 'Trade Finance',
  tagline: 'Working capital that moves with the shipment',
  metaDescription:
    'Letters of credit, documentary collections and invoice finance up to 85% of invoice value, priced per corridor with every correspondent hop visible.',
  heroLead:
    'Letters of credit, documentary collections and invoice finance for companies that import and export — priced against the corridor you actually trade, with the shipment’s paperwork tracked at every hop.',
  headline: '0.35%',
  headlineNote: 'FX spread on trade corridors',
  features: [
    { icon: FileCheck, title: 'Letters of credit', body: 'Issued against your facility with terms checked before issuance, so discrepancies are caught at draft, not at presentation.' },
    { icon: Ship, title: 'Collections with status', body: 'Documentary collections tracked at every hop — dispatched, presented, accepted, paid — with documents attached.' },
    { icon: Handshake, title: 'Invoice finance to 85%', body: 'Advance up to 85% of an approved invoice the day you issue it; the remainder, less fees, when your buyer pays.' },
    { icon: Globe2, title: 'Corridor pricing', body: 'FX and fees quoted per transaction for the specific corridor, not a flat book rate padded for the worst case.' },
  ],
  rates: [
    { label: 'LC issuance', value: '0.75% per quarter' },
    { label: 'Documentary collection', value: '65.00' },
    { label: 'Invoice finance', value: 'from 9.4% APR' },
    { label: 'Corridor FX', value: '0.35% spread' },
  ],
  eligibility: [
    'An ICB Business Current account',
    'Evidence of trading history in the corridor',
    'Underlying trade documents — contracts, invoices, transport documents',
  ],
  faqs: [
    {
      question: 'How is corridor pricing set?',
      answer: 'From the actual cost of moving and converting money on that route — correspondent fees, settlement time and FX liquidity. You see the full quote per transaction before committing, and it never changes after confirmation.',
    },
    {
      question: 'What does invoice finance cost?',
      answer: 'From 9.4% APR on the advanced amount for the days it is outstanding, plus a per-invoice service fee quoted upfront. When your buyer pays, the advance settles and the remainder lands in your account.',
    },
    {
      question: 'Can I track where my documents are?',
      answer: 'Yes. Each collection shows its status at every hop with the documents attached, and each payment shows its correspondent chain — you see the same timeline our operations team sees.',
    },
  ],
};
