import type { NotificationPreference } from '@icb/contracts';
import { Card, CardBody, CardHeader } from '@icb/ui';
import type { Metadata } from 'next';

import { NotificationMatrix } from '@/features/settings/notification-matrix';
import type { QuietHoursInput } from '@/features/settings/notification-actions';
import { api } from '@/lib/api';

export const metadata: Metadata = { title: 'Notifications' };

interface PreferencesView {
  preferences: NotificationPreference[];
  quietHours: QuietHoursInput | null;
}

/**
 * Notification preferences: the full event-by-channel matrix plus quiet hours. Security
 * alerts are always delivered — the matrix controls everything else.
 */
export default async function NotificationsPage() {
  const view = await api<PreferencesView>('/notifications/preferences', {
    tags: ['notification-prefs'],
  });

  return (
    <>
      <header>
        <h1 className="font-display text-3xl font-bold tracking-[-0.02em]">Notifications</h1>
        <p className="mt-1.5 text-sm text-[var(--icb-text-muted)]">
          Which events reach you, on which channel — and when nothing but a security alert may
          disturb you.
        </p>
      </header>

      <Card className="mt-8">
        <CardHeader
          title="Channels by event"
          description="Untick a channel to silence it for that event. Changes save as one set."
        />
        <CardBody className="pt-0">
          <NotificationMatrix preferences={view.preferences} quietHours={view.quietHours} />
        </CardBody>
      </Card>
    </>
  );
}
