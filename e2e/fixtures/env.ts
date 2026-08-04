/**
 * Environment for the E2E suite. Defaults mirror the repo `.env`; every value can be
 * overridden so CI can point the same specs at a freshly booted stack.
 */

export const env = {
  apiUrl: process.env.E2E_API_URL ?? 'http://localhost:4100',
  clientUrl: process.env.E2E_CLIENT_URL ?? 'http://localhost:3101',
  mongoUri:
    process.env.E2E_MONGO_URI ??
    process.env.MONGO_URI ??
    'mongodb://localhost:27217/icb?replicaSet=icb-rs&directConnection=true',
} as const;

/** Seeded personas (apps/api/src/simulation/seed/seed.data.ts). */
export const seedUsers = {
  demo: { email: 'demo@icb.example', password: 'Demo!2345678', firstName: 'Amara' },
  staff: {
    ops: { email: 'ops@icb.example', password: 'Staff!2345678' },
    risk: { email: 'risk@icb.example', password: 'Staff!2345678' },
    underwriter: { email: 'lend@icb.example', password: 'Staff!2345678' },
  },
} as const;

/** Distinct email per worker run so re-runs never collide with a previous signup. */
export function uniqueEmail(tag: string): string {
  const stamp = `${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
  return `e2e.${tag}.${stamp}@icb.example`;
}
