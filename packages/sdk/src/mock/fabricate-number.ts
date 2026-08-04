import { NUMBER_FIELD_HINTS } from './field-hints.js';
import {
  DEFAULT_MAX_FLOAT,
  DEFAULT_MAX_INT,
  DEFAULT_MIN_INT,
  FLOAT_FRACTION_DIGITS,
} from './constants.js';
import { type Check, type Def, type FabricateContext } from './schema-def.js';

interface Bounds {
  min: number;
  max: number;
}

/**
 * Numbers honour their `greater_than`/`less_than` checks and default to positive values, so
 * refinement-guarded schemas (e.g. `positiveMoneySchema`) validate without special-casing.
 */
export function generateNumber(def: Def, ctx: FabricateContext): number {
  const isInt = isInteger(def);
  const bounds = resolveBounds(def.checks, isInt, ctx.hint);
  if (isInt) return ctx.faker.number.int(bounds);
  return ctx.faker.number.float({ ...bounds, fractionDigits: FLOAT_FRACTION_DIGITS });
}

/**
 * Integer-ness reaches Zod 4 by two routes and the mock has to honour both.
 *
 * `z.int()` sets `format: 'safeint'` on the def; `z.number().int()` leaves the format undefined
 * and files the constraint as a `number_format` *check* instead. Reading only the def meant the
 * second spelling fabricated a float, which then failed the very schema it was generated from —
 * a mock consumer would build against data the real API rejects.
 */
function isInteger(def: Def): boolean {
  if (def.format === 'safeint') return true;
  return def.checks.some(
    (check) => check.check === 'number_format' && check['format'] === 'safeint',
  );
}

function resolveBounds(checks: Check[], isInt: boolean, hint: string | undefined): Bounds {
  const hintRange = hint === undefined ? undefined : NUMBER_FIELD_HINTS[hint];
  let min = hintRange?.[0] ?? (isInt ? DEFAULT_MIN_INT : 0);
  let max = hintRange?.[1] ?? (isInt ? DEFAULT_MAX_INT : DEFAULT_MAX_FLOAT);
  for (const check of checks) {
    [min, max] = applyBound(check, isInt, min, max);
  }
  return min > max ? { min: max, max } : { min, max };
}

function applyBound(check: Check, isInt: boolean, min: number, max: number): [number, number] {
  const value = typeof check.value === 'number' ? check.value : undefined;
  if (value === undefined) return [min, max];
  const inclusive = check.inclusive !== false;
  if (check.check === 'greater_than') {
    return [Math.max(min, lowerBound(value, inclusive, isInt)), max];
  }
  if (check.check === 'less_than') {
    return [min, Math.min(max, upperBound(value, inclusive, isInt))];
  }
  return [min, max];
}

function lowerBound(value: number, inclusive: boolean, isInt: boolean): number {
  if (inclusive) return value;
  return isInt ? value + 1 : value + Number.EPSILON;
}

function upperBound(value: number, inclusive: boolean, isInt: boolean): number {
  if (inclusive) return value;
  return isInt ? value - 1 : value - Number.EPSILON;
}
