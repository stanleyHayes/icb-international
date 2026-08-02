import { type Faker } from '@faker-js/faker';
import { type z } from 'zod';

/** Minimal structural view of a Zod 4 schema's internal definition (`schema._zod.def`). */
export type Def = { type: string; checks: Check[] } & Record<string, unknown>;

/** One entry of a Zod 4 check (`check._zod.def`), e.g. min_length or a regex pattern. */
export type Check = { check: string } & Record<string, unknown>;

export interface FabricateContext {
  faker: Faker;
  /** The object property being generated, used for field-name hints. */
  hint: string | undefined;
  depth: number;
}

export function defOf(schema: z.ZodType): Def {
  const def = schema._zod.def as unknown as Def;
  return { ...def, checks: checksOf(def) };
}

/** Normalises the raw check wrappers on a def into plain check records. */
export function checksOf(def: Def): Check[] {
  const raw = def.checks;
  if (!Array.isArray(raw)) return [];
  return raw.map((entry) => (entry as unknown as { _zod: { def: Check } })._zod.def);
}
