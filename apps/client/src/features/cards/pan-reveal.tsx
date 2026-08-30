'use client';

import { Button } from '@icb/ui';
import { Eye, EyeOff } from 'lucide-react';
import { useEffect, useState, useTransition } from 'react';

import { FormError } from '../form-controls';
import { revealCardAction, type RevealState } from './reveal-actions';

const AUTO_HIDE_FALLBACK_MS = 60_000;

/**
 * The full card number, fetched on demand over the customer's session.
 *
 * Nothing is fetched until the customer asks; and once shown, the details hide themselves at the
 * `hideAfter` deadline the API set — they are never cached, never written to storage.
 */
export function PanReveal({ cardId }: Readonly<{ cardId: string }>) {
  const [state, setState] = useState<RevealState>({
    status: 'idle',
    error: null,
    details: null,
  });
  const [pending, startTransition] = useTransition();

  const reveal = () => {
    startTransition(async () => setState(await revealCardAction(cardId)));
  };

  if (state.status === 'revealed' && state.details) {
    return (
      <RevealedDetails
        details={state.details}
        onHide={() => setState({ status: 'idle', error: null, details: null })}
      />
    );
  }

  return (
    <div>
      <Button
        variant="secondary"
        size="sm"
        leadingIcon={<Eye size={15} />}
        loading={pending}
        onClick={reveal}
      >
        Show card number
      </Button>
      {state.status === 'error' ? (
        <div className="mt-2">
          <FormError message={state.error} />
        </div>
      ) : (
        <p className="mt-2 text-xs text-[var(--icb-text-subtle)]">
          The details hide themselves again after a short time.
        </p>
      )}
    </div>
  );
}

function RevealedDetails({
  details,
  onHide,
}: Readonly<{
  details: {
    pan: string;
    cvv: string;
    expiryMonth: number;
    expiryYear: number;
    cardholderName: string;
    hideAfter: string;
  };
  onHide: () => void;
}>) {
  const [secondsLeft, setSecondsLeft] = useState(() =>
    Math.max(1, Math.round((new Date(details.hideAfter).getTime() - Date.now()) / 1000)),
  );

  useEffect(() => {
    const deadline = new Date(details.hideAfter).getTime();
    const timer = setInterval(() => {
      const left = Math.round((deadline - Date.now()) / 1000);
      if (left <= 0) {
        clearInterval(timer);
        onHide();
        return;
      }
      setSecondsLeft(left);
    }, 1000);
    const fallback = setTimeout(onHide, AUTO_HIDE_FALLBACK_MS);
    return () => {
      clearInterval(timer);
      clearTimeout(fallback);
    };
  }, [details.hideAfter, onHide]);

  return (
    <div
      className="rounded-[var(--radius-md)] border border-[var(--icb-border)] bg-[var(--icb-bg-subtle)] p-4"
      role="region"
      aria-label="Card details"
    >
      <p className="tabular font-mono text-lg tracking-[0.14em]">{groupPan(details.pan)}</p>
      <dl className="mt-3 flex gap-6 text-xs">
        <div>
          <dt className="text-[var(--icb-text-subtle)]">Expires</dt>
          <dd className="tabular mt-0.5 font-mono">
            {String(details.expiryMonth).padStart(2, '0')}/{String(details.expiryYear).slice(-2)}
          </dd>
        </div>
        <div>
          <dt className="text-[var(--icb-text-subtle)]">CVV</dt>
          <dd className="tabular mt-0.5 font-mono">{details.cvv}</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-[var(--icb-text-subtle)]">Name</dt>
          <dd className="mt-0.5 truncate uppercase">{details.cardholderName}</dd>
        </div>
      </dl>
      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-xs text-[var(--icb-text-subtle)]" role="timer">
          Hides in {secondsLeft}s
        </p>
        <Button variant="ghost" size="sm" leadingIcon={<EyeOff size={14} />} onClick={onHide}>
          Hide now
        </Button>
      </div>
    </div>
  );
}

function groupPan(pan: string): string {
  return pan.replace(/(\d{4})(?=\d)/g, '$1 ');
}
