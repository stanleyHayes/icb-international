import { ArrowLeftRight, CreditCard, LayoutDashboard, ShieldCheck } from 'lucide-react';
import Link from 'next/link';

const TOUR_STOPS = [
  {
    href: '/',
    icon: LayoutDashboard,
    title: 'Overview',
    detail: 'Your whole position at a glance — balances, recent activity, what needs attention.',
  },
  {
    href: '/transfer',
    icon: ArrowLeftRight,
    title: 'Transfer',
    detail: 'Between your accounts, to other ICB customers, or by domestic and international rails.',
  },
  {
    href: '/cards',
    icon: CreditCard,
    title: 'Cards',
    detail: 'Create virtual cards, freeze a misplaced one, and control where each card works.',
  },
  {
    href: '/account/security',
    icon: ShieldCheck,
    title: 'Security',
    detail: 'Turn on two-factor authentication and see every device signed in to your account.',
  },
] as const;

/**
 * First login, done: the two-minute tour.
 *
 * Four stops, each a real place the customer can go now — a tour that teaches the map rather
 * than performing a walkthrough over it.
 */
export function OnboardingTour() {
  return (
    <div className="space-y-8">
      <ul className="grid gap-4 sm:grid-cols-2">
        {TOUR_STOPS.map((stop) => (
          <li key={stop.href}>
            <Link
              href={stop.href}
              className="flex h-full items-start gap-3 rounded-[var(--radius-lg)] border border-[var(--icb-border)] p-4 transition-colors hover:border-[var(--icb-primary)] hover:bg-[var(--icb-bg-muted)]"
            >
              <span
                aria-hidden="true"
                className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--icb-bg-muted)] text-[var(--icb-text-muted)]"
              >
                <stop.icon size={17} />
              </span>
              <span>
                <span className="block text-sm font-semibold">{stop.title}</span>
                <span className="mt-0.5 block text-sm text-[var(--icb-text-muted)]">
                  {stop.detail}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <Link
        href="/"
        className="inline-flex h-11 items-center gap-2 rounded-[var(--radius-md)] bg-[var(--icb-primary)] px-5 text-sm font-medium text-white shadow-[var(--shadow-xs)] transition-colors hover:bg-[var(--icb-primary-hover)]"
      >
        Go to your dashboard
      </Link>
    </div>
  );
}
