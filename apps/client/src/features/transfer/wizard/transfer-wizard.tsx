'use client';

import type { AccountSummary, Beneficiary, TransferRail, TransferTemplate } from '@icb/contracts';

import { ConfirmStep } from './confirm-step';
import { DetailsStep } from './details-step';
import { QuoteStep } from './quote-step';
import { ReceiptStep } from './receipt-step';
import { StepIndicator } from './step-indicator';
import { useTransferFlow } from './use-transfer-flow';

interface TransferWizardProps {
  accounts: AccountSummary[];
  beneficiaries: Beneficiary[];
  initialRail: TransferRail;
  initialFrom: string;
  /** Preselect a saved payee as the destination. */
  initialPayee?: string;
  template: TransferTemplate | null;
}

/** The priced transfer flow; the state machine lives in {@link useTransferFlow}. */
export function TransferWizard(props: Readonly<TransferWizardProps>) {
  const flow = useTransferFlow({
    accounts: props.accounts,
    initialRail: props.initialRail,
    initialFrom: props.initialFrom,
    ...(props.initialPayee ? { initialPayee: props.initialPayee } : {}),
    template: props.template,
  });

  return (
    <div>
      {flow.step !== 'receipt' ? <StepIndicator current={flow.step} /> : null}

      {flow.step === 'details' ? (
        <DetailsStep
          draft={flow.draft}
          accounts={props.accounts}
          beneficiaries={props.beneficiaries}
          error={flow.error}
          busy={flow.busy}
          onChange={flow.patch}
          onQuote={() => void flow.requestQuote()}
        />
      ) : null}

      {flow.step === 'quote' && flow.quote ? (
        <QuoteStep
          quote={flow.quote}
          expired={flow.quoteExpired}
          busy={flow.busy}
          onExpired={() => flow.setQuoteExpired(true)}
          onBack={() => flow.setStep('details')}
          onContinue={() => flow.setStep('confirm')}
        />
      ) : null}

      {flow.step === 'confirm' && flow.quote ? (
        <ConfirmStep
          draft={flow.draft}
          quote={flow.quote}
          accounts={props.accounts}
          beneficiaries={props.beneficiaries}
          error={flow.error}
          busy={flow.busy}
          onChange={flow.patch}
          onBack={() => flow.setStep('quote')}
          onConfirm={() => void flow.confirm()}
        />
      ) : null}

      {flow.step === 'receipt' && flow.result ? (
        <ReceiptStep transfer={flow.result} onReset={flow.reset} />
      ) : null}
    </div>
  );
}
