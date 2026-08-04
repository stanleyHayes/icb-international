'use client';

import type { AccountSummary, LoanProduct, LoanQuote } from '@icb/contracts';
import { useState, useTransition } from 'react';

import { quoteLoanAction } from './actions';
import { DetailsAndReview } from './wizard-details';
import { AmountStep, ProductStep } from './wizard-steps';

const STEPS = ['Product', 'Amount', 'Details', 'Review'] as const;

/**
 * Borrow, in four steps: choose a product, price the amount and term, declare the finances the
 * underwriter scores, then review and submit. Nothing is left behind until the final submit.
 */
export function ApplicationWizard({
  products,
  accounts,
  initialProductCode,
}: Readonly<{
  products: LoanProduct[];
  accounts: AccountSummary[];
  initialProductCode?: string | undefined;
}>) {
  const [step, setStep] = useState(1);
  const [productCode, setProductCode] = useState(initialProductCode ?? products[0]?.code ?? '');
  const [amountDraft, setAmountDraft] = useState('');
  const [termMonths, setTermMonths] = useState(36);
  const [quote, setQuote] = useState<LoanQuote | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [quoting, startQuote] = useTransition();

  const product = products.find((item) => item.code === productCode) ?? products[0];
  const currency = product?.currency ?? accounts[0]?.currency ?? 'USD';

  const requestQuote = () => {
    startQuote(async () => {
      const result = await quoteLoanAction({ productCode, amountDraft, termMonths, currency });
      setQuoteError(result.error);
      if (result.quote) {
        setQuote(result.quote);
        setStep(3);
      }
    });
  };

  return (
    <div>
      <ol aria-label="Application progress" className="flex gap-2">
        {STEPS.map((label, index) => (
          <li
            key={label}
            aria-current={step === index + 1 ? 'step' : undefined}
            className={
              step === index + 1
                ? 'flex-1 rounded-full bg-[var(--icb-primary)] px-3 py-1.5 text-center text-xs font-semibold text-white'
                : 'flex-1 rounded-full bg-[var(--icb-bg-muted)] px-3 py-1.5 text-center text-xs font-medium text-[var(--icb-text-subtle)]'
            }
          >
            {label}
          </li>
        ))}
      </ol>

      <div className="mt-6">
        <WizardStep
          step={step}
          products={products}
          product={product}
          quote={quote}
          accounts={accounts}
          productCode={productCode}
          amountDraft={amountDraft}
          termMonths={termMonths}
          quoteError={quoteError}
          quoting={quoting}
          onSelectProduct={setProductCode}
          onAmount={setAmountDraft}
          onTerm={setTermMonths}
          onQuote={requestQuote}
          onStep={setStep}
        />
      </div>
    </div>
  );
}

interface WizardStepProps {
  readonly step: number;
  readonly products: LoanProduct[];
  readonly product: LoanProduct | undefined;
  readonly quote: LoanQuote | null;
  readonly accounts: AccountSummary[];
  readonly productCode: string;
  readonly amountDraft: string;
  readonly termMonths: number;
  readonly quoteError: string | null;
  readonly quoting: boolean;
  readonly onSelectProduct: (code: string) => void;
  readonly onAmount: (draft: string) => void;
  readonly onTerm: (months: number) => void;
  readonly onQuote: () => void;
  readonly onStep: (step: number) => void;
}

function WizardStep(props: WizardStepProps) {
  const { step, products, product, quote, productCode, onSelectProduct, onStep } = props;

  if (step === 1) {
    return (
      <ProductStep
        products={products}
        selected={productCode}
        onSelect={onSelectProduct}
        onNext={() => onStep(2)}
      />
    );
  }
  if (step === 2 && product) {
    return (
      <AmountStep
        product={product}
        amountDraft={props.amountDraft}
        termMonths={props.termMonths}
        quoteError={props.quoteError}
        quoting={props.quoting}
        onAmount={props.onAmount}
        onTerm={props.onTerm}
        onBack={() => onStep(1)}
        onQuote={props.onQuote}
      />
    );
  }
  if (step >= 3 && product && quote) {
    return (
      <DetailsAndReview
        step={step}
        product={product}
        quote={quote}
        accounts={props.accounts}
        amountDraft={props.amountDraft}
        termMonths={props.termMonths}
        onBack={() => onStep(step - 1)}
        onNext={() => onStep(4)}
      />
    );
  }
  return null;
}

