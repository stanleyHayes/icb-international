import type { Table } from '@tanstack/react-table';

import { toCsv } from './csv';
import { SELECTION_COLUMN_ID } from './data-table.constants';

/**
 * Serialise the table as the reader currently sees it: visible columns only, in the current sort
 * order. Values come from the column accessors (`row.getValue`), not the rendered cells, so a
 * cell that renders an <Amount> still exports a number.
 */
export function tableToCsv<TData>(table: Table<TData>): string {
  const columns = table
    .getVisibleLeafColumns()
    .filter((column) => column.id !== SELECTION_COLUMN_ID);
  const headers = columns.map((column) =>
    typeof column.columnDef.header === 'string' ? column.columnDef.header : column.id,
  );
  const rows = table
    .getRowModel()
    .rows.map((row) => columns.map((column) => row.getValue(column.id)));
  return toCsv(headers, rows);
}
