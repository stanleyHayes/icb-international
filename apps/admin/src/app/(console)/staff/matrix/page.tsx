import { Card } from '@icb/ui';
import { Check, Minus } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import {
  ALL_STAFF_ROLES,
  PERMISSIONS,
  permissionLabel,
  ROLE_PERMISSIONS,
} from '@/features/staff/permissions.constants';

export const metadata: Metadata = { title: 'Permission matrix' };

/**
 * The role × permission matrix, read-only.
 *
 * This is the answer to "what can a fraud analyst do?" rendered as one grid. It mirrors the
 * API's authoritative matrix (`permissions.constants.ts`) — roles are edited on the staff
 * pages, never here.
 */
export default function PermissionMatrixPage() {
  return (
    <>
      <header>
        <p className="text-sm text-[var(--icb-text-subtle)]">
          <Link href="/staff" className="hover:underline">
            Staff
          </Link>
          {' / '}
          Permission matrix
        </p>
        <h1 className="mt-1 font-display text-3xl font-bold tracking-[-0.02em]">
          Permission matrix
        </h1>
        <p className="mt-1.5 max-w-prose text-sm text-[var(--icb-text-muted)]">
          Every permission in the bank and the roles that hold it. Handlers check permissions,
          not role names — this grid is what the guards enforce.
        </p>
      </header>

      <Card className="mt-6 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <caption className="sr-only">Permissions granted to each staff role</caption>
            <thead>
              <tr className="border-b border-[var(--icb-border)] bg-[var(--icb-bg-subtle)] text-left text-[0.7rem] tracking-[0.08em] text-[var(--icb-text-subtle)] uppercase">
                <th scope="col" className="sticky left-0 bg-[var(--icb-bg-subtle)] px-5 py-2.5 font-medium">
                  Permission
                </th>
                {ALL_STAFF_ROLES.map((role) => (
                  <th key={role} scope="col" className="px-3 py-2.5 text-center font-medium">
                    {role.replaceAll('_', ' ')}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--icb-border)]">
              {PERMISSIONS.map((permission) => (
                <tr key={permission} className="hover:bg-[var(--icb-bg-subtle)]">
                  <th
                    scope="row"
                    className="sticky left-0 bg-[var(--icb-surface)] px-5 py-2 text-left font-mono text-xs font-normal"
                  >
                    {permission}
                  </th>
                  {ALL_STAFF_ROLES.map((role) => {
                    const granted = ROLE_PERMISSIONS[role].includes(permission);
                    return (
                      <td key={role} className="px-3 py-2 text-center">
                        {granted ? (
                          <Check
                            size={15}
                            className="inline text-[var(--icb-success-fg)]"
                            aria-label={`${permissionLabel(permission)} granted to ${role.replaceAll('_', ' ')}`}
                          />
                        ) : (
                          <Minus
                            size={15}
                            className="inline text-[var(--icb-slate-300)]"
                            aria-label={`${permissionLabel(permission)} not granted to ${role.replaceAll('_', ' ')}`}
                          />
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
