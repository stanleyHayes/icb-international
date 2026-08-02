import { z } from 'zod';

import { staffRoleSchema } from '../common/enums.js';
import { emailSchema, idSchema, isoDateTimeSchema, phoneSchema } from '../common/primitives.js';

/**
 * Password policy.
 *
 * Length is the dominant factor in resistance to offline cracking, so the floor is 12 rather
 * than the more common 8. Composition rules beyond "not one character class" are deliberately
 * light — they push users toward predictable substitutions without adding real entropy.
 */
export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 128;

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters`)
  .max(PASSWORD_MAX_LENGTH)
  .refine((value) => /[a-z]/.test(value) && /[A-Z]/.test(value), {
    error: 'Password must contain both upper and lower case letters',
  })
  .refine((value) => /\d/.test(value), { error: 'Password must contain a digit' });

export const registerRequestSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  firstName: z.string().min(1).max(60),
  lastName: z.string().min(1).max(60),
  phone: phoneSchema,
  acceptedTermsVersion: z.string().min(1).max(20),
});

export const loginRequestSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(PASSWORD_MAX_LENGTH),
  /** Opaque, client-generated, stable per browser. Used for trusted-device recognition. */
  deviceId: z.string().min(8).max(128).optional(),
});

export const mfaChallengeSchema = z.object({
  challengeId: idSchema,
  method: z.enum(['totp', 'sms', 'recovery_code']),
  /** Masked destination for SMS, e.g. `+233 ** *** 4521`. Absent for TOTP. */
  hint: z.string().optional(),
  expiresAt: isoDateTimeSchema,
});

export const mfaVerifyRequestSchema = z.object({
  challengeId: idSchema,
  code: z.string().min(6).max(16),
  /** Remember this device for 30 days, skipping MFA on subsequent logins. */
  trustDevice: z.boolean().default(false),
});

export const authTokensSchema = z.object({
  accessToken: z.string(),
  /** Seconds until `accessToken` expires. The refresh token lives in an httpOnly cookie. */
  expiresIn: z.int().positive(),
  tokenType: z.literal('Bearer'),
});

export const authenticatedUserSchema = z.object({
  userId: idSchema,
  customerId: idSchema.nullable(),
  email: emailSchema,
  firstName: z.string(),
  lastName: z.string(),
  emailVerified: z.boolean(),
  mfaEnabled: z.boolean(),
  roles: z.array(staffRoleSchema),
  lastLoginAt: isoDateTimeSchema.nullable(),
});

/** Login either completes, or hands back a challenge. Never both. */
export const loginResponseSchema = z.discriminatedUnion('outcome', [
  z.object({
    outcome: z.literal('authenticated'),
    tokens: authTokensSchema,
    user: authenticatedUserSchema,
  }),
  z.object({
    outcome: z.literal('mfa_required'),
    challenge: mfaChallengeSchema,
  }),
]);

export const forgotPasswordRequestSchema = z.object({ email: emailSchema });

export const resetPasswordRequestSchema = z.object({
  token: z.string().min(16).max(256),
  password: passwordSchema,
});

export const changePasswordRequestSchema = z.object({
  currentPassword: z.string().min(1).max(PASSWORD_MAX_LENGTH),
  newPassword: passwordSchema,
});

export const verifyEmailRequestSchema = z.object({ token: z.string().min(16).max(256) });

export const totpEnrolResponseSchema = z.object({
  secret: z.string(),
  otpauthUri: z.string(),
  qrCodeDataUri: z.string(),
});

export const totpConfirmRequestSchema = z.object({ code: z.string().length(6) });

export const recoveryCodesSchema = z.object({
  codes: z.array(z.string()).length(10),
  generatedAt: isoDateTimeSchema,
});

export const sessionSchema = z.object({
  id: idSchema,
  device: z.object({
    label: z.string(),
    browser: z.string().nullable(),
    os: z.string().nullable(),
    trusted: z.boolean(),
  }),
  ipAddress: z.string(),
  location: z.string().nullable(),
  createdAt: isoDateTimeSchema,
  lastSeenAt: isoDateTimeSchema,
  current: z.boolean(),
});

/** Re-authentication for a sensitive action. Valid for a few minutes, single purpose. */
export const stepUpRequestSchema = z.object({
  purpose: z.enum([
    'reveal_card',
    'add_beneficiary',
    'high_value_transfer',
    'change_security_settings',
    'close_account',
  ]),
});

export const stepUpVerifyRequestSchema = z.object({
  challengeId: idSchema,
  code: z.string().min(6).max(16),
});

export const stepUpTokenSchema = z.object({
  stepUpToken: z.string(),
  expiresAt: isoDateTimeSchema,
});

export type RegisterRequest = z.infer<typeof registerRequestSchema>;
export type LoginRequest = z.infer<typeof loginRequestSchema>;
export type LoginResponse = z.infer<typeof loginResponseSchema>;
export type AuthTokens = z.infer<typeof authTokensSchema>;
export type AuthenticatedUser = z.infer<typeof authenticatedUserSchema>;
export type MfaChallenge = z.infer<typeof mfaChallengeSchema>;
export type MfaVerifyRequest = z.infer<typeof mfaVerifyRequestSchema>;
export type Session = z.infer<typeof sessionSchema>;
export type StepUpRequest = z.infer<typeof stepUpRequestSchema>;
export type StepUpToken = z.infer<typeof stepUpTokenSchema>;
export type RecoveryCodes = z.infer<typeof recoveryCodesSchema>;
