import { getScale, type CurrencyCode } from '@icb/money';

/** The wire shape every money field on an ICB form resolves to. */
export interface MoneyValue {
  minorUnits: number;
  currency: string;
  scale: number;
}

/**
 * Parse a decimal draft ("1250.50") into integer minor units.
 *
 * Returns `null` when the draft is empty or malformed, so the caller can surface a field error
 * instead of silently coercing. String arithmetic only — a float never enters the money path
 * (agent_plan.md N3).
 */
export function draftToMoney(draft: string, currency: CurrencyCode): MoneyValue | null {
  const trimmed = draft.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) {
    return null;
  }
  const scale = getScale(currency);
  const [whole = '0', fraction = ''] = trimmed.split('.');
  return {
    minorUnits: Number(`${whole}${fraction.padEnd(scale, '0')}`),
    currency,
    scale,
  };
}

/** A `MoneyValue` straight from integer minor units, for forms that collect them directly. */
export function minorUnitsToMoney(minorUnits: number, currency: CurrencyCode): MoneyValue {
  return { minorUnits, currency, scale: getScale(currency) };
}

/** First issue per field, as the `{ [field]: message }` map the form components render. */
export function fieldErrorsFrom(
  issues: ReadonlyArray<{ path: ReadonlyArray<PropertyKey>; message: string }>,
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of issues) {
    const key = issue.path.map(String).join('.');
    errors[key] ??= issue.message;
  }
  return errors;
}
