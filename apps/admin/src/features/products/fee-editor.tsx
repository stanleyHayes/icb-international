'use client';

import type { Fee, Product } from '@icb/contracts';
import { Amount, Button, formatMoney } from '@icb/ui';
import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { ConfirmAction } from '@/features/support/confirm-action';

import { AddFeeDialog } from './add-fee-dialog';
import { saveFeesAction } from './catalogue-actions';

/** A fee's charge at a glance: flat amount, or a percentage with its floor and cap. */
function ChargeCell({ fee }: Readonly<{ fee: Fee }>) {
  if (fee.basis === 'flat' && fee.amount) {
    return <Amount value={fee.amount} size="sm" />;
  }
  if (fee.percentage !== null) {
    const bounds = [
      fee.minimum ? `min ${formatMoney(fee.minimum)}` : null,
      fee.maximum ? `max ${formatMoney(fee.maximum)}` : null,
    ].filter(Boolean);
    return (
      <span className="tabular text-xs">
        {fee.percentage}%{bounds.length > 0 ? ` (${bounds.join(', ')})` : ''}
      </span>
    );
  }
  return <span className="text-xs text-[var(--icb-text-subtle)]">—</span>;
}

/**
 * The fee schedule editor.
 *
 * Fees are edited as a set and committed together: the catalogue API replaces the schedule
 * wholesale, so the working copy lives client-side until the operator confirms the commit —
 * which is also the moment removals are called out, because a removed fee stops being charged.
 */
export function FeeEditor({ product }: Readonly<{ product: Product }>) {
  const [fees, setFees] = useState<Fee[]>(product.fees);
  const [adding, setAdding] = useState(false);

  const currency = product.currencies[0] ?? 'GHS';
  const dirty = JSON.stringify(fees) !== JSON.stringify(product.fees);
  const removed = product.fees.filter((fee) => !fees.some((f) => f.code === fee.code)).length;
  const plural = removed === 1 ? '' : 's';
  const saveDescription =
    removed > 0
      ? `This publishes the schedule and removes ${removed} fee${plural} — removed fees stop being charged immediately.`
      : 'This publishes the working schedule to the catalogue.';

  const removeFee = (code: string) =>
    setFees((current) => current.filter((item) => item.code !== code));
  const addFee = (fee: Fee) => {
    setFees((current) => [...current, fee]);
    setAdding(false);
  };

  return (
    <div className="space-y-4">
      {fees.length > 0 ? (
        <FeeTable fees={fees} onRemove={removeFee} />
      ) : (
        <p className="text-sm text-[var(--icb-text-subtle)]">No fees on this product.</p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          leadingIcon={<Plus size={15} />}
          onClick={() => setAdding(true)}
        >
          Add fee
        </Button>
        <span aria-disabled={!dirty} className={dirty ? '' : 'pointer-events-none opacity-50'}>
          <ConfirmAction
            triggerLabel="Save fee schedule"
            title="Commit the fee schedule?"
            description={saveDescription}
            confirmLabel="Publish schedule"
            danger={removed > 0}
            action={saveFeesAction}
            fields={{ productCode: product.code, feesJson: JSON.stringify(fees) }}
          />
        </span>
        {dirty ? (
          <span className="text-xs text-[var(--icb-text-subtle)]">Unpublished changes</span>
        ) : null}
      </div>

      <AddFeeDialog
        open={adding}
        currency={currency}
        onClose={() => setAdding(false)}
        onAdd={addFee}
      />
    </div>
  );
}

function FeeTable({
  fees,
  onRemove,
}: Readonly<{ fees: Fee[]; onRemove: (code: string) => void }>) {
  return (
    <div className="overflow-x-auto rounded-[var(--radius-md)] border border-[var(--icb-border)]">
      <table className="w-full text-sm">
        <caption className="sr-only">Fee schedule working copy</caption>
        <thead>
          <tr className="border-b border-[var(--icb-border)] bg-[var(--icb-bg-subtle)] text-left text-[0.7rem] tracking-[0.08em] text-[var(--icb-text-subtle)] uppercase">
            <th scope="col" className="px-4 py-2 font-medium">
              Fee
            </th>
            <th scope="col" className="px-4 py-2 font-medium">
              Basis
            </th>
            <th scope="col" className="px-4 py-2 text-right font-medium">
              Charge
            </th>
            <th scope="col" className="px-4 py-2 text-right font-medium">
              <span className="sr-only">Remove</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--icb-border)]">
          {fees.map((fee) => (
            <tr key={fee.code}>
              <td className="px-4 py-2.5">
                <p className="font-medium">{fee.label}</p>
                <p className="font-mono text-xs text-[var(--icb-text-subtle)]">{fee.code}</p>
              </td>
              <td className="px-4 py-2.5 text-xs capitalize">{fee.basis}</td>
              <td className="px-4 py-2.5 text-right">
                <ChargeCell fee={fee} />
              </td>
              <td className="px-4 py-2.5 text-right">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  leadingIcon={<Trash2 size={14} />}
                  onClick={() => onRemove(fee.code)}
                >
                  Remove
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
