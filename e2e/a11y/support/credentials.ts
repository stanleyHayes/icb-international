/**
 * Seeded demo credentials (apps/api/src/simulation/seed/seed.data.ts). The suite signs in
 * through each app's real login UI with these — no session forging.
 */
export const CUSTOMER = { email: 'demo@icb.example', password: 'Demo!2345678' } as const;
export const STAFF = { email: 'ops@icb.example', password: 'Staff!2345678' } as const;
