import { configurationSchema, type RawConfiguration } from './configuration.schema.js';

/**
 * The shape the application actually consumes.
 *
 * Environment variables are flat and SHOUTY; application code should read
 * `config.jwt.accessTtlSeconds`, not `process.env.JWT_ACCESS_TTL_SECONDS`. This module is the
 * only place the two vocabularies meet.
 */
export interface AppConfiguration {
  readonly env: RawConfiguration['NODE_ENV'];
  readonly isProduction: boolean;
  readonly http: {
    readonly port: number;
    readonly host: string;
    readonly corsOrigins: readonly string[];
  };
  readonly logLevel: RawConfiguration['LOG_LEVEL'];
  readonly mongo: { readonly uri: string };
  readonly redis: { readonly url: string };
  readonly jwt: {
    readonly accessSecret: string;
    readonly refreshSecret: string;
    readonly accessTtlSeconds: number;
    readonly refreshTtlSeconds: number;
    readonly stepUpTtlSeconds: number;
  };
  readonly crypto: {
    readonly fieldEncryptionKey: string;
    readonly cookieSecret: string;
  };
  readonly email: {
    readonly apiKey: string;
    readonly from: string;
    readonly replyTo: string;
    readonly webhookSecret: string;
    /** False when no API key is configured — the recording transport is bound instead. */
    readonly enabled: boolean;
  };
  readonly media: {
    readonly cloudName: string;
    readonly apiKey: string;
    readonly apiSecret: string;
    readonly folder: string;
    readonly signedUrlTtlSeconds: number;
    /** False when credentials are absent — the local asset store is bound instead. */
    readonly enabled: boolean;
  };
  readonly bank: {
    readonly name: string;
    readonly bic: string;
    readonly country: string;
    readonly sortCode: string;
    readonly baseCurrency: string;
    readonly timezone: string;
  };
  readonly simulation: {
    readonly enabled: boolean;
    readonly seed: string;
  };
  /** False in CLI runs, so periodic sweeps never race a short-lived process's shutdown. */
  readonly backgroundJobs: { readonly enabled: boolean };
}

function formatIssues(error: unknown): string {
  if (!(error instanceof Error) || !('issues' in error)) {
    return String(error);
  }
  const issues = (error as { issues: { path: PropertyKey[]; message: string }[] }).issues;
  return issues.map((issue) => `  • ${issue.path.join('.') || '(root)'}: ${issue.message}`).join('\n');
}

/**
 * Parse and shape configuration. Throws with every problem listed at once, so a developer fixes
 * their `.env` in one pass instead of one variable per restart.
 */
export function loadConfiguration(source: NodeJS.ProcessEnv): AppConfiguration {
  const result = configurationSchema.safeParse(source);

  if (!result.success) {
    throw new Error(`Invalid configuration:\n${formatIssues(result.error)}`);
  }

  const raw = result.data;

  return {
    env: raw.NODE_ENV,
    isProduction: raw.NODE_ENV === 'production',
    http: { port: raw.API_PORT, host: raw.API_HOST, corsOrigins: raw.CORS_ORIGINS },
    logLevel: raw.LOG_LEVEL,
    mongo: { uri: raw.MONGO_URI },
    redis: { url: raw.REDIS_URL },
    jwt: jwtSection(raw),
    crypto: {
      fieldEncryptionKey: raw.FIELD_ENCRYPTION_KEY,
      cookieSecret: raw.COOKIE_SECRET,
    },
    email: emailSection(raw),
    media: mediaSection(raw),
    bank: bankSection(raw),
    simulation: { enabled: raw.SIMULATION_ENABLED, seed: raw.SIMULATION_SEED },
    backgroundJobs: { enabled: raw.BACKGROUND_JOBS_ENABLED },
  };
}

function jwtSection(raw: RawConfiguration): AppConfiguration['jwt'] {
  return {
    accessSecret: raw.JWT_ACCESS_SECRET,
    refreshSecret: raw.JWT_REFRESH_SECRET,
    accessTtlSeconds: raw.JWT_ACCESS_TTL_SECONDS,
    refreshTtlSeconds: raw.JWT_REFRESH_TTL_SECONDS,
    stepUpTtlSeconds: raw.STEP_UP_TTL_SECONDS,
  };
}

function emailSection(raw: RawConfiguration): AppConfiguration['email'] {
  return {
    apiKey: raw.RESEND_API_KEY,
    from: raw.EMAIL_FROM,
    replyTo: raw.EMAIL_REPLY_TO,
    webhookSecret: raw.RESEND_WEBHOOK_SECRET,
    // Without a key the recording transport is bound: messages are stored, never sent.
    enabled: raw.RESEND_API_KEY.length > 0,
  };
}

function mediaSection(raw: RawConfiguration): AppConfiguration['media'] {
  return {
    cloudName: raw.CLOUDINARY_CLOUD_NAME,
    apiKey: raw.CLOUDINARY_API_KEY,
    apiSecret: raw.CLOUDINARY_API_SECRET,
    folder: raw.CLOUDINARY_FOLDER,
    signedUrlTtlSeconds: raw.CLOUDINARY_SIGNED_URL_TTL_SECONDS,
    // Without credentials the local asset store is bound, with the same assetRef shape.
    enabled: raw.CLOUDINARY_CLOUD_NAME.length > 0 && raw.CLOUDINARY_API_KEY.length > 0,
  };
}

function bankSection(raw: RawConfiguration): AppConfiguration['bank'] {
  return {
    name: raw.BANK_NAME,
    bic: raw.BANK_BIC,
    country: raw.BANK_COUNTRY,
    sortCode: raw.BANK_SORT_CODE,
    baseCurrency: raw.BASE_CURRENCY,
    timezone: raw.BUSINESS_TIMEZONE,
  };
}

export const CONFIG = Symbol('ICB_CONFIG');
