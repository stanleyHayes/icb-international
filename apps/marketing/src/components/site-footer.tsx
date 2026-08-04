import { IcbMark } from '@icb/ui';
import type { Route } from 'next';
import Link from 'next/link';

import { productRoute } from '@/lib/routes';

interface FooterColumn {
  heading: string;
  links: readonly { href: Route; label: string }[];
}

const COLUMNS: readonly FooterColumn[] = [
  {
    heading: 'Personal',
    links: [
      { href: productRoute('/personal/current'), label: 'Current accounts' },
      { href: productRoute('/personal/savings'), label: 'Savings' },
      { href: productRoute('/personal/deposits'), label: 'Fixed deposits' },
      { href: productRoute('/personal/cards'), label: 'Debit cards' },
      { href: productRoute('/personal/loans'), label: 'Personal loans' },
      { href: productRoute('/personal/mortgages'), label: 'Mortgages' },
    ],
  },
  {
    heading: 'Business',
    links: [
      { href: productRoute('/business/business-current'), label: 'Business current' },
      { href: productRoute('/business/merchant-services'), label: 'Merchant services' },
      { href: productRoute('/business/trade-finance'), label: 'Trade finance' },
      { href: productRoute('/business/payroll'), label: 'Payroll' },
      { href: productRoute('/business/business-loans'), label: 'Business loans' },
    ],
  },
  {
    heading: 'Wealth',
    links: [
      { href: productRoute('/wealth/investments'), label: 'Investment accounts' },
      { href: productRoute('/wealth/fx'), label: 'Foreign exchange' },
      { href: productRoute('/wealth/private-banking'), label: 'Private banking' },
    ],
  },
  {
    heading: 'Company',
    links: [
      { href: '/about', label: 'About ICB' },
      { href: '/rates', label: 'Rates & fees' },
      { href: '/security', label: 'Security centre' },
      { href: '/support', label: 'Help & support' },
      { href: '/tools', label: 'Calculators & tools' },
      { href: '/security/fraud-awareness', label: 'Fraud awareness' },
      { href: '/security/deposit-protection', label: 'Deposit protection' },
      { href: '/careers', label: 'Careers' },
      { href: '/newsroom', label: 'Newsroom' },
      { href: '/contact', label: 'Contact us' },
    ],
  },
  {
    heading: 'Legal',
    links: [
      { href: '/legal/terms', label: 'Terms' },
      { href: '/legal/privacy', label: 'Privacy' },
      { href: '/legal/cookies', label: 'Cookies' },
      { href: '/legal/accessibility', label: 'Accessibility' },
      { href: '/complaints', label: 'Complaints' },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-[var(--icb-border)] bg-[var(--icb-navy-950)] text-[var(--icb-navy-100)]">
      <div className="mx-auto max-w-[1200px] px-5 py-16">
        <div className="grid gap-12 lg:grid-cols-[1.4fr_3fr]">
          <div>
            <span className="inline-flex items-center gap-2.5">
              <IcbMark className="h-9 w-9 text-white" id="footer" />
              <span className="flex flex-col leading-none">
                <span className="font-display text-[1.4rem] leading-none font-extrabold tracking-[-0.01em] text-white">
                  ICB
                </span>
                <span className="mt-1 text-[0.5rem] leading-none font-semibold tracking-[0.18em] text-[var(--icb-navy-300)] uppercase">
                  International Commercial Bank
                </span>
              </span>
            </span>
            <p className="mt-5 max-w-xs text-sm leading-relaxed text-[var(--icb-navy-200)]">
              A full-service commercial bank built on a real double-entry core. Every posting is
              immutable and traceable to the cent.
            </p>
            <p className="mt-6 font-mono text-xs text-[var(--icb-navy-300)]">
              SWIFT/BIC ICBKGHAC · Sort code 60-16-13
            </p>
          </div>

          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 lg:grid-cols-5">
            {COLUMNS.map((column) => (
              <div key={column.heading}>
                <h2 className="text-xs font-semibold tracking-[0.14em] text-[var(--icb-navy-300)] uppercase">
                  {column.heading}
                </h2>
                <ul className="mt-4 space-y-2.5">
                  {column.links.map((link) => (
                    <li key={link.href + link.label}>
                      <Link
                        href={link.href}
                        className="text-sm text-[var(--icb-navy-100)] transition-colors hover:text-white"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-14 flex flex-col gap-3 border-t border-white/10 pt-8 text-xs text-[var(--icb-navy-300)] sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} ICB International Commercial Bank. All rights reserved.</p>
          <p>Deposits protected up to 250,000 per depositor.</p>
        </div>
      </div>
    </footer>
  );
}
