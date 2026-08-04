'use client';

import type { AccountSummary, Beneficiary } from '@icb/contracts';
import { Amount, Button, Field, Input, MoneyInput, Select, maskIdentifier } from '@icb/ui';
import { AlertCircle } from 'lucide-react';

import { buildDestination } from '../destination';
import { railInfo } from '../transfer.constants';
import { DestinationFields } from './destination-fields';
import type { TransferDraft } from './draft-types';
import { ScheduleFields } from './schedule-fields';

interface DetailsStepProps {
  draft: TransferDraft;
  accounts: AccountSummary[];
  beneficiaries: Beneficiary[];
  error: string | null;
  busy: boolean;
  onChange: (patch: Partial<TransferDraft>) => void;
  onQuote: () => void;
}

/** The quote button stays disabled until the draft could survive the API's own validation. */
function draftReady(draft: TransferDraft): boolean {
  const destinationReady = buildDestination(draft.rail, draft.destination) !== null;
  const scheduleReady =
    draft.schedule.mode === 'now' || /^\d{4}-\d{2}-\d{2}$/.test(draft.schedule.startsOn);
  return destinationReady && scheduleReady && (draft.amountMinorUnits ?? 0) > 0;
}

/**
 * Step 1 — the instruction itself: from, to, how much, when. Nothing is sent until a quote
 * prices it; this step only builds a complete, valid draft.
 */
export function DetailsStep({
  draft,
  accounts,
  beneficiaries,
  error,
  busy,
  onChange,
  onQuote,
}: Readonly<DetailsStepProps>) {
  const from = accounts.find((account) => account.id === draft.fromAccountId);
  const currency = from?.currency ?? 'USD';
  const rail = railInfo(draft.rail);

  return (
    <div className="space-y-5">
      <p className="rounded-[var(--radius-md)] bg-[var(--icb-bg-muted)] px-4 py-3 text-sm text-[var(--icb-text-muted)]">
        <span className="font-medium text-[var(--icb-text)]">{rail.title}</span> · {rail.eta} ·{' '}
        {rail.description}
      </p>

      {error ? <StepError message={error} /> : null}

      <Field label="From" required>
        <Select
          value={draft.fromAccountId}
          onChange={(event) =>
            onChange({
              fromAccountId: event.target.value,
              destination: { ...draft.destination, accountId: '' },
            })
          }
        >
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.nickname ?? account.productName} ·{' '}
              {maskIdentifier(account.identifiers.number)}
            </option>
          ))}
        </Select>
        {from ? (
          <p className="mt-1.5 text-xs text-[var(--icb-text-subtle)]">
            Available <Amount value={from.balances.available} size="sm" />
          </p>
        ) : null}
      </Field>

      <DestinationFields
        rail={draft.rail}
        draft={draft.destination}
        accounts={accounts}
        beneficiaries={beneficiaries}
        fromAccountId={draft.fromAccountId}
        onChange={(patch) => onChange({ destination: { ...draft.destination, ...patch } })}
      />

      <Field label="Amount" required>
        <MoneyInput
          value={draft.amountMinorUnits}
          onChange={(minorUnits) => onChange({ amountMinorUnits: minorUnits })}
          currency={currency}
          required
        />
      </Field>

      <Field label="Reference" description="Shown to the recipient. Optional.">
        <Input
          value={draft.reference}
          onChange={(event) => onChange({ reference: event.target.value })}
          maxLength={140}
          placeholder="What is this for?"
        />
      </Field>

      <ScheduleFields
        draft={draft.schedule}
        onChange={(patch) => onChange({ schedule: { ...draft.schedule, ...patch } })}
      />

      <Button size="lg" block disabled={!draftReady(draft) || busy} loading={busy} onClick={onQuote}>
        {busy ? 'Getting your quote…' : 'Review quote'}
      </Button>
    </div>
  );
}

function StepError({ message }: Readonly<{ message: string }>) {
  return (
    <p
      role="alert"
      className="flex items-start gap-2 rounded-[var(--radius-md)] border border-[var(--icb-danger-border)] bg-[var(--icb-danger-bg)] px-4 py-3 text-sm text-[var(--icb-danger-fg)]"
    >
      <AlertCircle size={16} className="mt-0.5 shrink-0" />
      {message}
    </p>
  );
}
