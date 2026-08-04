
import type { ProductCopy } from './products';
import { productRoute } from '@/lib/routes';

/**
 * Business product copy — same shape and same rule as `products.ts`: a rate or a fee appears in
 * exactly one place, and every figure matches the API's product catalogue.
 */
export const BUSINESS_PRODUCTS: readonly ProductCopy[] = [
  {
    slug: 'business-current',
    name: 'Business Current',
    tagline: 'Multi-currency, multi-user',
    description:
      'A current account for companies, with role-based access for your team, bulk payments by CSV, and every posting exportable for your accountant.',
    headline: '15',
    headlineNote: 'currencies in one account',
    href: productRoute('/business/business-current'),
    features: [
      'Bulk payments: upload a CSV, validate the batch, execute once',
      'Role-based access with a four-eyes control on high-value payments',
      'Standing orders on an RRULE schedule',
      'Export to CSV, OFX or PDF for any period',
      'Full posting breakdown on every transaction',
    ],
    fees: [
      { label: 'Monthly maintenance', value: '18.00' },
      { label: 'Domestic transfer', value: 'Free' },
      { label: 'Bulk payment batch', value: '0.15 per row' },
      { label: 'International payment', value: '0.35% spread' },
    ],
  },
  {
    slug: 'merchant-services',
    name: 'Merchant Services',
    tagline: 'Get paid, settle next day',
    description:
      'Card acceptance for online and in-person sales, settling into your ICB business current account the next business day. Disputes are handled in the same dashboard as the rest of your banking.',
    headline: '1.2%',
    headlineNote: 'per domestic consumer card transaction',
    href: productRoute('/business/merchant-services'),
    features: [
      'Payment links and a hosted checkout for online sales',
      'In-person acceptance with next-day settlement',
      'Every settlement reconciled to the individual sale',
      'Chargeback console with evidence upload and status tracking',
      'Payouts land in your business current account, not a third-party balance',
    ],
    fees: [
      { label: 'Online (consumer cards)', value: '1.2% + 0.20' },
      { label: 'In-person', value: '0.9%' },
      { label: 'Settlement', value: 'Free, next day' },
      { label: 'Chargeback', value: '15.00' },
    ],
  },
  {
    slug: 'trade-finance',
    name: 'Trade Finance',
    tagline: 'Working capital that moves with the shipment',
    description:
      'Letters of credit, documentary collections and invoice finance for importers and exporters, priced against the corridor rather than a flat book rate.',
    headline: '0.35%',
    headlineNote: 'FX spread on trade corridors',
    href: productRoute('/business/trade-finance'),
    features: [
      'Letters of credit issued against your facility',
      'Documentary collections with status at every hop',
      'Invoice finance up to 85% of the invoice value',
      'Corridor-specific pricing, quoted per transaction',
      'Correspondent hops visible on the payment timeline',
    ],
    fees: [
      { label: 'LC issuance', value: '0.75% per quarter' },
      { label: 'Documentary collection', value: '65.00' },
      { label: 'Invoice finance', value: 'from 9.4% APR' },
    ],
  },
  {
    slug: 'payroll',
    name: 'Payroll',
    tagline: 'Payday, without the spreadsheet panic',
    description:
      'Salary runs built on the same bulk-payment engine as everything else: upload or build the run, validate every row, approve with four eyes, and schedule it on a rule that survives bank holidays.',
    headline: '0.40',
    headlineNote: 'per payslip, per run',
    href: productRoute('/business/payroll'),
    features: [
      'Build a run by CSV or from a saved template',
      'Every row validated — sort code, account, duplicate — before approval',
      'Four-eyes approval on the whole run, not row by row',
      'RRULE scheduling that respects weekends and holidays',
      'Employees paid by instant internal transfer where they bank with ICB',
    ],
    fees: [
      { label: 'Per payslip', value: '0.40' },
      { label: 'Scheduled run', value: 'Free' },
      { label: 'Same-day run', value: '25.00' },
      { label: 'Recall of a failed payment', value: 'Free' },
    ],
  },
  {
    slug: 'business-loans',
    name: 'Business Lending',
    tagline: 'Term loans and revolving facilities',
    description:
      'Borrow against your trading history rather than a form. Term loans to 250,000 and revolving facilities that draw and repay as your cash cycle demands.',
    headline: 'from 7.4%',
    headlineNote: 'representative APR',
    href: productRoute('/business/business-loans'),
    features: [
      'Term loans from 10,000 to 250,000',
      'Revolving facility with interest on the drawn balance only',
      'Underwriting factors shown to you, not just to us',
      'Restructure without a new application',
      'Repayments allocated fees, interest, then principal',
    ],
    fees: [
      { label: 'Arrangement fee', value: '1.5% of facility' },
      { label: 'Non-utilisation', value: '0.5% per annum' },
      { label: 'Early settlement', value: '1.0% in year one' },
    ],
  },
] as const;
