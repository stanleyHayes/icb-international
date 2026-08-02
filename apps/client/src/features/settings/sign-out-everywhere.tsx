'use client';

import { Button } from '@icb/ui';
import { LogOut } from 'lucide-react';
import { useState } from 'react';

import { signOutEverywhereAction } from './actions';

/**
 * Destructive and irreversible, so it confirms first.
 *
 * Almost everything else in ICB is one tap. This one costs the customer their session on every
 * device including the one they are holding, so it earns the extra step.
 */
export function SignOutEverywhere() {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <Button
        variant="secondary"
        className="mt-4"
        leadingIcon={<LogOut size={16} />}
        onClick={() => setConfirming(true)}
      >
        Sign out everywhere
      </Button>
    );
  }

  return (
    <form action={signOutEverywhereAction} className="mt-4 flex flex-wrap gap-2">
      <Button type="submit" variant="danger">
        Yes, end every session
      </Button>
      <Button type="button" variant="ghost" onClick={() => setConfirming(false)}>
        Cancel
      </Button>
    </form>
  );
}
