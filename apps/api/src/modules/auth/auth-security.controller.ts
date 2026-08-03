import {
  changePasswordRequestSchema,
  forgotPasswordRequestSchema,
  resetPasswordRequestSchema,
  verifyEmailRequestSchema,
  type Session,
} from '@icb/contracts';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import type { z } from 'zod';

import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { zodBody } from '../../common/pipes/zod-validation.pipe.js';
import type { DeviceContext } from './application/auth.types.js';
import { ChangePasswordService } from './application/change-password.service.js';
import { EmailVerificationService } from './application/email-verification.service.js';
import { PasswordResetService } from './application/password-reset.service.js';
import { SessionManagerService } from './application/session-manager.service.js';
import type { AccessTokenClaims } from './application/token.service.js';

type ForgotPasswordBody = z.infer<typeof forgotPasswordRequestSchema>;
type ResetPasswordBody = z.infer<typeof resetPasswordRequestSchema>;
type VerifyEmailBody = z.infer<typeof verifyEmailRequestSchema>;
type ChangePasswordBody = z.infer<typeof changePasswordRequestSchema>;

/**
 * Account security around the credential itself: password reset and change, email
 * verification, and the customer's own session list with its kill switch.
 */
@Controller('auth')
export class AuthSecurityController {
  constructor(
    private readonly sessions: SessionManagerService,
    private readonly passwordReset: PasswordResetService,
    private readonly changePassword: ChangePasswordService,
    private readonly emailVerification: EmailVerificationService,
  ) {}

  @Get('sessions')
  listSessions(@CurrentUser() user: AccessTokenClaims): Promise<Session[]> {
    return this.sessions.list(user.sub, user.sessionId);
  }

  @Delete('sessions/:sessionId')
  @HttpCode(204)
  revokeSession(
    @CurrentUser() user: AccessTokenClaims,
    @Param('sessionId') sessionId: string,
  ): Promise<void> {
    return this.sessions.revoke(user.sub, sessionId);
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(204)
  forgotPassword(
    @Body(zodBody(forgotPasswordRequestSchema)) body: ForgotPasswordBody,
    @Req() request: FastifyRequest,
  ): Promise<void> {
    return this.passwordReset.requestReset(body.email, readDevice(request));
  }

  @Public()
  @Post('reset-password')
  @HttpCode(204)
  resetPassword(
    @Body(zodBody(resetPasswordRequestSchema)) body: ResetPasswordBody,
    @Req() request: FastifyRequest,
  ): Promise<void> {
    return this.passwordReset.resetPassword(body.token, body.password, readDevice(request));
  }

  @Post('change-password')
  @HttpCode(204)
  changeOwnPassword(
    @CurrentUser() user: AccessTokenClaims,
    @Body(zodBody(changePasswordRequestSchema)) body: ChangePasswordBody,
  ): Promise<void> {
    return this.changePassword.change(user.sub, user.sessionId, body);
  }

  @Public()
  @Post('verify-email')
  @HttpCode(204)
  verifyEmail(@Body(zodBody(verifyEmailRequestSchema)) body: VerifyEmailBody): Promise<void> {
    return this.emailVerification.confirm(body.token);
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
