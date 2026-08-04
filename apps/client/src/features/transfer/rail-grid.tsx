import {
  ArrowRight,
  CalendarClock,
  FileUp,
  LayoutTemplate,
  Users,
} from 'lucide-react';
import type { Route } from 'next';
import Link from 'next/link';

import { RAILS } from './transfer.constants';

const TOOLS = [
  { href: '/transfer/scheduled', label: 'Scheduled & standing orders', icon: CalendarClock },
  { href: '/transfer/bulk', label: 'Bulk upload (CSV)', icon: FileUp },
  { href: '/transfer/templates', label: 'Saved templates', icon: LayoutTemplate },
  { href: '/beneficiaries', label: 'Payees', icon: Users },
] as const;

/**
 * The rail picker: five ways to move money, each deep-linking into the priced flow with the
 * rail preselected, plus the supporting tools.
 */
export function RailGrid({ fromQuery }: Readonly<{ fromQuery: string }>) {
  return (
    <section aria-labelledby="rails" className="mt-8">
      <h2 id="rails" className="sr-only">
        Choose a transfer type
      </h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {RAILS.map((rail) => (
          <Link
            key={rail.rail}
            href={`/transfer/new?rail=${rail.rail}${fromQuery}`}
            className="group rounded-[var(--radius-lg)] border border-[var(--icb-border)] bg-[var(--icb-surface)] p-5 transition-colors hover:border-[var(--icb-primary)]"
          >
            <div className="flex items-start justify-between gap-3">
              <p className="font-medium">{rail.title}</p>
              <ArrowRight
                size={16}
                className="mt-0.5 shrink-0 text-[var(--icb-text-subtle)] transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--icb-primary)]"
              />
            </div>
            <p className="mt-1 text-xs font-medium tracking-[0.08em] text-[var(--icb-primary)] uppercase">
              {rail.eta}
            </p>
            <p className="mt-2 text-sm text-[var(--icb-text-muted)]">{rail.description}</p>
          </Link>
        ))}
        <div className="rounded-[var(--radius-lg)] border border-dashed border-[var(--icb-border-strong)] p-5">
          <p className="text-sm font-medium text-[var(--icb-text-muted)]">More ways to pay</p>
          <ul className="mt-3 space-y-2">
            {TOOLS.map((tool) => (
              <li key={tool.href}>
                <Link
                  href={tool.href as Route}
                  className="flex items-center gap-2 text-sm text-[var(--icb-text-muted)] transition-colors hover:text-[var(--icb-primary)]"
                >
                  <tool.icon size={15} />
                  {tool.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
