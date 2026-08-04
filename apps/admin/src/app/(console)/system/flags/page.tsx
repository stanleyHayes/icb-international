import type { FeatureFlag } from '@icb/contracts';
import { Card, EmptyState } from '@icb/ui';
import { ToggleLeft } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { AccessDenied } from '@/components/access-denied';
import { FlagRow } from '@/features/system/flag-row';
import { api } from '@/lib/api';
import { isForbidden } from '@/lib/guards';

export const metadata: Metadata = { title: 'Feature flags' };

/**
 * Feature flags.
 *
 * What is on, for whom, and how far it has rolled out. Changes apply at the API immediately —
 * there is no draft state, which is why the console shows exactly what the bank is running.
 */
export default async function FeatureFlagsPage() {
  let flags: FeatureFlag[];
  try {
    const response = await api<{ items: FeatureFlag[] }>('/simulation/flags');
    flags = response.items;
  } catch (error) {
    if (isForbidden(error)) {
      return <AccessDenied area="feature flag management" />;
    }
    throw error;
  }

  return (
    <>
      <header>
        <p className="text-sm text-[var(--icb-text-subtle)]">
          <Link href="/system" className="hover:underline">
            System
          </Link>
          {' / '}
          Feature flags
        </p>
        <h1 className="mt-1 font-display text-3xl font-bold tracking-[-0.02em]">Feature flags</h1>
        <p className="mt-1.5 text-sm text-[var(--icb-text-muted)]">
          {flags.length} flag{flags.length === 1 ? '' : 's'} · changes take effect immediately
        </p>
      </header>

      <Card className="mt-6 overflow-hidden">
        {flags.length > 0 ? (
          <ul className="divide-y divide-[var(--icb-border)]">
            {flags.map((flag) => (
              <FlagRow key={flag.key} flag={flag} />
            ))}
          </ul>
        ) : (
          <EmptyState
            icon={<ToggleLeft size={20} />}
            title="No flags defined"
            description="Feature flags appear here once they are registered."
          />
        )}
      </Card>
    </>
  );
}
