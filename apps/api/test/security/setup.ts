/**
 * Process-local environment for the SEC-02 suite (runs in every worker, before spec imports).
 *
 * - `BACKGROUND_JOBS_ENABLED=false` keeps the outbox drain quiet against a throwaway database.
 * - When the global setup managed to spawn a throwaway `redis-server`, `REDIS_URL` is repointed
 *   at it so BullMQ workers connect to something private instead of retrying the dead dev port
 *   forever. Without it the application's own fail-fast cache behaviour is left untouched.
 */

import { readFileSync } from 'node:fs';

import { INFRA_STATE_PATH } from './infra-state.js';

process.env['BACKGROUND_JOBS_ENABLED'] = 'false';

try {
  const state = JSON.parse(readFileSync(INFRA_STATE_PATH, 'utf8')) as { redisUrl?: string };
  if (typeof state.redisUrl === 'string' && state.redisUrl.length > 0) {
    process.env['REDIS_URL'] = state.redisUrl;
  }
} catch {
  // No state file: leave REDIS_URL as the .env provides it. The API tolerates a dead Redis.
}
