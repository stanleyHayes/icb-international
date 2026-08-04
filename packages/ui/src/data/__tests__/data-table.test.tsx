import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { DataTable, type ColumnDef } from '../data-table';

interface Person {
  id: string;
  name: string;
  balance: number;
}

const COLUMNS: ColumnDef<Person, unknown>[] = [
  { accessorKey: 'name', header: 'Name' },
  { accessorKey: 'balance', header: 'Balance' },
];

const PEOPLE: Person[] = [
  { id: 'p1', name: 'Adaeze', balance: 1200 },
  { id: 'p2', name: 'Kwame', balance: 3400 },
];

function renderTable(extra: Partial<Parameters<typeof DataTable<Person>>[0]> = {}) {
  return renderToStaticMarkup(
    <DataTable columns={COLUMNS} data={PEOPLE} getRowId={(row) => row.id} {...extra} />,
  );
}

describe('DataTable', () => {
  it('renders headers and rows', () => {
    const html = renderTable();
    expect(html).toContain('Name');
    expect(html).toContain('Balance');
    expect(html).toContain('Adaeze');
    expect(html).toContain('3400');
  });

  it('makes sortable column headers toggle buttons', () => {
    const html = renderTable();
    expect(html).toContain('sticky top-0');
    expect((html.match(/<button/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });

  it('renders an empty state when there are no rows', () => {
    const html = renderToStaticMarkup(
      <DataTable columns={COLUMNS} data={[]} emptyState={<p>No people</p>} />,
    );
    expect(html).toContain('No people');
  });

  it('falls back to a default empty state', () => {
    const html = renderToStaticMarkup(<DataTable columns={COLUMNS} data={[]} />);
    expect(html).toContain('Nothing to show');
  });

  it('adds a selection column when row selection is enabled', () => {
    const html = renderTable({ enableRowSelection: true });
    expect(html).toContain('Select all rows');
    expect(html).toContain('Select row');
  });

  it('shows the CSV export button only when a base name is given', () => {
    expect(renderTable({ csvBaseName: 'people' })).toContain('Export CSV');
    expect(renderTable()).not.toContain('Export CSV');
  });

  it('offers the column visibility menu', () => {
    expect(renderTable()).toContain('Columns');
  });
});
