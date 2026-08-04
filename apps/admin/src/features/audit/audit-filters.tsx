import { Button } from '@icb/ui';

interface AuditFilterValues {
  actorId?: string | undefined;
  action?: string | undefined;
  subjectType?: string | undefined;
  subjectId?: string | undefined;
  from?: string | undefined;
  to?: string | undefined;
}

/**
 * The explorer's filter bar.
 *
 * A plain GET form: no client JS, the URL is the state, and the same query string feeds the
 * NDJSON export, so what you filtered is exactly what you download.
 */
export function AuditFilters({ values }: Readonly<{ values: AuditFilterValues }>) {
  return (
    <form method="get" action="/audit" className="grid gap-4 sm:grid-cols-2">
      <TextFilter
        label="Actor id"
        name="actorId"
        defaultValue={values.actorId}
        placeholder="usr_…"
      />
      <TextFilter
        label="Action"
        name="action"
        defaultValue={values.action}
        placeholder="staff.update"
      />
      <TextFilter
        label="Subject type"
        name="subjectType"
        defaultValue={values.subjectType}
        placeholder="customer"
      />
      <TextFilter
        label="Subject id"
        name="subjectId"
        defaultValue={values.subjectId}
        placeholder="cus_…"
      />
      <TextFilter label="From" name="from" type="date" defaultValue={values.from} />
      <TextFilter label="To" name="to" type="date" defaultValue={values.to} />

      <div className="flex items-end gap-3 sm:col-span-2">
        <Button type="submit">Apply filters</Button>
        <a
          href="/audit"
          className="inline-flex h-10 items-center rounded-[var(--radius-md)] px-4 text-sm font-medium text-[var(--icb-text)] transition-colors hover:bg-[var(--icb-bg-muted)]"
        >
          Clear
        </a>
      </div>
    </form>
  );
}

function TextFilter({
  label,
  name,
  defaultValue,
  placeholder,
  type = 'text',
}: Readonly<{
  label: string;
  name: string;
  defaultValue?: string | undefined;
  placeholder?: string | undefined;
  type?: string;
}>) {
  return (
    <div>
      <label htmlFor={`filter-${name}`} className="block text-xs font-medium">
        {label}
      </label>
      <input
        id={`filter-${name}`}
        name={name}
        type={type}
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="mt-1 h-10 w-full rounded-[var(--radius-md)] border border-[var(--icb-border-strong)] bg-[var(--icb-surface)] px-3.5 text-sm outline-none focus:border-[var(--icb-primary)]"
      />
    </div>
  );
}
