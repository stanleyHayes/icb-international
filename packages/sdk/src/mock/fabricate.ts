import { type Faker } from '@faker-js/faker';
import { type z } from 'zod';

import { MAX_ARRAY_ITEMS, MAX_DEPTH, NULL_PROBABILITY, RECORD_ENTRIES } from './constants.js';
import { generateNumber } from './fabricate-number.js';
import { generateString } from './fabricate-string.js';
import { defOf, type Def, type FabricateContext } from './schema-def.js';

/**
 * Generates schema-valid, faker-backed mock data from any Zod schema in `@icb/contracts`.
 * This is what makes the MSW handlers "generated from the contract": a schema change is
 * automatically reflected in the mock with no handler edits.
 */
export function fabricate<S extends z.ZodType>(schema: S, faker: Faker): z.output<S> {
  const ctx: FabricateContext = { faker, hint: undefined, depth: 0 };
  return generateValue(schema, ctx) as z.output<S>;
}

type Generator = (def: Def, ctx: FabricateContext) => unknown;

const GENERATORS: Readonly<Record<string, Generator>> = {
  string: generateString,
  number: generateNumber,
  boolean: (_def, ctx) => ctx.faker.datatype.boolean(),
  bigint: (_def, ctx) => BigInt(ctx.faker.number.int({ min: 1, max: 1000 })),
  enum: generateEnum,
  literal: (def) => (def.values as unknown[])[0],
  object: generateObject,
  array: generateArray,
  union: generateUnion,
  record: generateRecord,
  optional: unwrapInner,
  default: unwrapInner,
  nonoptional: unwrapInner,
  readonly: unwrapInner,
  nullable: generateNullable,
  pipe: (def, ctx) => generateValue(def.in as z.ZodType, ctx),
  catch: unwrapInner,
  date: (_def, ctx) => ctx.faker.date.recent(),
  unknown: (_def, ctx) => ctx.faker.lorem.word(),
  any: (_def, ctx) => ctx.faker.lorem.word(),
};

function generateValue(schema: z.ZodType, ctx: FabricateContext): unknown {
  const def = defOf(schema);
  const generator = GENERATORS[def.type] ?? fallback;
  return generator(def, ctx);
}

function fallback(_def: Def, ctx: FabricateContext): unknown {
  return ctx.faker.lorem.word();
}

function generateEnum(def: Def, ctx: FabricateContext): unknown {
  const values = Object.values(def.entries as Record<string, unknown>);
  return ctx.faker.helpers.arrayElement(values);
}

function generateObject(def: Def, ctx: FabricateContext): unknown {
  if (ctx.depth >= MAX_DEPTH) return {};
  const shape = def.shape as Record<string, z.ZodType>;
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(shape)) {
    result[key] = generateValue(value, { ...ctx, hint: key, depth: ctx.depth + 1 });
  }
  return result;
}

function generateArray(def: Def, ctx: FabricateContext): unknown {
  const element = def.element as z.ZodType;
  return Array.from({ length: arrayLength(def, ctx) }, () =>
    generateValue(element, { ...ctx, hint: undefined, depth: ctx.depth + 1 }),
  );
}

function arrayLength(def: Def, ctx: FabricateContext): number {
  const exact = def.checks.find((check) => check.check === 'length_equals');
  if (exact !== undefined) return Number(exact.length);
  const min = Number(def.checks.find((check) => check.check === 'min_length')?.minimum ?? 1);
  const maxRaw = Number(
    def.checks.find((check) => check.check === 'max_length')?.maximum ?? MAX_ARRAY_ITEMS,
  );
  const max = Math.max(min, Math.min(maxRaw, MAX_ARRAY_ITEMS));
  return ctx.faker.number.int({ min, max });
}

function generateUnion(def: Def, ctx: FabricateContext): unknown {
  const options = def.options as z.ZodType[];
  return generateValue(ctx.faker.helpers.arrayElement(options), ctx);
}

function generateRecord(def: Def, ctx: FabricateContext): unknown {
  const keyType = def.keyType as z.ZodType;
  const valueType = def.valueType as z.ZodType;
  const result: Record<string, unknown> = {};
  for (const key of recordKeys(keyType, ctx)) {
    result[key] = generateValue(valueType, { ...ctx, hint: undefined, depth: ctx.depth + 1 });
  }
  return result;
}

/** Enum-keyed records (e.g. card channel controls) are exhaustive in Zod: emit every member. */
function recordKeys(keyType: z.ZodType, ctx: FabricateContext): string[] {
  const keyDef = defOf(keyType);
  if (keyDef.type === 'enum') return Object.values(keyDef.entries as Record<string, string>);
  return Array.from({ length: RECORD_ENTRIES }, () =>
    String(generateValue(keyType, { ...ctx, hint: undefined, depth: ctx.depth + 1 })),
  );
}

function generateNullable(def: Def, ctx: FabricateContext): unknown {
  if (ctx.faker.datatype.boolean({ probability: NULL_PROBABILITY })) return null;
  return generateValue(def.innerType as z.ZodType, ctx);
}

function unwrapInner(def: Def, ctx: FabricateContext): unknown {
  return generateValue(def.innerType as z.ZodType, ctx);
}
