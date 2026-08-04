import type { FastifyRequest } from 'fastify';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MfaController } from '../mfa.controller.js';
import { type MfaEnrolmentService } from '../application/mfa-enrolment.service.js';
import { type StepUpService } from '../application/step-up.service.js';
import type { AccessTokenClaims } from '../application/token.service.js';

const CLAIMS = {
  sub: 'user-1',
  customerId: 'cust-1',
  email: 'ada@example.com',
  roles: ['customer'],
  sessionId: 'session-1',
} as AccessTokenClaims;

function requestDouble(headers: Record<string, unknown> = {}): FastifyRequest {
  return { headers, ip: '192.0.2.10' } as unknown as FastifyRequest;
}

describe('MfaController', () => {
  let enrolment: {
    enrol: ReturnType<typeof vi.fn>;
    confirm: ReturnType<typeof vi.fn>;
    disable: ReturnType<typeof vi.fn>;
  };
  let stepUp: { request: ReturnType<typeof vi.fn>; verify: ReturnType<typeof vi.fn> };
  let controller: MfaController;

  beforeEach(() => {
    enrolment = {
      enrol: vi.fn().mockResolvedValue({ secret: 'ABC', otpauthUrl: 'otpauth://x' }),
      confirm: vi.fn().mockResolvedValue({ codes: ['code-1'] }),
      disable: vi.fn().mockResolvedValue(undefined),
    };
    stepUp = {
      request: vi.fn().mockResolvedValue({ id: 'challenge-1' }),
      verify: vi.fn().mockResolvedValue({ token: 'step-up-token' }),
    };

    controller = new MfaController(
      enrolment as unknown as MfaEnrolmentService,
      stepUp as unknown as StepUpService,
    );
  });

  it('starts TOTP enrolment for the token subject', async () => {
    const result = await controller.enrolTotp(CLAIMS);

    expect(enrolment.enrol).toHaveBeenCalledWith('user-1');
    expect(result).toEqual({ secret: 'ABC', otpauthUrl: 'otpauth://x' });
  });

  it('confirms TOTP enrolment with the presented code', async () => {
    const result = await controller.confirmTotp(CLAIMS, { code: '123456' });

    expect(enrolment.confirm).toHaveBeenCalledWith('user-1', '123456');
    expect(result).toEqual({ codes: ['code-1'] });
  });

  it('disables TOTP with the presented code', async () => {
    await controller.disableTotp(CLAIMS, { code: '654321' });

    expect(enrolment.disable).toHaveBeenCalledWith('user-1', '654321');
  });

  it('requests a step-up challenge with the device context', async () => {
    const result = await controller.requestStepUp(
      CLAIMS,
      { purpose: 'wire_transfer' } as never,
      requestDouble({ 'user-agent': 'Vitest Browser/1.0' }),
    );

    expect(stepUp.request).toHaveBeenCalledWith('user-1', 'wire_transfer', {
      deviceId: null,
      userAgent: 'Vitest Browser/1.0',
      ipAddress: '192.0.2.10',
    });
    expect(result).toEqual({ id: 'challenge-1' });
  });

  it('defaults the user agent to unknown for a non-string header', async () => {
    await controller.requestStepUp(CLAIMS, { purpose: 'wire_transfer' } as never, requestDouble());

    expect(stepUp.request).toHaveBeenCalledWith(
      'user-1',
      'wire_transfer',
      expect.objectContaining({ userAgent: 'unknown' }),
    );
  });

  it('verifies a step-up challenge and returns the proof token', async () => {
    const body = { challengeId: 'challenge-1', code: '123456' };

    const result = await controller.verifyStepUp(CLAIMS, body);

    expect(stepUp.verify).toHaveBeenCalledWith('user-1', body);
    expect(result).toEqual({ token: 'step-up-token' });
  });
});
