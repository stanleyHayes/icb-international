/**
 * Seeded demo credentials (apps/api/src/simulation/seed/seed.data.ts). The suite signs in
 * through each app's real login UI with these — no session forging.
 *
 * `STAFF_ENROLLED` gets a TOTP factor enrolled by the global setup (staff policy gates the
 * console on MFA). `STAFF_UNENROLLED` is deliberately left without one so the mandatory
 * /mfa-enrol gate page stays reachable and scannable.
 */
export const CUSTOMER = { email: 'demo@icb.example', password: 'Demo!2345678' } as const;
export const STAFF_ENROLLED = { email: 'ops@icb.example', password: 'Staff!2345678' } as const;
export const STAFF_UNENROLLED = { email: 'lend@icb.example', password: 'Staff!2345678' } as const;
