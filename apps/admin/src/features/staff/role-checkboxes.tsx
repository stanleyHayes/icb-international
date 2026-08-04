'use client';

import type { StaffRole } from '@icb/contracts';
import { cn } from '@icb/ui';

import { ALL_STAFF_ROLES, ROLE_PERMISSIONS } from './permissions.constants';

/**
 * Role assignment as a checkbox grid.
 *
 * Each option shows the permissions it grants, because "what am I actually giving this person?"
 * is the question the operator is answering — a bare role name does not answer it.
 */
export function RoleCheckboxes({
  name = 'roles',
  selected,
  invalid,
}: Readonly<{ name?: string; selected: readonly string[]; invalid?: boolean | undefined }>) {
  return (
    <fieldset aria-invalid={invalid || undefined}>
      <legend className="text-sm font-medium">Roles</legend>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {ALL_STAFF_ROLES.map((role) => (
          <RoleOption key={role} role={role} name={name} defaultChecked={selected.includes(role)} />
        ))}
      </div>
    </fieldset>
  );
}

function RoleOption({
  role,
  name,
  defaultChecked,
}: Readonly<{ role: StaffRole; name: string; defaultChecked: boolean }>) {
  const grants = ROLE_PERMISSIONS[role];

  return (
    <label
      className={cn(
        'flex cursor-pointer items-start gap-3 rounded-[var(--radius-md)] border border-[var(--icb-border)] px-3.5 py-3',
        'transition-colors has-checked:border-[var(--icb-primary)] has-checked:bg-[var(--icb-navy-50)]',
      )}
    >
      <input
        type="checkbox"
        name={name}
        value={role}
        defaultChecked={defaultChecked}
        className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--icb-primary)]"
      />
      <span className="min-w-0">
        <span className="block text-sm font-medium capitalize">{role.replaceAll('_', ' ')}</span>
        <span className="mt-0.5 block text-xs text-[var(--icb-text-subtle)]">
          {grants.length} permission{grants.length === 1 ? '' : 's'}
        </span>
      </span>
    </label>
  );
}
