import { Injectable, type PipeTransform } from '@nestjs/common';
import { z, type ZodType } from 'zod';

import { ValidationError } from '../errors/index.js';
import { assertNoMongoOperatorKeys } from './mongo-injection-guard.js';

/**
 * Validates and *narrows* a payload with a schema from `@icb/contracts`.
 *
 * Two things happen here that matter beyond type safety:
 *  1. Operator keys (`$`, `.`, `__proto__`) are rejected outright, so a crafted body or a
 *     `?email[$gt]=` querystring dies as a 400 here instead of reaching a Mongo filter.
 *  2. Unknown keys are stripped by Zod's object parsing, so a client cannot smuggle extra fields
 *     into a document (mass assignment).
 *  3. Failures become a single `VALIDATION_FAILED` problem with per-field paths, so a form can
 *     highlight the offending inputs rather than showing one opaque message.
 */
@Injectable()
export class ZodValidationPipe<TOutput> implements PipeTransform<unknown, TOutput> {
  constructor(private readonly schema: ZodType<TOutput>) {}

  transform(value: unknown): TOutput {
    assertNoMongoOperatorKeys(value);
    const result = this.schema.safeParse(coerceArrayFields(this.schema, value));

    if (result.success) {
      return result.data;
    }

    throw new ValidationError(
      'The request failed validation',
      result.error.issues.map((issue) => ({
        path: issue.path.map(String).join('.'),
        message: issue.message,
      })),
    );
  }
}

/** Convenience factory so controllers read `@Body(zodBody(createTransferRequestSchema))`. */
export function zodBody<TOutput>(schema: ZodType<TOutput>): ZodValidationPipe<TOutput> {
  return new ZodValidationPipe(schema);
}

/**
 * Fastify's querystring parser produces a scalar for a single value (`?type=x`) and an array
 * only for repeated keys (`?type=x&type=y`), so a `z.array()` filter rejected the request
 * whenever exactly one value was selected. Wrapping a lone scalar for a declared array field
 * makes the two wire shapes mean the same thing.
 */
function coerceArrayFields(schema: ZodType<unknown>, value: unknown): unknown {
  const shape = objectShapeOf(schema);
  if (shape === null || !isPlainRecord(value)) {
    return value;
  }

  const coerced = { ...value };
  for (const [key, fieldSchema] of Object.entries(shape)) {
    const field = coerced[key];
    if (field !== undefined && !Array.isArray(field) && isArraySchema(fieldSchema)) {
      coerced[key] = [field];
    }
  }
  return coerced;
}

function objectShapeOf(schema: ZodType<unknown>): Record<string, ZodType<unknown>> | null {
  const unwrapped = unwrap(schema);
  return unwrapped instanceof z.ZodObject ? unwrapped.shape : null;
}

function isArraySchema(schema: ZodType<unknown>): boolean {
  return unwrap(schema) instanceof z.ZodArray;
}

/** Peels wrappers (`.optional()`, `.default()`, …) to the schema that decides the shape. */
function unwrap(schema: ZodType<unknown>): ZodType<unknown> {
  let current = schema;
  for (;;) {
    const inner = innerOf(current);
    if (inner === null) {
      return current;
    }
    current = inner;
  }
}

function innerOf(schema: ZodType<unknown>): ZodType<unknown> | null {
  if (
    schema instanceof z.ZodOptional ||
    schema instanceof z.ZodNullable ||
    schema instanceof z.ZodDefault
  ) {
    return schema.unwrap() as ZodType<unknown>;
  }
  if (schema instanceof z.ZodReadonly || schema instanceof z.ZodPrefault) {
    return schema.def.innerType as ZodType<unknown>;
  }
  return null;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
