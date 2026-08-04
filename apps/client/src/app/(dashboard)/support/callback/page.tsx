import type { CustomerProfile } from '@icb/contracts';
import { Card, CardBody, CardHeader, EmptyState, StatusBadge, formatDate, formatTime } from '@icb/ui';
import { Phone } from 'lucide-react';
import type { Metadata } from 'next';

import { CallbackForm } from '@/features/support/callback-form';
import type { CallbackView } from '@/features/support/types';
import { api } from '@/lib/api';

export const metadata: Metadata = { title: 'Request a callback' };

const WINDOW_LABELS: Record<string, string> = {
  any: 'any time',
  morning: 'in the morning',
  afternoon: 'in the afternoon',
  evening: 'in the evening',
};

/**
 * Callbacks. The request goes to the support team with the chosen window; past requests are
 * listed underneath so the customer can see a callback was actually booked, not just hoped for.
 */
export default async function CallbackPage() {
  const [profile, callbacks] = await Promise.all([
    api<CustomerProfile>('/customers/me', { tags: ['profile'] }),
    api<CallbackView[]>('/support/callbacks', { tags: ['support'] }),
  ]);

  return (
    <>
      <header>
        <h1 className="font-display text-3xl font-bold tracking-[-0.02em]">Request a callback</h1>
        <p className="mt-1.5 text-sm text-[var(--icb-text-muted)]">
          We call you, on the number on your account — so you never have to wonder whether the
          person calling is really us.
        </p>
      </header>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Book a call" />
          <CardBody className="pt-0">
            <CallbackForm defaultPhone={profile.phone} />
          </CardBody>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader title="Your callbacks" />
          {callbacks.length > 0 ? (
            <ul className="divide-y divide-[var(--icb-border)]">
              {callbacks.map((callback) => (
                <li key={callback.id} className="flex items-center gap-4 px-5 py-3.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{callback.reason}</p>
                    <p className="mt-0.5 text-xs text-[var(--icb-text-subtle)]">
                      Requested {formatDate(callback.requestedAt, 'medium')}{' '}
                      {formatTime(callback.requestedAt)} ·{' '}
                      {WINDOW_LABELS[callback.preferredWindow] ?? callback.preferredWindow}
                    </p>
                  </div>
                  <StatusBadge status={callback.status} />
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              icon={<Phone size={20} />}
              title="No callbacks yet"
              description="Callbacks you book will appear here with their status."
            />
          )}
        </Card>
      </div>
    </>
  );
}
