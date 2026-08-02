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
