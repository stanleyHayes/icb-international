'use client';

import { Button } from '@icb/ui';
import { Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useId, useState } from 'react';

import { CARD_KIND_OPTIONS, CARD_STATUS_OPTIONS } from './cards.constants';

interface CardSearchProps {
  readonly defaultAccountId: string;
  readonly defaultStatus: string;
  readonly defaultKind: string;
}

/**
 * The card search bar.
 *
 * The query goes in the URL rather than component state so an agent can paste a link to exactly
 * the result set they are looking at — the same convention as customer search.
 */
export function CardSearch({ defaultAccountId, defaultStatus, defaultKind }: CardSearchProps) {
  const router = useRouter();
  const [accountId, setAccountId] = useState(defaultAccountId);
  const [status, setStatus] = useState(defaultStatus);
  const [kind, setKind] = useState(defaultKind);
  const accountIdId = useId();
  const statusId = useId();
  const kindId = useId();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const params = new URLSearchParams();
    if (accountId.trim()) params.set('accountId', accountId.trim());
    if (status) params.set('status', status);
    if (kind) params.set('kind', kind);
    router.push(params.size > 0 ? `/cards?${params.toString()}` : '/cards');
  }

  return (
    <form onSubmit={submit} className="flex flex-wrap items-end gap-3">
      <div className="min-w-[280px] flex-1">
        <label
          htmlFor={accountIdId}
          className="block text-xs font-medium text-[var(--icb-text-muted)]"
        >
          Account ID
        </label>
        <input
          id={accountIdId}
          value={accountId}
          onChange={(event) => setAccountId(event.target.value)}
          placeholder="List cards for an account"
          className="mt-1 h-10 w-full rounded-[var(--radius-md)] border border-[var(--icb-border-strong)] bg-[var(--icb-surface)] px-3.5 font-mono text-sm outline-none focus:border-[var(--icb-primary)]"
        />
      </div>

      <FilterSelect id={statusId} label="Status" value={status} onChange={setStatus} options={CARD_STATUS_OPTIONS} />
      <FilterSelect id={kindId} label="Kind" value={kind} onChange={setKind} options={CARD_KIND_OPTIONS} />

      <Button type="submit" leadingIcon={<Search size={16} />}>
        Search
      </Button>
    </form>
  );
}

function FilterSelect({
  id,
  label,
  value,
  onChange,
  options,
}: Readonly<{
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly { value: string; label: string }[];
}>) {
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-medium text-[var(--icb-text-muted)]">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 h-10 rounded-[var(--radius-md)] border border-[var(--icb-border-strong)] bg-[var(--icb-surface)] px-3 text-sm outline-none focus:border-[var(--icb-primary)]"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
