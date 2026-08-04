'use client';

import type { TransferQuote } from '@icb/contracts';
import { Amount, Button, DefinitionList, formatDate, formatTime } from '@icb/ui';
import { ArrowLeft } from 'lucide-react';

import { QuoteCountdown } from './quote-countdown';

interface QuoteStepProps {
  quote: TransferQuote;
  expired: boolean;
  busy: boolean;
  onExpired: () => void;
  onBack: () => void;
  onContinue: () => void;
}

/**
 * Step 2 — the priced quote: fees line by line, the FX rate when currencies differ, the
 * arrival estimate, and a live countdown to the rate-lock expiry.
 */
export function QuoteStep({
  quote,
  expired,
  busy,
  onExpired,
  onBack,
  onContinue,
}: Readonly<QuoteStepProps>) {
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold">Your quote</h2>
        <QuoteCountdown expiresAt={quote.expiresAt} onExpired={onExpired} />
      </div>

      <div className="rounded-[var(--radius-md)] border border-[var(--icb-border)] px-4 py-1">
        <DefinitionList
          items={[
            { id: 'send', term: 'You send', description: <Amount value={quote.debitAmount} /> },
            ...(quote.fx
              ? [
                  {
                    id: 'rate',
                    term: 'Exchange rate',
                    description: `1 ${quote.fx.fromAmount.currency} = ${quote.fx.rate} ${quote.fx.toAmount.currency}`,
                  },
                  {
                    id: 'receive',
                    term: 'Recipient gets',
                    description: <Amount value={quote.creditAmount} direction="credit" />,
                  },
                ]
              : []),
            ...quote.fees.map((fee) => ({
              id: fee.code,
              term: fee.label,
              description: <Amount value={fee.amount} size="sm" />,
            })),
            {
              id: 'total-fees',
              term: 'Total fees',
              description: <Amount value={quote.totalFees} size="sm" />,
            },
            {
              id: 'total',
              term: 'Total to debit',
              description: <Amount value={quote.totalDebit} />,
            },
            {
              id: 'arrival',
              term: 'Arrives by',
              description: `${formatDate(quote.estimatedArrival, 'medium')} · ${formatTime(quote.estimatedArrival)}`,
            },
          ]}
        />
      </div>

      {quote.requiresApproval ? (
        <p className="rounded-[var(--radius-md)] border border-[var(--icb-warning-border)] bg-[var(--icb-warning-bg)] px-4 py-3 text-sm text-[var(--icb-warning-fg)]">
          This amount needs a second approval from our team before it is released. It will show
          as pending approval after you confirm.
        </p>
      ) : null}
      {quote.requiresStepUp ? (
        <p className="rounded-[var(--radius-md)] bg-[var(--icb-bg-muted)] px-4 py-3 text-sm text-[var(--icb-text-muted)]">
          This transfer is above your verified limit — we will ask for a fresh authentication
          code at the next step.
        </p>
      ) : null}

      {expired ? (
        <p role="alert" className="text-sm font-medium text-[var(--icb-danger-fg)]">
          This quote has expired. Go back and request a fresh one to continue.
        </p>
      ) : null}

      <div className="flex gap-3">
        <Button variant="secondary" onClick={onBack} disabled={busy}>
          <ArrowLeft size={16} />
          {expired ? 'Re-quote' : 'Back'}
        </Button>
        <Button size="lg" block disabled={expired || busy} loading={busy} onClick={onContinue}>
          Continue
        </Button>
      </div>
    </div>
  );
}
