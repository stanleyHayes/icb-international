import path from 'node:path';

/**
 * Shared locations for the a11y suite. Everything the suite writes (storage state, resolved
 * ids, violation results) lives under e2e/a11y so the mission owns its whole footprint.
 */

export const SUITE_DIR = __dirname;
export const A11Y_ROOT = path.resolve(SUITE_DIR, '..');
export const REPO_ROOT = path.resolve(A11Y_ROOT, '../..');
export const AUTH_DIR = path.join(A11Y_ROOT, '.auth');
export const RESULTS_DIR = path.join(A11Y_ROOT, 'results');

export const APP_DIRS = {
  marketing: path.join(REPO_ROOT, 'apps/marketing/src/app'),
  client: path.join(REPO_ROOT, 'apps/client/src/app'),
  admin: path.join(REPO_ROOT, 'apps/admin/src/app'),
} as const;

export type AppName = keyof typeof APP_DIRS;

export const BASE_URLS: Record<AppName, string> = {
  marketing: process.env['A11Y_MARKETING_URL'] ?? 'http://localhost:3100',
  client: process.env['A11Y_CLIENT_URL'] ?? 'http://localhost:3101',
  admin: process.env['A11Y_ADMIN_URL'] ?? 'http://localhost:3102',
};

export const API_URL = process.env['A11Y_API_URL'] ?? 'http://localhost:4100/v1';

export const MONGO_URI =
  process.env['A11Y_MONGO_URI'] ??
  'mongodb://localhost:27217/icb?replicaSet=icb-rs&directConnection=true';

export const AVAILABILITY_FILE = path.join(AUTH_DIR, 'availability.json');
export const IDS_FILE = path.join(AUTH_DIR, 'dynamic-ids.json');
export const ADMIN_TOTP_FILE = path.join(AUTH_DIR, 'admin-totp.json');

export const STORAGE_STATE: Record<'client' | 'admin' | 'adminUnenrolled', string> = {
  client: path.join(AUTH_DIR, 'client.json'),
  admin: path.join(AUTH_DIR, 'admin.json'),
  adminUnenrolled: path.join(AUTH_DIR, 'admin-unenrolled.json'),
};
