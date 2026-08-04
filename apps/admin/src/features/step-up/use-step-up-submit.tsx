'use client';

import { useRef, useState, type FormEvent, type RefObject } from 'react';

import { StepUpDialog } from './step-up-dialog';

interface StepUpSubmit {
  formRef: RefObject<HTMLFormElement | null>;
  tokenInputRef: RefObject<HTMLInputElement | null>;
  /** Attach to the form's `onSubmit`: blocks the first submit and opens the dialog instead. */
  handleSubmit: (event: FormEvent<HTMLFormElement>) => void;
  /** Render inside the form; holds the minted token for the real submit. */
  dialog: React.ReactNode;
}

/**
 * Wires a sensitive form to forced re-authentication.
 *
 * The first submit is intercepted to collect a fresh second-factor proof; once the dialog
 * verifies, the proof token is dropped into a hidden input and the form submits for real.
 * The API then checks `x-step-up-token` on the mutation itself — the guard, not this hook,
 * is the enforcement.
 */
export function useStepUpSubmit(purpose: string, actionLabel: string): StepUpSubmit {
  const formRef = useRef<HTMLFormElement>(null);
  const tokenInputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    if (!tokenInputRef.current?.value) {
      event.preventDefault();
      setOpen(true);
    }
  };

  const handleVerified = (token: string) => {
    if (tokenInputRef.current) {
      tokenInputRef.current.value = token;
    }
    setOpen(false);
    formRef.current?.requestSubmit();
  };

  return {
    formRef,
    tokenInputRef,
    handleSubmit,
    dialog: (
      <StepUpDialog
        open={open}
        purpose={purpose}
        actionLabel={actionLabel}
        onClose={() => setOpen(false)}
        onVerified={handleVerified}
      />
    ),
  };
}
