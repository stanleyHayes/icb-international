import { type Faker } from '@faker-js/faker';

import { ISO_DATE_LENGTH } from './constants.js';
import { STRING_FIELD_HINTS } from './field-hints.js';
import { regexSample } from './regex-samples.js';
import { type Check, type Def, type FabricateContext } from './schema-def.js';

const FORMAT_GENERATORS: Readonly<Record<string, (faker: Faker) => string>> = {
  email: (f) => f.internet.email().toLowerCase(),
  url: (f) => f.internet.url(),
  datetime: (f) => f.date.recent().toISOString(),
  date: (f) => f.date.recent().toISOString().slice(0, ISO_DATE_LENGTH),
  time: () => '08:30',
  duration: () => 'PT6H',
  uuid: (f) => f.string.uuid(),
  nanoid: (f) => f.string.nanoid(),
  ipv4: (f) => f.internet.ipv4(),
  ipv6: (f) => f.internet.ipv6(),
  emoji: () => '🏦',
};

const DEFAULT_WORD_COUNT = 3;

export function generateString(def: Def, ctx: FabricateContext): string {
  const checks = def.checks;
  const regex = findRegex(checks);
  if (regex) return regexSample(regex, ctx.faker);
  const hinted = applyHint(ctx);
  if (hinted !== undefined) return clampLength(hinted, checks);
  const format = typeof def.format === 'string' ? def.format : undefined;
  const formatted = format === undefined ? undefined : FORMAT_GENERATORS[format]?.(ctx.faker);
  if (formatted !== undefined) return clampLength(formatted, checks);
  return clampLength(ctx.faker.lorem.words(DEFAULT_WORD_COUNT), checks);
}

function findRegex(checks: Check[]): RegExp | undefined {
  for (const check of checks) {
    if (check.pattern instanceof RegExp) return check.pattern;
  }
  return undefined;
}

function applyHint(ctx: FabricateContext): string | undefined {
  if (ctx.hint === undefined) return undefined;
  return STRING_FIELD_HINTS[ctx.hint]?.(ctx.faker);
}

/** Enforces min/max/exact length checks by padding or truncating the candidate value. */
function clampLength(value: string, checks: Check[]): string {
  let result = value;
  for (const check of checks) {
    result = clampOne(result, check);
  }
  return result;
}

function clampOne(value: string, check: Check): string {
  if (check.check === 'min_length') return padTo(value, asCount(check.minimum));
  if (check.check === 'max_length') return value.slice(0, asCount(check.maximum));
  if (check.check === 'length_equals') return padTo(value, asCount(check.length)).slice(0, asCount(check.length));
  return value;
}

function asCount(raw: unknown): number {
  return typeof raw === 'number' && Number.isFinite(raw) ? Math.max(0, Math.floor(raw)) : 0;
}

function padTo(value: string, length: number): string {
  return value.length >= length ? value : value.padEnd(length, 'x');
}
