'use client';

import { Star } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { updateBeneficiaryAction } from './actions';

/**
 * Favourite star. Not optimistic: the star is a fraud-relevant sorting signal, so it flips when
 * the API confirms, not before.
 */
export function FavouriteToggle({
  beneficiaryId,
  favourite,
  name,
}: Readonly<{ beneficiaryId: string; favourite: boolean; name: string }>) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle() {
    startTransition(async () => {
      const result = await updateBeneficiaryAction({ beneficiaryId, favourite: !favourite });
      if (result.status === 'error') {
        setError(result.message);
      } else {
        setError(null);
        router.refresh();
      }
    });
  }

  return (
    <span className="inline-flex flex-col items-center">
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        aria-pressed={favourite}
        aria-label={favourite ? `Remove ${name} from favourites` : `Mark ${name} as favourite`}
        className={
          favourite
            ? 'inline-flex h-8 w-8 items-center justify-center rounded-[var(--radius-sm)] text-[var(--icb-accent-text)] transition-colors hover:bg-[var(--icb-bg-muted)]'
            : 'inline-flex h-8 w-8 items-center justify-center rounded-[var(--radius-sm)] text-[var(--icb-text-subtle)] transition-colors hover:bg-[var(--icb-bg-muted)] hover:text-[var(--icb-text)]'
        }
      >
        <Star size={17} fill={favourite ? 'currentColor' : 'none'} aria-hidden="true" />
      </button>
      {error ? (
        <span role="alert" className="sr-only">
          {error}
        </span>
      ) : null}
    </span>
  );
}
