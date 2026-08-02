/** Constants for the schema-driven mock data generator. */

export const DEFAULT_MOCK_SEED = 42;
export const NULL_PROBABILITY = 0.25;
export const MAX_ARRAY_ITEMS = 3;
export const MAX_DEPTH = 8;
export const RECORD_ENTRIES = 2;

export const DEFAULT_MIN_INT = 1;
export const DEFAULT_MAX_INT = 100_000;
export const DEFAULT_MAX_FLOAT = 100;
export const FLOAT_FRACTION_DIGITS = 2;

export const ISO_DATE_LENGTH = 10;
export const ULID_LENGTH = 26;
export const CROCKFORD_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/** Fixed reference instant so relative faker dates (`recent`, `soon`) stay deterministic. */
export const MOCK_REFERENCE_DATE = new Date('2026-01-15T12:00:00.000Z');
