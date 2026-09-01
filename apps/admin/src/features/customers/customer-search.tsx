'use client';

import { Button, Input, Select as IcbSelect } from '@icb/ui';
import { Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useId, useState } from 'react';

const STATUSES = [
  { value: '', label: 'Any status' },
  { value: 'active', label: 'Active' },
  { value: 'pending_kyc', label: 'Pending KYC' },
  { value: 'dormant', label: 'Dormant' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'closed', label: 'Closed' },
] as const;

const RISK_RATINGS = [
  { value: '', label: 'Any risk' },
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'prohibited', label: 'Prohibited' },
] as const;

/**
 * The search bar.
 *
 * Pushes to the URL rather than holding results in state, so an agent can share the exact view
 * they are looking at and a refresh does not lose it.
 */
export function CustomerSearch({
  defaultQuery,
  defaultStatus,
  defaultRisk,
}: Readonly<{ defaultQuery: string; defaultStatus: string; defaultRisk: string }>) {
  const router = useRouter();
  const [query, setQuery] = useState(defaultQuery);
  const [status, setStatus] = useState(defaultStatus);
  const [risk, setRisk] = useState(defaultRisk);
  const queryId = useId();
  const statusId = useId();
  const riskId = useId();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const params = new URLSearchParams();
    if (query.trim()) params.set('q', query.trim());
    if (status) params.set('status', status);
    if (risk) params.set('riskRating', risk);
    router.push(params.size > 0 ? `/customers?${params.toString()}` : '/customers');
  }

  return (
    <form onSubmit={submit} className="flex flex-wrap items-end gap-3">
      <div className="min-w-[240px] flex-1">
        <label htmlFor={queryId} className="block text-xs font-medium text-[var(--icb-text-muted)]">
          Search
        </label>
        <Input
          id={queryId}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Name, email, phone or account number"
          startIcon={<Search size={16} />}
          className="mt-1 h-10"
        />
      </div>

      <Select id={statusId} label="Status" value={status} onChange={setStatus} options={STATUSES} />
      <Select id={riskId} label="Risk" value={risk} onChange={setRisk} options={RISK_RATINGS} />

      <Button type="submit" leadingIcon={<Search size={16} />}>
        Search
      </Button>
    </form>
  );
}

function Select({
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
      <IcbSelect
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 h-10"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </IcbSelect>
    </div>
  );
}
