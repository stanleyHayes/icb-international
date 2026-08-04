'use client';

import type { AccountSummary, Beneficiary, TransferQuote } from '@icb/contracts';
import {
  Amount,
  Button,
  Checkbox,
  DefinitionList,
  Field,
  Input,
  formatDate,
  formatTime,
  maskIdentifier,
} from '@icb/ui';
import { AlertCircle, ArrowLeft } from 'lucide-react';

import { buildDestination, describeDestination } from '../destination';
import { frequencyLabel, railInfo, rruleFor } from '../transfer.constants';
import type { TransferDraft } from './draft-types';

interface ConfirmStepProps {
  draft: TransferDraft;
  quote: TransferQuote;
  accounts: AccountSummary[];
  beneficiaries: Beneficiary[];
  error: string | null;
  busy: boolean;
  onChange: (patch: Partial<TransferDraft>) => void;
  onBack: () => void;
  onConfirm: () => void;
}

function scheduleSummary(draft: TransferDraft): string {
  if (draft.schedule.mode === 'now') {
    return 'Immediately';
  }
  const start = formatDate(draft.schedule.startsOn, 'medium');
  if (draft.schedule.mode === 'later') {
    return `Once, on ${start}`;
  }
  const until = draft.schedule.endsOn ? ` until ${formatDate(draft.schedule.endsOn, 'medium')}` : '';
  return `${frequencyLabel(rruleFor(draft.schedule.frequency))}, from ${start}${until}`;
}

function destinationLabel(draft: TransferDraft, beneficiaries: Beneficiary[]): string {
  if (draft.destination.mode === 'beneficiary') {
    const payee = beneficiaries.find((b) => b.id === draft.destination.beneficiaryId);
    return payee ? `${payee.nickname ?? payee.name} · ${payee.displayIdentifier}` : 'Saved payee';
  }
  const destination = buildDestination(draft.rail, draft.destination);
  return destination ? describeDestination(destination) : '—';
}

/**
 * Step 3 — the final read-back: rail, destination, amounts, ETA and schedule in one summary,
 * with optional save-as-payee / save-as-template. Confirming here moves money.
 */
export function ConfirmStep({
  draft,
  quote,
  accounts,
  beneficiaries,
  error,
  busy,
  onChange,
  onBack,
  onConfirm,
}: Readonly<ConfirmStepProps>) {
  const from = accounts.find((account) => account.id === draft.fromAccountId);
  const rail = railInfo(draft.rail);
  const canSavePayee = draft.destination.mode === 'new' && draft.rail !== 'internal';

  return (
    <div className="space-y-5">
      <h2 className="text-lg font-semibold">Confirm your transfer</h2>

      {error ? (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-[var(--radius-md)] border border-[var(--icb-danger-border)] bg-[var(--icb-danger-bg)] px-4 py-3 text-sm text-[var(--icb-danger-fg)]"
        >
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          {error}
        </p>
      ) : null}

      <div className="rounded-[var(--radius-md)] border border-[var(--icb-border)] px-4 py-1">
        <DefinitionList
          items={[
            {
              id: 'from',
              term: 'From',
              description: from
                ? `${from.nickname ?? from.productName} · ${maskIdentifier(from.identifiers.number)}`
                : '—',
            },
            { id: 'to', term: 'To', description: destinationLabel(draft, beneficiaries) },
            { id: 'rail', term: 'Rail', description: `${rail.title} · ${rail.eta}` },
            { id: 'amount', term: 'You send', description: <Amount value={quote.debitAmount} /> },
            ...(quote.fx
              ? [
                  {
                    id: 'fx',
                    term: 'Recipient gets',
                    description: (
                      <span>
                        <Amount value={quote.creditAmount} direction="credit" /> at {quote.fx.rate}
                      </span>
                    ),
                  },
                ]
              : []),
            { id: 'fees', term: 'Fees', description: <Amount value={quote.totalFees} size="sm" /> },
            { id: 'total', term: 'Total to debit', description: <Amount value={quote.totalDebit} /> },
            {
              id: 'arrival',
              term: 'Arrives by',
              description: `${formatDate(quote.estimatedArrival, 'medium')} · ${formatTime(quote.estimatedArrival)}`,
            },
            { id: 'when', term: 'When', description: scheduleSummary(draft) },
            ...(draft.reference
              ? [{ id: 'ref', term: 'Reference', description: draft.reference }]
              : []),
          ]}
        />
      </div>

      {canSavePayee ? (
        <Checkbox
          label="Save this payee for next time"
          checked={draft.saveBeneficiary}
          onChange={(event) => onChange({ saveBeneficiary: event.target.checked })}
        />
      ) : null}

      <Field
        label="Save as template"
        description="Name these terms to re-run them in one tap. Optional."
      >
        <Input
          value={draft.templateName}
          onChange={(event) => onChange({ templateName: event.target.value })}
          maxLength={60}
          placeholder="e.g. Monthly rent"
        />
      </Field>

      <div className="flex gap-3">
        <Button variant="secondary" onClick={onBack} disabled={busy}>
          <ArrowLeft size={16} />
          Back
        </Button>
        <Button size="lg" block loading={busy} disabled={busy} onClick={onConfirm}>
          {confirmLabel(busy, quote.requiresStepUp)}
        </Button>
      </div>
    </div>
  );
}

function confirmLabel(busy: boolean, requiresStepUp: boolean): string {
  if (busy) {
    return 'Sending…';
  }
  return requiresStepUp ? 'Verify and confirm' : 'Confirm transfer';
}
