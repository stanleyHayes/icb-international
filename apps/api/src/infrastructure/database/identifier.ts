import { ulid } from 'ulid';

/**
 * Identifier generation.
 *
 * ULIDs rather than ObjectIds or UUIDv4:
 *  - lexicographically sortable, so `_id` ordering *is* creation ordering and cursor pagination
 *    over `_id` needs no secondary sort;
 *  - generated in the application, so a document has its identity before it reaches the database
 *    (necessary when a ledger entry must reference its transaction inside the same write);
 *  - opaque and non-sequential across processes, so they leak no volume information.
 */
export function newId(): string {
  return ulid();
}

/**
 * Deterministic identifier for seeded data. Same seed and sequence, same id — so a demo can be
 * rebuilt byte-identically and a bug report can point at a stable document.
 */
export function seededId(timestampMs: number, entropy: () => number): string {
  return ulid(timestampMs).slice(0, 10) + randomSuffix(entropy);
}

const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const SUFFIX_LENGTH = 16;

function randomSuffix(entropy: () => number): string {
  let suffix = '';
  for (let index = 0; index < SUFFIX_LENGTH; index += 1) {
    suffix += CROCKFORD[Math.floor(entropy() * CROCKFORD.length)] ?? '0';
  }
  return suffix;
}

const ULID_PATTERN = /^[0-9A-HJKMNP-TV-Z]{26}$/;

export function isUlid(value: unknown): value is string {
  return typeof value === 'string' && ULID_PATTERN.test(value);
}

/**
 * Human-facing reference, e.g. `TRF-8F3K2M9Q`. Shown on receipts and quoted to support, so it is
 * short, unambiguous when read aloud, and never reuses the ambiguous letters ULID already drops.
 */
export function newReference(prefix: string, entropy: () => number = Math.random): string {
  let body = '';
  for (let index = 0; index < 8; index += 1) {
    body += CROCKFORD[Math.floor(entropy() * CROCKFORD.length)] ?? '0';
  }
  return `${prefix}-${body}`;
}
