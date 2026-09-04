'use client';

import type { AccountSummary, DepositRateBand } from '@icb/contracts';
import { Amount, Button, maskIdentifier } from '@icb/ui';
import { useRouter } from 'next/navigation';
import { useActionState, useEffect, useState } from 'react';

import { FormError, MoneyField, SelectField } from '../form-controls';
import { openDepositAction, type SavingsActionState } from './actions';
import type { Route } from 'next';

const IDLE: SavingsActionState = { status: 'idle', message: null, fieldErrors: {}, id: null };

const INSTRUCTIONS = [
  { value: 'transfer_out', label: 'Pay it back into my account' },
  { value: 'rollover_principal', label: 'Reinvest the principal, pay out the interest' },
  { value: 'rollover_all', label: 'Reinvest principal and interest' },
] as const;

/**
 * Open a fixed deposit against the published rate card. The term is chosen from the rate bands
 * themselves — a term with no published rate cannot be opened.
 */
export function DepositForm({
  bands,
  accounts,
}: Readonly<{ bands: DepositRateBand[]; accounts: AccountSummary[] }>) {
  const [state, action, pending] = useActionState(openDepositAction, IDLE);
  const [term, setTerm] = useState(bands[0]?.termMonths ?? 12);
  const router = useRouter();

  useEffect(() => {
    if (state.status === 'success' && state.id) {
      router.push(`/savings/deposits/${state.id}` as Route);
    }
  }, [state.status, state.id, router]);

  const currency = accounts[0]?.currency ?? 'USD';
  const band = bands.find((item) => item.termMonths === term) ?? bands[0];

  return (
    <form action={action} className="space-y-5" noValidate>
      <input type="hidden" name="currency" value={currency} />
      <input type="hidden" name="termMonths" value={term} />
      <FormError message={state.status === 'error' ? state.message : null} />

      <fieldset>
        <legend className="text-sm font-medium">Term</legend>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {bands.map((item) => (
            <button
              key={`${item.termMonths}:${item.minimumAmount.minorUnits}`}
              type="button"
              aria-pressed={term === item.termMonths}
              onClick={() => setTerm(item.termMonths)}
              className={
                term === item.termMonths
                  ? 'rounded-[var(--radius-md)] border border-[var(--icb-primary)] bg-[var(--icb-navy-50)] p-3 text-center'
                  : 'rounded-[var(--radius-md)] border border-[var(--icb-border-strong)] p-3 text-center hover:bg-[var(--icb-bg-muted)]'
              }
            >
              <span className="tabular block text-sm font-semibold">{item.rate}%</span>
              <span className="mt-0.5 block text-xs text-[var(--icb-text-subtle)]">
                {item.termMonths} month{item.termMonths === 1 ? '' : 's'}
              </span>
            </button>
          ))}
        </div>
      </fieldset>

      <SelectField
        label="Fund from"
        name="fromAccountId"
        options={accounts.map((account) => ({
          value: account.id,
          label: `${account.nickname ?? account.productName} · ${maskIdentifier(account.identifiers.number)}`,
        }))}
        error={state.fieldErrors['fromAccountId']}
      />

      <MoneyField
        label="Amount to lock in"
        name="principal"
        currency={currency}
        error={state.fieldErrors['principal']}
      />
      {band ? (
        <p className="-mt-3 text-xs text-[var(--icb-text-subtle)]">
          Minimum for this term: <Amount value={band.minimumAmount} size="sm" />
        </p>
      ) : null}

      <SelectField
        label="At maturity"
        name="maturityInstruction"
        options={[...INSTRUCTIONS]}
      />

      <SelectField
        label="Account for payout or rollover"
        name="rolloverAccountId"
        hint="(uses the funding account if blank)"
        options={[
          { value: '', label: 'Same as funding account' },
          ...accounts.map((account) => ({
            value: account.id,
            label: `${account.nickname ?? account.productName} · ${maskIdentifier(account.identifiers.number)}`,
          })),
        ]}
      />

      <p className="text-xs leading-relaxed text-[var(--icb-text-subtle)]">
        Breaking a deposit before maturity forfeits part of the accrued interest — the exact
        penalty is quoted before you confirm, never discovered afterwards.
      </p>

      <Button type="submit" size="lg" block loading={pending}>
        Open deposit
      </Button>
    </form>
  );
}
