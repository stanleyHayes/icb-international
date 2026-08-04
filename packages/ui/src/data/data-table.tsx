'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type Header,
  type Row,
  type RowSelectionState,
  type SortingState,
  type Table,
  type VisibilityState,
} from '@tanstack/react-table';

export type { ColumnDef } from '@tanstack/react-table';

import { cn } from '../lib/cn';
import { EmptyState } from '../feedback/empty-state';
import { IconChevronDown, IconChevronUp } from '../primitives/icons';
import { csvFilename } from './csv';
import { tableToCsv } from './data-table-csv';
import { DataTableToolbar } from './data-table-toolbar';
import {
  DATA_TABLE_MAX_HEIGHT,
  DATA_TABLE_OVERSCAN,
  DATA_TABLE_ROW_HEIGHT,
  SELECTION_COLUMN_ID,
} from './data-table.constants';
import { useVirtualRows, type VirtualRows } from './use-virtual-rows';

export interface DataTableProps<TData> {
  columns: ColumnDef<TData, unknown>[];
  data: TData[];
  getRowId?: (row: TData, index: number) => string;
  /** Adds a leading checkbox column; selection is reported through `onSelectionChange`. */
  enableRowSelection?: boolean;
  onSelectionChange?: (rows: TData[]) => void;
  /** Base name for the CSV download, e.g. `transactions`. Presence enables the export button. */
  csvBaseName?: string;
  /** Window the rows. Turn on for anything that can grow past a few hundred rows. */
  virtualize?: boolean;
  /** Scroll-region height in px; the header sticks to its top. */
  maxHeight?: number;
  emptyState?: ReactNode;
  className?: string;
}

function selectionColumn<TData>(): ColumnDef<TData, unknown> {
  const checkboxClass = 'accent-[var(--icb-primary)]';
  return {
    id: SELECTION_COLUMN_ID,
    enableSorting: false,
    enableHiding: false,
    header: ({ table }) => (
      <input
        type="checkbox"
        aria-label="Select all rows"
        checked={table.getIsAllPageRowsSelected()}
        onChange={table.getToggleAllPageRowsSelectedHandler()}
        className={checkboxClass}
      />
    ),
    cell: ({ row }) => (
      <input
        type="checkbox"
        aria-label="Select row"
        checked={row.getIsSelected()}
        disabled={!row.getCanSelect()}
        onChange={row.getToggleSelectedHandler()}
        className={checkboxClass}
      />
    ),
  };
}

function downloadTableCsv<TData>(table: Table<TData>, baseName: string) {
  if (typeof document === 'undefined') {
    return;
  }
  const url = URL.createObjectURL(new Blob([tableToCsv(table)], { type: 'text/csv' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = csvFilename(baseName, new Date());
  anchor.click();
  URL.revokeObjectURL(url);
}

function SortableHeader<TData>({ header }: Readonly<{ header: Header<TData, unknown> }>) {
  const content = flexRender(header.column.columnDef.header, header.getContext());
  if (!header.column.getCanSort()) {
    return <>{content}</>;
  }
  const direction = header.column.getIsSorted();
  return (
    <button
      type="button"
      onClick={header.column.getToggleSortingHandler()}
      className="inline-flex items-center gap-1 uppercase"
    >
      {content}
      {direction === 'asc' ? (
        <IconChevronUp size={16} />
      ) : (
        <IconChevronDown size={16} className={direction === 'desc' ? '' : 'opacity-40'} />
      )}
    </button>
  );
}

function TableHead<TData>({ table }: Readonly<{ table: Table<TData> }>) {
  return (
    <thead className="sticky top-0 z-10 bg-[var(--icb-surface)] shadow-[0_1px_0_var(--icb-border)]">
      {table.getHeaderGroups().map((headerGroup) => (
        <tr key={headerGroup.id}>
          {headerGroup.headers.map((header) => (
            <th
              key={header.id}
              className="px-4 py-3 text-xs font-semibold tracking-[0.06em] text-[var(--icb-text-subtle)] uppercase"
            >
              {header.isPlaceholder ? null : <SortableHeader header={header} />}
            </th>
          ))}
        </tr>
      ))}
    </thead>
  );
}

function BodyRow<TData>({ row }: Readonly<{ row: Row<TData> }>) {
  return (
    <tr
      data-state={row.getIsSelected() ? 'selected' : undefined}
      className="border-b border-[var(--icb-border)] hover:bg-[var(--icb-bg-muted)] data-[state=selected]:bg-[var(--icb-gold-50)]"
    >
      {row.getVisibleCells().map((cell) => (
        <td key={cell.id} className="px-4 py-3 text-sm">
          {flexRender(cell.column.columnDef.cell, cell.getContext())}
        </td>
      ))}
    </tr>
  );
}

function SpacerRow({ height, colSpan }: Readonly<{ height: number; colSpan: number }>) {
  if (height <= 0) {
    return null;
  }
  return (
    <tr aria-hidden="true">
      <td colSpan={colSpan} style={{ height, padding: 0 }} />
    </tr>
  );
}

interface TableBodyProps<TData> {
  rows: Row<TData>[];
  virtual: VirtualRows;
  virtualize: boolean;
  columnCount: number;
  emptyState?: ReactNode;
}

function TableBody<TData>({ rows, virtual, virtualize, columnCount, emptyState }: Readonly<TableBodyProps<TData>>) {
  if (rows.length === 0) {
    return (
      <tbody>
        <tr>
          <td colSpan={columnCount}>{emptyState ?? <EmptyState title="Nothing to show" />}</td>
        </tr>
      </tbody>
    );
  }
  const visibleRows = virtualize ? rows.slice(virtual.startIndex, virtual.endIndex) : rows;
  return (
    <tbody>
      {virtualize ? <SpacerRow height={virtual.paddingTop} colSpan={columnCount} /> : null}
      {visibleRows.map((row) => (
        <BodyRow key={row.id} row={row} />
      ))}
      {virtualize ? <SpacerRow height={virtual.paddingBottom} colSpan={columnCount} /> : null}
    </tbody>
  );
}

/**
 * The data table.
 *
 * Sorting, column visibility, row selection, and CSV export come from @tanstack/react-table;
 * windowing is hand-rolled because rows are a fixed height. The header sticks to the scroll
 * region, and an empty table renders a real empty state rather than a blank grid.
 */
export function DataTable<TData>(props: Readonly<DataTableProps<TData>>) {
  const {
    columns: columnDefs,
    data,
    getRowId,
    enableRowSelection = false,
    onSelectionChange,
    csvBaseName,
    virtualize = false,
    maxHeight = DATA_TABLE_MAX_HEIGHT,
    emptyState,
    className,
  } = props;
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  const columns = useMemo(
    () => (enableRowSelection ? [selectionColumn<TData>(), ...columnDefs] : columnDefs),
    [columnDefs, enableRowSelection],
  );

  const table = useReactTable({
    data,
    columns,
    state: { sorting, columnVisibility, rowSelection },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    enableRowSelection,
    ...(getRowId ? { getRowId } : {}),
  });

  useEffect(() => {
    onSelectionChange?.(table.getSelectedRowModel().rows.map((row) => row.original));
  });

  const rows = table.getRowModel().rows;
  const virtual = useVirtualRows({
    rowCount: rows.length,
    rowHeight: DATA_TABLE_ROW_HEIGHT,
    overscan: DATA_TABLE_OVERSCAN,
    enabled: virtualize,
  });

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <DataTableToolbar
        table={table}
        {...(csvBaseName ? { onExportCsv: () => { downloadTableCsv(table, csvBaseName); } } : {})}
      />
      <div
        ref={virtual.containerRef}
        onScroll={virtual.onScroll}
        style={{ maxHeight }}
        className="overflow-auto rounded-[var(--radius-md)] border border-[var(--icb-border)] bg-[var(--icb-surface)]"
      >
        <table className="w-full border-collapse text-left">
          <TableHead table={table} />
          <TableBody
            rows={rows}
            virtual={virtual}
            virtualize={virtualize}
            columnCount={table.getVisibleLeafColumns().length}
            {...(emptyState ? { emptyState } : {})}
          />
        </table>
      </div>
    </div>
  );
}
