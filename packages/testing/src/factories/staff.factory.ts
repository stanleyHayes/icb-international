import type { StaffUser } from '@icb/contracts';

import type { FactoryContext } from '../core/context.js';

/**
 * Staff user factory.
 *
 * Default: an active support agent — the least-privileged staff account. Admin and
 * super-admin accounts are built by overriding `roles`, matching how the API seeds them.
 */
export function staffUser(ctx: FactoryContext, overrides: Partial<StaffUser> = {}): StaffUser {
  const base: StaffUser = {
    id: ctx.nextId(),
    email: ctx.faker.internet.email().toLowerCase(),
    firstName: ctx.faker.person.firstName(),
    lastName: ctx.faker.person.lastName(),
    roles: ['support'],
    active: true,
    lastLoginAt: null,
    createdAt: ctx.clock.iso(),
  };
  return { ...base, ...overrides };
}

/** Convenience: a staff account that can do anything. Use sparingly — prefer a scoped role. */
export function adminUser(ctx: FactoryContext, overrides: Partial<StaffUser> = {}): StaffUser {
  return staffUser(ctx, { roles: ['admin'], ...overrides });
}
