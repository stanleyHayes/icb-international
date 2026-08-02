import { z } from 'zod';
import { describe, expect, it } from 'vitest';

import { ZodValidationPipe, zodBody } from './zod-validation.pipe.js';

const schema = z.object({
  amount: z.number().int().positive(),
  reference: z.string().min(1),
});

describe('ZodValidationPipe', () => {
  it('returns the parsed payload', () => {
    const pipe = new ZodValidationPipe(schema);
    expect(pipe.transform({ amount: 100, reference: 'rent' })).toEqual({
      amount: 100,
      reference: 'rent',
    });
  });

  it('strips unknown keys (no mass assignment)', () => {
    const pipe = new ZodValidationPipe(schema);
    const result = pipe.transform({ amount: 100, reference: 'rent', isAdmin: true });

    expect(result).toEqual({ amount: 100, reference: 'rent' });
    expect('isAdmin' in result).toBe(false);
  });

  it('throws VALIDATION_FAILED with per-field paths', () => {
    const pipe = new ZodValidationPipe(schema);

    expect(() => pipe.transform({ amount: -5 })).toThrow(
      expect.objectContaining({
        code: 'VALIDATION_FAILED',
        fieldErrors: [
          expect.objectContaining({ path: 'amount' }),
          expect.objectContaining({ path: 'reference' }),
        ],
      }) as Error,
    );
  });

  it('zodBody builds a pipe for a controller parameter', () => {
    const pipe = zodBody(schema);
    expect(pipe.transform({ amount: 1, reference: 'x' })).toEqual({ amount: 1, reference: 'x' });
  });
});
