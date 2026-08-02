import type { ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import type { FastifyRequest } from 'fastify';
import { describe, expect, it, vi } from 'vitest';

import type { TokenService } from '../../modules/auth/application/token.service.js';
import { STEP_UP_TOKEN_HEADER } from '../decorators/require-step-up.decorator.js';
import { StepUpGuard } from './step-up.guard.js';

const PURPOSE = 'transfer-create';

function contextWith(request: Partial<FastifyRequest>): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

function build(options: {
  purpose?: string;
  verify?: (token: string) => Promise<{ sub: string; purpose: string }>;
}): StepUpGuard {
  const reflector = {
    getAllAndOverride: vi.fn().mockReturnValue(options.purpose),
  } as unknown as Reflector;
  const tokens = {
    verifyStepUpToken: vi.fn(options.verify ?? ((): Promise<never> => Promise.reject(new Error('n/a')))),
  } as unknown as TokenService;
  return new StepUpGuard(tokens, reflector);
}

function requestWithStepUp(token?: string): Partial<FastifyRequest> {
  return {
    user: { sub: 'user-1' } as FastifyRequest['user'],
    headers: token === undefined ? {} : { [STEP_UP_TOKEN_HEADER]: token },
  };
}

describe('StepUpGuard', () => {
  it('allows handlers without a step-up requirement', async () => {
    const guard = build({});
    await expect(guard.canActivate(contextWith({}))).resolves.toBe(true);
  });

  it('rejects when the step-up token header is absent', async () => {
    const guard = build({ purpose: PURPOSE });
    await expect(guard.canActivate(contextWith(requestWithStepUp()))).rejects.toThrowError(
      expect.objectContaining({ code: 'STEP_UP_REQUIRED' }) as Error,
    );
  });

  it('accepts a token matching subject and purpose', async () => {
    const guard = build({
      purpose: PURPOSE,
      verify: () => Promise.resolve({ sub: 'user-1', purpose: PURPOSE }),
    });
    await expect(guard.canActivate(contextWith(requestWithStepUp('tok')))).resolves.toBe(true);
  });

  it('rejects a token minted for another purpose', async () => {
    const guard = build({
      purpose: PURPOSE,
      verify: () => Promise.resolve({ sub: 'user-1', purpose: 'pan-reveal' }),
    });
    await expect(guard.canActivate(contextWith(requestWithStepUp('tok')))).rejects.toThrowError(
      expect.objectContaining({ code: 'STEP_UP_REQUIRED' }) as Error,
    );
  });

  it('rejects a token belonging to another subject', async () => {
    const guard = build({
      purpose: PURPOSE,
      verify: () => Promise.resolve({ sub: 'user-2', purpose: PURPOSE }),
    });
    await expect(guard.canActivate(contextWith(requestWithStepUp('tok')))).rejects.toThrowError(
      expect.objectContaining({ code: 'STEP_UP_REQUIRED' }) as Error,
    );
  });

  it('rejects an expired or invalid token', async () => {
    const guard = build({
      purpose: PURPOSE,
      verify: () => Promise.reject(new Error('jwt expired')),
    });
    await expect(guard.canActivate(contextWith(requestWithStepUp('tok')))).rejects.toThrowError(
      expect.objectContaining({ code: 'STEP_UP_REQUIRED' }) as Error,
    );
  });
});
