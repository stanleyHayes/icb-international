import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Loads the repository `.env` into `process.env` before any test constructs the Nest context.
 *
 * Integration tests boot the real application, which validates its configuration at startup and
 * refuses to start on a missing variable — correct behaviour that would otherwise make every
 * integration test fail for the wrong reason.
 *
 * Existing values win, so CI (which supplies real environment variables) is never overridden.
 */
const ENV_FILE = resolve(import.meta.dirname, '../../.env');

try {
  const contents = readFileSync(ENV_FILE, 'utf8');

  for (const line of contents.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const separator = trimmed.indexOf('=');
    if (separator === -1) continue;

    const key = trimmed.slice(0, separator).trim();
    const value = trimmed
      .slice(separator + 1)
      .trim()
      .replace(/^["'](.*)["']$/, '$1');

    process.env[key] ??= value;
  }
} catch {
  // No .env is fine: CI supplies the variables directly, and the config schema will say so
  // clearly if anything is genuinely missing.
}

process.env['NODE_ENV'] ??= 'test';

/**
 * Test-only defaults for the variables the configuration schema requires.
 *
 * The loader above assumed a missing `.env` was fine because "CI supplies the variables
 * directly" — CI does not, and never did. That only stayed hidden because a failure earlier in
 * the run stopped this package's tests from executing at all; the moment that failure was fixed,
 * `app-boot.spec.ts` and `simulation.module.spec.ts` began refusing to build a Nest context for
 * want of a Mongo URI.
 *
 * Defining them here makes the suite hermetic: it no longer passes or fails according to whether
 * the machine happens to have a `.env`, which is the same class of defect as a figure that
 * formats differently on a different host. `??=` throughout, so a real environment still wins and
 * the integration suite keeps pointing at the database CI actually starts.
 *
 * These values are syntactically valid and functionally inert — nothing here decrypts, signs, or
 * connects to anything real.
 */
process.env['MONGO_URI'] ??= 'mongodb://127.0.0.1:27017/icb-test';
process.env['JWT_ACCESS_SECRET'] ??= 'test-access-secret-not-used-outside-vitest-0001';
process.env['JWT_REFRESH_SECRET'] ??= 'test-refresh-secret-not-used-outside-vitest-002';
process.env['FIELD_ENCRYPTION_KEY'] ??= '0'.repeat(64);
process.env['COOKIE_SECRET'] ??= 'test-cookie-secret-inert';
process.env['CORS_ORIGINS'] ??= 'http://localhost:3100';
