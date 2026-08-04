import { Card } from '@icb/ui';

/**
 * The bordered, caption-labelled table every rate or fee schedule on the site renders through.
 * The first column is the row's subject and is set in body-weight type; the rest are figures.
 */
export function RateTable({
  caption,
  columns,
  rows,
}: Readonly<{
  caption: string;
  columns: readonly string[];
  rows: readonly (readonly string[])[];
}>) {
  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className="border-b border-[var(--icb-border)] bg-[var(--icb-bg-muted)] text-left text-[0.7rem] tracking-[0.08em] text-[var(--icb-text-subtle)] uppercase">
              {columns.map((column) => (
                <th key={column} scope="col" className="px-5 py-2.5 font-medium">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--icb-border)]">
            {rows.map((row) => (
              <tr key={row.join('|')}>
                {row.map((cell, index) => (
                  <td
                    key={cell + String(index)}
                    className={
                      index === 0
                        ? 'px-5 py-3 font-medium'
                        : 'tabular px-5 py-3 text-[var(--icb-text-muted)]'
                    }
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
