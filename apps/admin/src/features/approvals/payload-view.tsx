import { Amount } from '@icb/ui';

/** A value from an approval payload, rendered for a human checker rather than as raw JSON. */
function PayloadValue({ value }: Readonly<{ value: unknown }>) {
  if (value === null || value === undefined) {
    return <span className="text-[var(--icb-text-subtle)]">—</span>;
  }
  if (isMoneyLike(value)) {
    return <Amount value={value} />;
  }
  if (typeof value === 'string') {
    return <span className="break-all">{value}</span>;
  }
  if (typeof value === 'boolean') {
    return <span>{value ? 'Yes' : 'No'}</span>;
  }
  return <code className="font-mono text-xs break-all">{JSON.stringify(value)}</code>;
}

function isMoneyLike(value: unknown): value is { minorUnits: number; currency: string; scale: number } {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.minorUnits === 'number' && typeof candidate.currency === 'string';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Side-by-side field/before/after view for payloads that carry a change set. */
function DiffTable({
  before,
  after,
}: Readonly<{ before: Record<string, unknown>; after: Record<string, unknown> }>) {
  const fields = [...new Set([...Object.keys(before), ...Object.keys(after)])];

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-[var(--icb-border)] bg-[var(--icb-bg-subtle)] text-left text-[0.7rem] tracking-[0.08em] text-[var(--icb-text-subtle)] uppercase">
          <th scope="col" className="px-5 py-2.5 font-medium">Field</th>
          <th scope="col" className="px-3 py-2.5 font-medium">Before</th>
          <th scope="col" className="px-5 py-2.5 font-medium">After</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-[var(--icb-border)]">
        {fields.map((field) => {
          const changed = JSON.stringify(before[field]) !== JSON.stringify(after[field]);
          return (
            <tr key={field} className={changed ? '' : 'opacity-60'}>
              <td className="px-5 py-2.5 font-medium">{field}</td>
              <td className="px-3 py-2.5">
                <PayloadValue value={before[field]} />
              </td>
              <td className={`px-5 py-2.5 ${changed ? 'font-medium' : ''}`}>
                <PayloadValue value={after[field]} />
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/**
 * What the checker is actually approving.
 *
 * Domain modules park a `payload` with the request; when it carries `before`/`after` snapshots
 * the review reads as a diff, otherwise as the plain arguments the action will run with.
 */
export function PayloadView({ payload }: Readonly<{ payload: Record<string, unknown> }>) {
  const { before, after, ...rest } = payload;

  if (isRecord(before) && isRecord(after)) {
    return (
      <div className="overflow-x-auto">
        <DiffTable before={before} after={after} />
      </div>
    );
  }

  const entries = Object.entries(rest);
  if (entries.length === 0) {
    return <p className="px-5 py-4 text-sm text-[var(--icb-text-subtle)]">No additional detail.</p>;
  }

  return (
    <dl className="divide-y divide-[var(--icb-border)]">
      {entries.map(([key, value]) => (
        <div key={key} className="flex items-baseline justify-between gap-4 px-5 py-3">
          <dt className="shrink-0 text-sm text-[var(--icb-text-subtle)]">{key}</dt>
          <dd className="text-right text-sm">
            <PayloadValue value={value} />
          </dd>
        </div>
      ))}
    </dl>
  );
}
