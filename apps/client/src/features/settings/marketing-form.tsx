'use client';

import { Checkbox } from '@icb/ui';
import { useActionState } from 'react';

import { SubmitRow } from './form-parts';
import { saveMarketingAction, type SettingsActionState } from './profile-actions';

const INITIAL: SettingsActionState = { error: null, done: false };

/**
 * Marketing opt-ins. Off by default and plainly labelled — a bank earns trust by meaning the
 * word "optional".
 */
export function MarketingForm({
  initial,
}: Readonly<{ initial: { marketingEmail: boolean; marketingSms: boolean } }>) {
  const [state, action, pending] = useActionState(saveMarketingAction, INITIAL);

  return (
    <form action={action} className="space-y-4">
      <Checkbox
        name="marketingEmail"
        defaultChecked={initial.marketingEmail}
        label="Offers and product news by email"
      />
      <Checkbox
        name="marketingSms"
        defaultChecked={initial.marketingSms}
        label="Offers and product news by text message"
      />
      <p className="text-xs text-[var(--icb-text-subtle)]">
        Statements, security alerts and transaction notifications are not marketing — those are
        controlled under Notifications and are never switched off here.
      </p>
      <SubmitRow pending={pending} label="Save preferences" state={state} doneText="Preferences saved." />
    </form>
  );
}
