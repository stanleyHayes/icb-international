'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import type { OpResult } from '@/features/accounts/actions';

/**
 * Shared plumbing for the account-operation forms: run a server action, surface its message and
 * field errors, and refresh the account page once a change lands.
 */
export function useOpForm<TInput>(action: (input: TInput) => Promise<OpResult>) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const submit = (input: TInput) => {
    startTransition(async () => {
      const result = await action(input);
      setDone(result.ok);
      setMessage(result.message);
      setFieldErrors(result.fieldErrors);
      if (result.ok) {
        router.refresh();
      }
    });
  };

  const reset = () => {
    setDone(false);
    setMessage(null);
    setFieldErrors({});
  };

  return { pending, done, message, fieldErrors, submit, reset };
}

/** Inline result line shared by every op form. */
export function OpMessage({
  done,
  message,
}: Readonly<{ done: boolean; message: string | null }>) {
  if (!message) return null;
  return (
    <p
      role={done ? 'status' : 'alert'}
      className={`text-sm ${done ? 'text-[var(--icb-success-fg)]' : 'text-[var(--icb-danger-fg)]'}`}
    >
      {message}
    </p>
  );
}
