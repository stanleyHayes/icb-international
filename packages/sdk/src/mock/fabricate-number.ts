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
  const isInt = def.format === 'safeint';
  const bounds = resolveBounds(def.checks, isInt, ctx.hint);
  if (isInt) return ctx.faker.number.int(bounds);
  return ctx.faker.number.float({ ...bounds, fractionDigits: FLOAT_FRACTION_DIGITS });
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
    return [Math.max(min, inclusive ? value : value + (isInt ? 1 : Number.EPSILON)), max];
  }
  if (check.check === 'less_than') {
    return [min, Math.min(max, inclusive ? value : value - (isInt ? 1 : Number.EPSILON))];
  }
  return [min, max];
}
