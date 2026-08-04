'use client';

import type { Table } from '@tanstack/react-table';

import { Button } from '../primitives/button';
import { IconDownload, IconFilter } from '../primitives/icons';

export interface DataTableToolbarProps<TData> {
  table: Table<TData>;
  /** Presence enables the export button. */
  onExportCsv?: () => void;
}

/**
 * Table toolbar: column visibility and CSV export.
 *
 * The visibility menu is a native `<details>` disclosure rather than a popover, so it works
 * without portalling and closes on second toggle; the column label falls back to a humanised
 * column id when the header is not a plain string.
 */
export function DataTableToolbar<TData>({ table, onExportCsv }: Readonly<DataTableToolbarProps<TData>>) {
  const hideable = table.getAllLeafColumns().filter((column) => column.getCanHide());

  return (
    <div className="flex items-center justify-end gap-2">
      {hideable.length > 0 ? (
        <details className="group relative">
          <summary className="inline-flex h-8 cursor-pointer list-none items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--icb-border-strong)] bg-[var(--icb-surface)] px-3 text-[0.8125rem] font-medium text-[var(--icb-text)] hover:bg-[var(--icb-bg-muted)] [&::-webkit-details-marker]:hidden">
            <IconFilter size={16} /> Columns
          </summary>
          <div className="absolute right-0 z-20 mt-1 w-52 rounded-[var(--radius-md)] border border-[var(--icb-border)] bg-[var(--icb-surface)] p-1.5 shadow-[var(--shadow-md)]">
            {hideable.map((column) => (
              <label
                key={column.id}
                className="flex cursor-pointer items-center gap-2 rounded-[var(--radius-sm)] px-2 py-1.5 text-sm capitalize hover:bg-[var(--icb-bg-muted)]"
              >
                <input
                  type="checkbox"
                  checked={column.getIsVisible()}
                  onChange={column.getToggleVisibilityHandler()}
                  className="accent-[var(--icb-primary)]"
                />
                {typeof column.columnDef.header === 'string'
                  ? column.columnDef.header
                  : column.id.replaceAll('_', ' ')}
              </label>
            ))}
          </div>
        </details>
      ) : null}
      {onExportCsv ? (
        <Button
          variant="secondary"
          size="sm"
          onClick={onExportCsv}
          leadingIcon={<IconDownload size={16} />}
        >
          Export CSV
        </Button>
      ) : null}
    </div>
  );
}
