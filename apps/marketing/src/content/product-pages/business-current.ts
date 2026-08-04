import { Download, FileSpreadsheet, RefreshCw, Users } from 'lucide-react';

import type { ProductPageCopy } from './types';

export const BUSINESS_CURRENT_PAGE: ProductPageCopy = {
  category: 'Business',
  categoryHref: '/business',
  slug: 'business-current',
  name: 'Business Current',
  tagline: 'Multi-currency, multi-user',
  metaDescription:
    'A business current account in fifteen currencies with role-based team access, CSV bulk payments, four-eyes approval and full posting-level export.',
  heroLead:
    'The account your company runs on: fifteen currencies, role-based access for the whole team, bulk payments that validate before they execute, and every posting exportable for your accountant without a phone call.',
  headline: '15',
  headlineNote: 'currencies in one account',
  features: [
    { icon: Users, title: 'Roles, not shared logins', body: 'Each person gets their own access with a role — viewer, preparer, approver — and every action is attributed.' },
    { icon: FileSpreadsheet, title: 'Bulk payments', body: 'Upload a CSV, watch every row validate against sort code, account and duplicates, then execute the batch once.' },
    { icon: RefreshCw, title: 'Four-eyes on what matters', body: 'High-value payments require a second approver. The threshold is yours to set; the control is ours to enforce.' },
    { icon: Download, title: 'Exports your accountant wants', body: 'CSV, OFX or PDF for any period, with the full posting breakdown — debit, credit, counterparty, running balance.' },
  ],
  rates: [
    { label: 'Monthly maintenance', value: '18.00' },
    { label: 'Domestic transfer', value: 'Free' },
    { label: 'Bulk payment batch', value: '0.15 per row' },
    { label: 'International payment', value: '0.35% spread' },
  ],
  eligibility: [
    'A registered company, partnership or sole trader',
    'Photo ID for every director and significant owner',
    'Company registration documents',
    'A description of expected account activity',
  ],
  faqs: [
    {
      question: 'Can my accountant have access?',
      answer: 'Yes — give them a viewer role and they see everything and can export everything, but can initiate nothing. Access is per person, revocable instantly, and every view of sensitive data is logged.',
    },
    {
      question: 'How does the four-eyes control work?',
      answer: 'You set a threshold. Above it, a payment a preparer submits sits pending until an approver confirms it — and the same person can never do both. The control is enforced by the ledger, not by policy.',
    },
    {
      question: 'What does bulk upload validate?',
      answer: 'Every row is checked before the batch can execute: sort code and account number format, duplicates within the file, and the batch total against the amount you declared. A bad row fails the batch, not just itself.',
    },
  ],
};
