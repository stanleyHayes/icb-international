import { DEFAULT_EPOCH_ISO } from '../testing.constants.js';

const MS_PER_SECOND = 1_000;
const MS_PER_DAY = 86_400_000;
const ISO_DATE_LENGTH = 10;

/**
 * Deterministic clock for tests.
 *
 * The mirror of the API's ClockService: time is a value you hold, not a global you read. No
 * method touches `Date.now()` — a test that needs "now" starts at {@link DEFAULT_EPOCH_ISO} (or
 * an explicit instant) and advances from there, so time-travel scenarios replay identically.
 */
export class TestClock {
  private epochMs: number;

  constructor(epochMs: number) {
    this.epochMs = epochMs;
  }

  static fixed(): TestClock {
    return TestClock.fromIso(DEFAULT_EPOCH_ISO);
  }

  static fromIso(iso: string): TestClock {
    return new TestClock(Date.parse(iso));
  }

  epochMilliseconds(): number {
    return this.epochMs;
  }

  epochSeconds(): number {
    return Math.floor(this.epochMs / MS_PER_SECOND);
  }

  now(): Date {
    return new Date(this.epochMs);
  }

  iso(): string {
    return this.now().toISOString();
  }

  /** YYYY-MM-DD at the current instant (UTC), for value dates and dates of birth. */
  today(): string {
    return this.iso().slice(0, ISO_DATE_LENGTH);
  }

  /** Move the clock forward. Returns the new instant for convenience. */
  advanceBy(milliseconds: number): Date {
    this.epochMs += milliseconds;
    return this.now();
  }

  advanceDays(days: number): Date {
    return this.advanceBy(days * MS_PER_DAY);
  }

  /** Instant `days` after the current time, without moving the clock. */
  isoPlusDays(days: number): string {
    return new Date(this.epochMs + days * MS_PER_DAY).toISOString();
  }

  datePlusDays(days: number): string {
    return this.isoPlusDays(days).slice(0, ISO_DATE_LENGTH);
  }

  /** An independent clock at the same instant — mutating one must not move the other. */
  fork(): TestClock {
    return new TestClock(this.epochMs);
  }
}
