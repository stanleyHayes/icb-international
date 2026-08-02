/**
 * Shared literals for `@icb/testing`.
 *
 * Every magic value used by the factories, fixtures, harness, and auth helpers lives here so a
 * change happens once and tests can assert against the named constant.
 */

/** Default seed for every PRNG in the package. Same seed → byte-identical fixtures. */
export const DEFAULT_SEED = 424_242;

/**
 * Default instant for the test clock: a Tuesday morning, after the weekend settlement batch.
 * Fixed so that no test ever reads the host clock (agent_plan.md N8).
 */
export const DEFAULT_EPOCH_ISO = '2024-01-02T09:30:00.000Z';

/** Crockford base32 — the ULID alphabet (no I, L, O, U). */
export const CROCKFORD_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/** ULID layout: 48-bit time as 10 chars, 80-bit entropy as 16 chars. */
export const ULID_TIME_LENGTH = 10;
export const ULID_ENTROPY_LENGTH = 16;
/** Entropy chars drawn from the PRNG; the remainder encode a monotonic counter for uniqueness. */
export const ULID_COUNTER_LENGTH = 6;

/** Human-facing references (`TRF-8F3K2M9Q`) use 8 Crockford chars, matching apps/api. */
export const REFERENCE_BODY_LENGTH = 8;

/** Fixed identity defaults for auth helpers — valid ULIDs, deterministic across suites. */
export const TEST_USER_ID = '01JTEST0000000000000000001';
export const TEST_CUSTOMER_ID = '01JTEST0000000000000000002';
export const TEST_SESSION_ID = '01JTEST0000000000000000003';
export const TEST_USER_EMAIL = 'ada.lovelace@example.com';

/** Mirror of the API's token signing contract (apps/api TokenService). */
export const JWT_ISSUER = 'icb';
export const JWT_AUDIENCE = 'icb-clients';
export const JWT_ACCESS_TTL_SECONDS = 900;
export const JWT_ACCESS_TYPE = 'access';

/** Test database names: `<prefix>_<suffix>`, never the dev database. */
export const TEST_DB_NAME_PREFIX = 'icb_test';
export const TEST_DB_SUFFIX_LENGTH = 8;

/** Fail fast rather than hang a suite when Mongo is unreachable. */
export const MONGO_SELECTION_TIMEOUT_MS = 5_000;

/** Bounds for generated money amounts (minor units), small enough to read in a failure diff. */
export const MIN_AMOUNT_MINOR_UNITS = 100;
export const MAX_AMOUNT_MINOR_UNITS = 1_000_000;

/** Default opening balance used by the minimal-bank fixture. */
export const FIXTURE_FUNDING_MINOR_UNITS = 250_000;
export const FIXTURE_CURRENCY = 'GHS';
