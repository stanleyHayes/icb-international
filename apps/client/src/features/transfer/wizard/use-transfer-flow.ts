'use client';

import type {
  AccountSummary,
  TransferDetail,
  TransferQuote,
  TransferRail,
  TransferTemplate,
} from '@icb/contracts';
import { useState } from 'react';

import { buildDestination } from '../destination';
import { confirmTransferAction, requestQuoteAction } from '../wizard-actions';
import { initialDraft, type TransferDraft } from './draft-types';
import { draftFromTemplate, schedulePayload } from './wizard.helpers';

export type WizardStep = 'details' | 'quote' | 'confirm' | 'receipt';

export interface FlowProps {
  accounts: AccountSummary[];
  initialRail: TransferRail;
  initialFrom: string;
  initialPayee?: string;
  template: TransferTemplate | null;
}

function makeInitialDraft(props: FlowProps): TransferDraft {
  const base = {
    ...initialDraft(props.initialRail, props.initialFrom || (props.accounts[0]?.id ?? '')),
    ...(props.template ? draftFromTemplate(props.template) : {}),
  };
  if (props.initialPayee) {
    base.destination = {
      ...base.destination,
      mode: 'beneficiary',
      beneficiaryId: props.initialPayee,
    };
  }
  return base;
}

/**
 * The state machine behind the transfer wizard: details → quote → confirm → receipt. A quote is
 * mandatory — money never moves on unpriced terms — and quotes expire on a countdown.
 */
export function useTransferFlow(props: FlowProps) {
  const [draft, setDraft] = useState<TransferDraft>(() => makeInitialDraft(props));
  const [step, setStep] = useState<WizardStep>('details');
  const [quote, setQuote] = useState<TransferQuote | null>(null);
  const [quoteExpired, setQuoteExpired] = useState(false);
  const [result, setResult] = useState<TransferDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [stepUpOpen, setStepUpOpen] = useState(false);
  const [stepUpDone, setStepUpDone] = useState(false);

  const patch = (changes: Partial<TransferDraft>) =>
    setDraft((current) => ({ ...current, ...changes }));

  function quoteInput(destination: NonNullable<ReturnType<typeof buildDestination>>) {
    const currency =
      props.accounts.find((account) => account.id === draft.fromAccountId)?.currency ?? 'USD';
    return {
      fromAccountId: draft.fromAccountId,
      destination,
      amountMinorUnits: draft.amountMinorUnits ?? 0,
      currency,
      rail: draft.rail,
      ...(draft.reference ? { reference: draft.reference } : {}),
    };
  }

  async function requestQuote() {
    const destination = buildDestination(draft.rail, draft.destination);
    if (!destination || !draft.amountMinorUnits) {
      setError('Complete the destination and amount before requesting a quote.');
      return;
    }
    setBusy(true);
    setError(null);
    const outcome = await requestQuoteAction(quoteInput(destination));
    setBusy(false);
    if (outcome.ok) {
      setQuote(outcome.data);
      setQuoteExpired(false);
      setStep('quote');
    } else {
      setError(outcome.error);
    }
  }

  async function confirm() {
    if (!quote) {
      return;
    }
    if (quote.requiresStepUp && !stepUpDone) {
      setStepUpOpen(true);
      return;
    }
    await execute();
  }

  async function execute() {
    const destination = buildDestination(draft.rail, draft.destination);
    if (!quote || !destination || !draft.amountMinorUnits) {
      return;
    }
    setBusy(true);
    setError(null);
    const schedule = schedulePayload(draft.schedule);
    const outcome = await confirmTransferAction({
      ...quoteInput(destination),
      quoteId: quote.quoteId,
      ...(schedule ? { schedule } : {}),
      saveBeneficiary: draft.saveBeneficiary,
      ...(draft.templateName.trim() ? { templateName: draft.templateName.trim() } : {}),
    });
    setBusy(false);
    if (outcome.ok) {
      setResult(outcome.data.transfer);
      setStep('receipt');
    } else {
      setError(outcome.error);
    }
  }

  function onStepUpVerified() {
    setStepUpOpen(false);
    setStepUpDone(true);
    void execute();
  }

  function reset() {
    setDraft(initialDraft(props.initialRail, props.initialFrom || (props.accounts[0]?.id ?? '')));
    setQuote(null);
    setResult(null);
    setError(null);
    setQuoteExpired(false);
    setStepUpDone(false);
    setStep('details');
  }

  return {
    draft,
    step,
    quote,
    quoteExpired,
    result,
    error,
    busy,
    stepUpOpen,
    patch,
    setStep,
    setQuoteExpired,
    setStepUpOpen,
    requestQuote,
    confirm,
    onStepUpVerified,
    reset,
  };
}
