import { fromMinorUnits, toDecimalString, type CurrencyCode } from '@icb/money';

import type { RuleParameters } from './rule.types.js';

/**
 * Parameter reading and severity shaping.
 *
 * Rule parameters are operator-editable and therefore arrive as loose JSON. Every read is
 * defaulted here rather than at the rule, so a rule mis-configured through the admin console
 * degrades to its shipped behaviour instead of throwing inside the payment path.
 */

export function numberParam(parameters: RuleParameters, key: string, fallback: number): number {
  const value = parameters[key];
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return fallback;
}

export function stringParam(parameters: RuleParameters, key: string, fallback: string): string {
  const value = parameters[key];
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : fallback;
}

/** A comma-separated parameter, e.g. `"7995,6051,4816"`. Blank entries are dropped. */
export function listParam(
  parameters: RuleParameters,
  key: string,
  fallback: string,
): readonly string[] {
  return stringParam(parameters, key, fallback)
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

export function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 1;
  }
  return Math.min(1, Math.max(0, value));
}

/** Half the weight is earned the moment a threshold is crossed. */
const BASE_SEVERITY = 0.5;

/**
 * How badly a threshold was broken, as a 0..1 fraction of the rule's weight.
 *
 * Crossing the line earns half the weight; reaching `saturateAt` multiples of it earns all of it.
 * A rule that fired must never contribute ~0 — that would make the score disagree with its own
 * explanation, which is the one thing an appealable decision cannot do.
 */
export function severity(observed: number, threshold: number, saturateAt = 2): number {
  const span = threshold * (saturateAt - 1);
  if (!Number.isFinite(span) || span <= 0) {
    return 1;
  }
  return clamp01(BASE_SEVERITY + (1 - BASE_SEVERITY) * clamp01((observed - threshold) / span));
}

/** `USD 4500.00` — the form every rule narrates money in. */
export function describeAmount(minorUnits: number, currency: CurrencyCode): string {
  return `${currency} ${toDecimalString(fromMinorUnits(minorUnits, currency))}`;
}

export const MS_PER_MINUTE = 60_000;
export const MS_PER_HOUR = 3_600_000;
export const MS_PER_DAY = 86_400_000;
