import { z } from 'zod';
import {
  authenticatedUserSchema,
  authTokensSchema,
  changePasswordRequestSchema,
  forgotPasswordRequestSchema,
  loginHistoryEntrySchema,
  loginRequestSchema,
  loginResponseSchema,
  mfaChallengeSchema,
  mfaVerifyRequestSchema,
  recoveryCodesSchema,
  registerRequestSchema,
  resetPasswordRequestSchema,
  sessionSchema,
  stepUpRequestSchema,
  stepUpVerifyRequestSchema,
  stepUpTokenSchema,
  totpConfirmRequestSchema,
  totpEnrolResponseSchema,
  verifyEmailRequestSchema,
} from '@icb/contracts';

import { del, get, post, postVoid, type Requester } from '../endpoint.js';
import { type RequestOptions } from '../http.js';

/** MFA verification completes a login: it returns what the `authenticated` login branch does. */
const mfaVerifyResponseSchema = z.object({
  tokens: authTokensSchema,
  user: authenticatedUserSchema,
});

export const authEndpoints = {
  register: post('/auth/register', authenticatedUserSchema, {
    body: registerRequestSchema,
    auth: false,
  }),
  login: post('/auth/login', loginResponseSchema, { body: loginRequestSchema, auth: false }),
  verifyMfa: post('/auth/mfa/verify', mfaVerifyResponseSchema, {
    body: mfaVerifyRequestSchema,
    auth: false,
  }),
  refresh: post('/auth/refresh', authTokensSchema, { auth: false }),
  logout: postVoid('/auth/logout'),
  logoutAll: postVoid('/auth/logout-all'),
  me: get('/auth/me', authenticatedUserSchema),
  listSessions: get('/auth/sessions', z.array(sessionSchema)),
  loginHistory: get('/auth/login-history', z.array(loginHistoryEntrySchema)),
  revokeSession: del('/auth/sessions/:sessionId'),
  forgotPassword: postVoid('/auth/forgot-password', {
    body: forgotPasswordRequestSchema,
    auth: false,
  }),
  resetPassword: postVoid('/auth/reset-password', {
    body: resetPasswordRequestSchema,
    auth: false,
  }),
  changePassword: postVoid('/auth/change-password', { body: changePasswordRequestSchema }),
  verifyEmail: postVoid('/auth/verify-email', { body: verifyEmailRequestSchema, auth: false }),
  enrolTotp: post('/auth/totp/enrol', totpEnrolResponseSchema, {}),
  confirmTotp: post('/auth/totp/confirm', recoveryCodesSchema, { body: totpConfirmRequestSchema }),
  disableTotp: postVoid('/auth/totp/disable', { body: totpConfirmRequestSchema }),
  requestStepUp: post('/auth/step-up', mfaChallengeSchema, { body: stepUpRequestSchema }),
  verifyStepUp: post('/auth/step-up/verify', stepUpTokenSchema, {
    body: stepUpVerifyRequestSchema,
  }),
};

export function createAuthApi(call: Requester) {
  return {
    register: (body: z.input<typeof registerRequestSchema>, options?: RequestOptions) =>
      call(authEndpoints.register, { body, options }),
    login: (body: z.input<typeof loginRequestSchema>, options?: RequestOptions) =>
      call(authEndpoints.login, { body, options }),
    verifyMfa: (body: z.input<typeof mfaVerifyRequestSchema>, options?: RequestOptions) =>
      call(authEndpoints.verifyMfa, { body, options }),
    refresh: (options?: RequestOptions) => call(authEndpoints.refresh, { options }),
    logout: (options?: RequestOptions) => call(authEndpoints.logout, { options }),
    logoutAll: (options?: RequestOptions) => call(authEndpoints.logoutAll, { options }),
    me: (options?: RequestOptions) => call(authEndpoints.me, { options }),
    listSessions: (options?: RequestOptions) => call(authEndpoints.listSessions, { options }),
    loginHistory: (options?: RequestOptions) => call(authEndpoints.loginHistory, { options }),
    revokeSession: (sessionId: string, options?: RequestOptions) =>
      call(authEndpoints.revokeSession, { params: { sessionId }, options }),
    forgotPassword: (body: z.input<typeof forgotPasswordRequestSchema>, options?: RequestOptions) =>
      call(authEndpoints.forgotPassword, { body, options }),
    resetPassword: (body: z.input<typeof resetPasswordRequestSchema>, options?: RequestOptions) =>
      call(authEndpoints.resetPassword, { body, options }),
    changePassword: (body: z.input<typeof changePasswordRequestSchema>, options?: RequestOptions) =>
      call(authEndpoints.changePassword, { body, options }),
    verifyEmail: (body: z.input<typeof verifyEmailRequestSchema>, options?: RequestOptions) =>
      call(authEndpoints.verifyEmail, { body, options }),
    enrolTotp: (options?: RequestOptions) => call(authEndpoints.enrolTotp, { options }),
    confirmTotp: (body: z.input<typeof totpConfirmRequestSchema>, options?: RequestOptions) =>
      call(authEndpoints.confirmTotp, { body, options }),
    disableTotp: (body: z.input<typeof totpConfirmRequestSchema>, options?: RequestOptions) =>
      call(authEndpoints.disableTotp, { body, options }),
    requestStepUp: (body: z.input<typeof stepUpRequestSchema>, options?: RequestOptions) =>
      call(authEndpoints.requestStepUp, { body, options }),
    verifyStepUp: (body: z.input<typeof stepUpVerifyRequestSchema>, options?: RequestOptions) =>
      call(authEndpoints.verifyStepUp, { body, options }),
  };
}

export type AuthApi = ReturnType<typeof createAuthApi>;
