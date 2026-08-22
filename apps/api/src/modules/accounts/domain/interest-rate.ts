/**
 * The one place the account interest rate changes units.
 *
 * `AccountDoc.interestRate` is a **percentage** — the contract says so
 * (`accounts.contract.ts`: "Annual nominal rate as a percentage"), the seed writes `4.15`, and
 * both front ends render it with a `%` suffix. Every piece of interest arithmetic in the codebase
 * wants a **fraction**: `accrual-policy.ts` defaults are `0.005` and `0.03`, and
 * `savings/domain/interest.ts` documents its `rate` as "a fraction, e.g. `0.0525` for 5.25%".
 *
 * Reading the stored value straight into that arithmetic accrues a hundred times the interest
 * owed, so the conversion is named and done here rather than as a bare `/ 100` at each call site.
 */

/** Percent per year (`4.15`) to the fraction interest maths expects (`0.0415`). */
export function annualRateFraction(percent: number | null): number | null {
  return percent === null ? null : percent / 100;
}

/** The inverse, for writers holding a fraction that must be stored as a percentage. */
export function annualRatePercent(fraction: number): number {
  return fraction * 100;
}
