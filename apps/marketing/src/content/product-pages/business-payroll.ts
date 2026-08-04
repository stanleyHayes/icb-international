import { CalendarCheck, FileCheck, Upload, Users } from 'lucide-react';

import type { ProductPageCopy } from './types';

export const BUSINESS_PAYROLL_PAGE: ProductPageCopy = {
  category: 'Business',
  categoryHref: '/business',
  slug: 'payroll',
  name: 'Payroll',
  tagline: 'Payday, without the spreadsheet panic',
  metaDescription:
    'Payroll runs on the ICB bulk-payment engine: CSV or template, every row validated, four-eyes approval, RRULE scheduling — 0.40 per payslip.',
  heroLead:
    'Salary runs built on the same bulk-payment engine as everything else we do: build the run, watch every row validate, approve it with four eyes, and schedule it on a rule that survives weekends and bank holidays.',
  headline: '0.40',
  headlineNote: 'per payslip, per run',
  features: [
    { icon: Upload, title: 'CSV or template', body: 'Upload the run from your payroll software, or build it once and reuse it as a template with the amounts edited.' },
    { icon: FileCheck, title: 'Validated before approval', body: 'Every row is checked — account details, duplicates, changed amounts against last month — before anyone can approve.' },
    { icon: Users, title: 'Four-eyes on the run', body: 'One person prepares, another approves. The control applies to the whole run, and the same person can never do both.' },
    { icon: CalendarCheck, title: 'Scheduled on a rule', body: 'An RRULE schedule — last Friday, 25th, last business day — that lands payday correctly through weekends and holidays.' },
  ],
  rates: [
    { label: 'Per payslip', value: '0.40' },
    { label: 'Scheduled run', value: 'Free' },
    { label: 'Same-day run', value: '25.00' },
    { label: 'Recall of a failed payment', value: 'Free' },
  ],
  eligibility: [
    'An ICB Business Current account',
    'At least two registered users, so approval is genuinely four-eyes',
    'Employees with domestic or ICB accounts',
  ],
  faqs: [
    {
      question: 'What happens if a row fails validation?',
      answer: 'The run cannot be approved until it is resolved — fix the row, remove it, or explicitly exclude it with a reason. A silent partial payroll is the one outcome the system is designed to prevent.',
    },
    {
      question: 'How do scheduled runs handle bank holidays?',
      answer: 'The schedule is a rule, not a date: “last business day of the month” is computed against the settlement calendar, so January’s run lands correctly without anyone editing a spreadsheet.',
    },
    {
      question: 'Do employees who bank with ICB get paid faster?',
      answer: 'Yes — their salary posts as an instant internal transfer at the moment the run executes, any hour. Domestic rows go on the standard T+1 rail, or same-day for 25.00 per run.',
    },
  ],
};
