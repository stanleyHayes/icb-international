import type { CustomerProfile } from '@icb/contracts';
import { Card, CardBody, CardHeader } from '@icb/ui';
import type { Metadata } from 'next';

import { ContactPrefsForm } from '@/features/settings/contact-prefs-form';
import { ThemeToggle } from '@/features/settings/theme-toggle';
import { api } from '@/lib/api';

export const metadata: Metadata = { title: 'Preferences' };

/**
 * Language, timezone, statement delivery and appearance. Balances themselves are always shown
 * in the account's own currency — an account denominated in cedis displays cedis, wherever the
 * interface language points.
 */
export default async function PreferencesPage() {
  const profile = await api<CustomerProfile>('/customers/me', { tags: ['profile'] });

  return (
    <>
      <header>
        <h1 className="font-display text-3xl font-bold tracking-[-0.02em]">Preferences</h1>
        <p className="mt-1.5 text-sm text-[var(--icb-text-muted)]">
          How the dashboard speaks to you.
        </p>
      </header>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Language and region" />
          <CardBody className="pt-0">
            <ContactPrefsForm
              initial={{
                locale: profile.preferences.locale,
                timezone: profile.preferences.timezone,
                statementDelivery: profile.preferences.statementDelivery,
              }}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Appearance"
            description="Applies immediately and is remembered on this device."
          />
          <CardBody className="pt-0">
            <ThemeToggle />
          </CardBody>
        </Card>
      </div>
    </>
  );
}
