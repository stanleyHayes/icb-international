import { STAFF_ROLES, type StaffRole } from '@icb/contracts';

/**
 * The standing operations-console sign-ins.
 *
 * These are the addresses an operator actually uses to open the console, as distinct from
 * `SEED_STAFF`, which exists to give the simulated bank plausible named colleagues on `icb.example`
 * and is only written by a seed run.
 *
 * Addresses and roles live here because neither is a secret and both need to be reviewable in a
 * diff. The password does not: it is read from `CONSOLE_ACCOUNT_PASSWORD` at provision time, so
 * rotating it is an environment change rather than a commit, and nothing in this repository ever
 * holds the value. See `provision-console.cli.ts`.
 */
export interface ConsoleAccount {
  readonly email: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly roles: readonly StaffRole[];
}

/**
 * Every role in the system, so a console sign-in can reach every section of the navigation.
 *
 * The console sidebar is RBAC-aware and renders only what the signed-in roles permit, which means
 * an account short of a role cannot see — or test — the sections behind it.
 */
export const ALL_STAFF_ROLES: readonly StaffRole[] = STAFF_ROLES;

export const CONSOLE_ACCOUNTS: readonly ConsoleAccount[] = [
  {
    email: 'admin@icbinternationalcommercial.com',
    firstName: 'ICB',
    lastName: 'Administrator',
    roles: ALL_STAFF_ROLES,
  },
  {
    email: 'support@icbinternationalcommercial.com',
    firstName: 'ICB',
    lastName: 'Support',
    roles: ALL_STAFF_ROLES,
  },
  {
    email: 'info@icbinternationalcommercial.com',
    firstName: 'ICB',
    lastName: 'Information',
    roles: ALL_STAFF_ROLES,
  },
];
