import {
  stepUpRequestSchema,
  stepUpVerifyRequestSchema,
  totpConfirmRequestSchema,
  totpEnrolResponseSchema,
  type MfaChallenge,
  type RecoveryCodes,
  type StepUpToken,
} from '@icb/contracts';
import { Body, Controller, HttpCode, Post, Req } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import type { z } from 'zod';

import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { zodBody } from '../../common/pipes/zod-validation.pipe.js';
import type { DeviceContext } from './application/auth.types.js';
import { MfaEnrolmentService } from './application/mfa-enrolment.service.js';
import { StepUpService } from './application/step-up.service.js';
import type { AccessTokenClaims } from './application/token.service.js';

type TotpEnrolResponse = z.infer<typeof totpEnrolResponseSchema>;
type TotpConfirmBody = z.infer<typeof totpConfirmRequestSchema>;
type StepUpBody = z.infer<typeof stepUpRequestSchema>;
type StepUpVerifyBody = z.infer<typeof stepUpVerifyRequestSchema>;

/**
 * Second factors: TOTP enrolment and its recovery codes, and step-up challenges that mint
 * short-lived proofs for sensitive operations (consumed by the global `StepUpGuard`).
 */
@Controller('auth')
export class MfaController {
  constructor(
    private readonly enrolment: MfaEnrolmentService,
    private readonly stepUp: StepUpService,
  ) {}

  @Post('totp/enrol')
  @HttpCode(200)
  enrolTotp(@CurrentUser() user: AccessTokenClaims): Promise<TotpEnrolResponse> {
    return this.enrolment.enrol(user.sub);
  }

  @Post('totp/confirm')
  @HttpCode(200)
  confirmTotp(
    @CurrentUser() user: AccessTokenClaims,
    @Body(zodBody(totpConfirmRequestSchema)) body: TotpConfirmBody,
  ): Promise<RecoveryCodes> {
    return this.enrolment.confirm(user.sub, body.code);
  }

  @Post('totp/disable')
  @HttpCode(204)
  disableTotp(
    @CurrentUser() user: AccessTokenClaims,
    @Body(zodBody(totpConfirmRequestSchema)) body: TotpConfirmBody,
  ): Promise<void> {
    return this.enrolment.disable(user.sub, body.code);
  }

  @Post('step-up')
  @HttpCode(200)
  requestStepUp(
    @CurrentUser() user: AccessTokenClaims,
    @Body(zodBody(stepUpRequestSchema)) body: StepUpBody,
    @Req() request: FastifyRequest,
  ): Promise<MfaChallenge> {
    return this.stepUp.request(user.sub, body.purpose, readDevice(request));
  }

  @Post('step-up/verify')
  @HttpCode(200)
  verifyStepUp(
    @CurrentUser() user: AccessTokenClaims,
    @Body(zodBody(stepUpVerifyRequestSchema)) body: StepUpVerifyBody,
  ): Promise<StepUpToken> {
    return this.stepUp.verify(user.sub, body);
  }
}

function readDevice(request: FastifyRequest): DeviceContext {
  const header = request.headers['user-agent'];
  return {
    deviceId: null,
    userAgent: typeof header === 'string' ? header : 'unknown',
    ipAddress: request.ip,
  };
}
