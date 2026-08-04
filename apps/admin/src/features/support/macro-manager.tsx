'use client';

import { Button } from '@icb/ui';
import { Pencil, Plus } from 'lucide-react';
import { useState } from 'react';

import { ConfirmAction } from './confirm-action';
import { deleteMacroAction } from './macro-actions';
import { MacroFormDialog } from './macro-form-dialog';
import type { MacroView } from './types';

/**
 * Macro management.
 *
 * Macros are shared by the whole support team, so the list shows how often each one has been
 * used — a macro nobody fires is a candidate for deletion, which itself is confirmed because
 * other agents may rely on it.
 */
export function MacroManager({ macros }: Readonly<{ macros: MacroView[] }>) {
  const [editing, setEditing] = useState<MacroView | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const openForm = (macro: MacroView | null) => {
    setEditing(macro);
    setFormOpen(true);
  };

  return (
    <>
      <div className="flex justify-end">
        <Button type="button" leadingIcon={<Plus size={16} />} onClick={() => openForm(null)}>
          New macro
        </Button>
      </div>

      <div className="mt-4 overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--icb-border)]">
        <table className="w-full min-w-[640px] text-sm">
          <caption className="sr-only">Saved reply macros</caption>
          <thead>
            <tr className="border-b border-[var(--icb-border)] bg-[var(--icb-bg-subtle)] text-left text-[0.7rem] tracking-[0.08em] text-[var(--icb-text-subtle)] uppercase">
              <th scope="col" className="px-5 py-2.5 font-medium">
                Name
              </th>
              <th scope="col" className="px-3 py-2.5 font-medium">
                Category
              </th>
              <th scope="col" className="px-3 py-2.5 text-right font-medium">
                Times used
              </th>
              <th scope="col" className="px-5 py-2.5 text-right font-medium">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--icb-border)]">
            {macros.map((macro) => (
              <MacroRow key={macro.id} macro={macro} onEdit={() => openForm(macro)} />
            ))}
          </tbody>
        </table>
      </div>

      <MacroFormDialog
        key={editing?.id ?? 'new'}
        open={formOpen}
        editing={editing}
        onClose={() => setFormOpen(false)}
      />
    </>
  );
}

function MacroRow({ macro, onEdit }: Readonly<{ macro: MacroView; onEdit: () => void }>) {
  return (
    <tr className="hover:bg-[var(--icb-bg-subtle)]">
      <td className="px-5 py-3">
        <p className="font-medium">{macro.name}</p>
        <p className="mt-0.5 max-w-md truncate text-xs text-[var(--icb-text-subtle)]">
          {macro.body}
        </p>
      </td>
      <td className="px-3 py-3 text-xs capitalize">{macro.category}</td>
      <td className="tabular px-3 py-3 text-right text-xs">{macro.usageCount}</td>
      <td className="px-5 py-3">
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            leadingIcon={<Pencil size={14} />}
            onClick={onEdit}
          >
            Edit
          </Button>
          <ConfirmAction
            triggerLabel="Delete"
            triggerVariant="ghost"
            title={`Delete “${macro.name}”?`}
            description="Agents will no longer be able to apply this macro. Tickets already answered with it keep their replies."
            confirmLabel="Delete macro"
            danger
            action={deleteMacroAction}
            fields={{ macroId: macro.id }}
          />
        </div>
      </td>
    </tr>
  );
}
