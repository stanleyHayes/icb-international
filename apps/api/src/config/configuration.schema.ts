import { z } from 'zod';

/**
 * Runtime configuration.
 *
 * Parsed once at boot. If anything is missing or malformed the process exits with a readable
 * message rather than starting and failing later in an unrelated place — a bank that boots with
 * half its configuration is a bank that loses money in a way nobody can explain.
 */

const csv = (value: string): string[] =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

const booleanish = z
  .string()
  .transform((value) => value.toLowerCase() === 'true')
  .pipe(z.boolean());

export const configurationSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    API_PORT: z.coerce.number().int().min(1).max(65535).default(4000),
    API_HOST: z.string().default('0.0.0.0'),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

    MONGO_URI: z.string().startsWith('mongodb'),
    REDIS_URL: z.string().startsWith('redis'),

    JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
    JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
    JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().positive().default(900),
    JWT_REFRESH_TTL_SECONDS: z.coerce.number().int().positive().default(604_800),
    STEP_UP_TTL_SECONDS: z.coerce.number().int().positive().default(300),
    FIELD_ENCRYPTION_KEY: z
      .string()
      .regex(/^[0-9a-f]{64}$/i, 'FIELD_ENCRYPTION_KEY must be 64 hex characters (32 bytes)'),
    COOKIE_SECRET: z.string().min(16),
    CORS_ORIGINS: z.string().transform(csv),

    RESEND_API_KEY: z.string().default(''),
    EMAIL_FROM: z.string().default('ICB <no-reply@icb.example>'),
    EMAIL_REPLY_TO: z.string().default('support@icb.example'),
    RESEND_WEBHOOK_SECRET: z.string().default(''),

    CLOUDINARY_CLOUD_NAME: z.string().default(''),
    CLOUDINARY_API_KEY: z.string().default(''),
    CLOUDINARY_API_SECRET: z.string().default(''),
    CLOUDINARY_FOLDER: z.string().default('icb'),
    CLOUDINARY_SIGNED_URL_TTL_SECONDS: z.coerce.number().int().positive().default(300),

    BANK_NAME: z.string().default('ICB International Commercial Bank'),
    BANK_BIC: z.string().min(8).max(11).default('ICBKGHAC'),
    BANK_COUNTRY: z.string().length(2).default('GH'),
    BANK_SORT_CODE: z.string().regex(/^\d{2}-\d{2}-\d{2}$/).default('60-16-13'),
    BASE_CURRENCY: z.string().length(3).default('USD'),
    BUSINESS_TIMEZONE: z.string().default('UTC'),

    SIMULATION_ENABLED: booleanish.default(true),
    SIMULATION_SEED: z.string().default('icb-default-seed'),
    ICB_SIMULATION_ACKNOWLEDGED: booleanish.default(false),
  })
  .refine(
    (config) => config.NODE_ENV !== 'production' || config.ICB_SIMULATION_ACKNOWLEDGED,
    {
      error:
        'ICB only ever simulates money movement. Set ICB_SIMULATION_ACKNOWLEDGED=true to run with NODE_ENV=production.',
      path: ['ICB_SIMULATION_ACKNOWLEDGED'],
    },
  )
  .refine((config) => config.JWT_ACCESS_SECRET !== config.JWT_REFRESH_SECRET, {
    error: 'JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must differ',
    path: ['JWT_REFRESH_SECRET'],
  });

export type RawConfiguration = z.infer<typeof configurationSchema>;
