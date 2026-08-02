import { Injectable, type PipeTransform } from '@nestjs/common';
import type { ZodType } from 'zod';

import { ValidationError } from '../errors/index.js';

/**
 * Validates and *narrows* a payload with a schema from `@icb/contracts`.
 *
 * Two things happen here that matter beyond type safety:
 *  1. Unknown keys are stripped by Zod's object parsing, so a client cannot smuggle extra fields
 *     into a document (mass assignment).
 *  2. Failures become a single `VALIDATION_FAILED` problem with per-field paths, so a form can
 *     highlight the offending inputs rather than showing one opaque message.
 */
@Injectable()
export class ZodValidationPipe<TOutput> implements PipeTransform<unknown, TOutput> {
  constructor(private readonly schema: ZodType<TOutput>) {}

  transform(value: unknown): TOutput {
    const result = this.schema.safeParse(value);

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
