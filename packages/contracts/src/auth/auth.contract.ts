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
  /** Opaque, client-generated, stable per browser. Recorded on the session row. */
  deviceId: z.string().min(8).max(128).optional(),
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
  roles: z.array(staffRoleSchema),
  lastLoginAt: isoDateTimeSchema.nullable(),
});

/** Login always completes with an authenticated session. */
export const loginResponseSchema = z.object({
  outcome: z.literal('authenticated'),
  tokens: authTokensSchema,
  user: authenticatedUserSchema,
});

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

export const sessionSchema = z.object({
  id: idSchema,
  device: z.object({
    label: z.string(),
    browser: z.string().nullable(),
    os: z.string().nullable(),
  }),
  ipAddress: z.string(),
  location: z.string().nullable(),
  createdAt: isoDateTimeSchema,
  lastSeenAt: isoDateTimeSchema,
  current: z.boolean(),
});

/**
 * One sign-in event as the customer sees it on their security screen, read back out of the
 * append-only audit trail. The wire keeps the greppable audit action name, e.g. `auth.login`.
 */
export const loginHistoryEntrySchema = z.object({
  id: idSchema,
  action: z.string(),
  outcome: z.string(),
  ipAddress: z.string().nullable(),
  userAgent: z.string().nullable(),
  occurredAt: isoDateTimeSchema,
});

export type RegisterRequest = z.infer<typeof registerRequestSchema>;
export type LoginRequest = z.infer<typeof loginRequestSchema>;
export type LoginResponse = z.infer<typeof loginResponseSchema>;
export type AuthTokens = z.infer<typeof authTokensSchema>;
export type AuthenticatedUser = z.infer<typeof authenticatedUserSchema>;
export type Session = z.infer<typeof sessionSchema>;
export type LoginHistoryEntry = z.infer<typeof loginHistoryEntrySchema>;
