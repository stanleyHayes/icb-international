import { Injectable } from '@nestjs/common';

import { BUSINESS_HOLIDAYS } from './holidays.constants.js';

const MS_PER_DAY = 86_400_000;

/**
 * The application's only source of time.
 *
 * Every timestamp, every accrual, every cut-off, every statement period is derived from here.
 * `new Date()` is banned by lint everywhere else (agent_plan.md N8) because the whole point of
 * this system is that an operator can advance the clock a month and watch interest accrue,
 * statements generate, and loans age — behaviour that is invisible if the code reads wall time.
 *
 * The offset lives in memory here and is persisted by SimulationStateService so that a restart,
 * or a second process, sees the same "now".
 */
@Injectable()
export class ClockService {
  private offsetMs = 0;
  private frozenAt: number | null = null;

  now(): Date {
    return new Date(this.epochMs());
  }

  epochMs(): number {
    // eslint-disable-next-line no-restricted-syntax -- the single sanctioned read of wall time.
    return this.frozenAt ?? Date.now() + this.offsetMs;
  }

  /** ISO date of the current business date, e.g. `2026-08-02`. */
  today(): string {
    return this.toIsoDate(this.now());
  }

  getOffsetMs(): number {
    return this.offsetMs;
  }

  isFrozen(): boolean {
    return this.frozenAt !== null;
  }

  /** Move the clock forward (or back) by a duration in milliseconds. */
  advance(milliseconds: number): void {
    if (this.frozenAt !== null) {
      this.frozenAt += milliseconds;
      return;
    }
    this.offsetMs += milliseconds;
  }

  /** Jump to an absolute instant. */
  setTo(instant: Date): void {
    if (this.frozenAt !== null) {
      this.frozenAt = instant.getTime();
      return;
    }
    // eslint-disable-next-line no-restricted-syntax -- the single sanctioned read of wall time.
    this.offsetMs = instant.getTime() - Date.now();
  }

  /** Stop time entirely. Used by the test harness so assertions are not racing the clock. */
  freeze(at?: Date): void {
    this.frozenAt = at?.getTime() ?? this.epochMs();
  }

  unfreeze(): void {
    if (this.frozenAt === null) {
      return;
    }
    // eslint-disable-next-line no-restricted-syntax -- the single sanctioned read of wall time.
    this.offsetMs = this.frozenAt - Date.now();
    this.frozenAt = null;
  }

  reset(): void {
    this.offsetMs = 0;
    this.frozenAt = null;
  }

  /** Restore a persisted offset on boot so every process agrees on "now". */
  restore(offsetMs: number, frozen: boolean): void {
    this.offsetMs = offsetMs;
    this.frozenAt = frozen ? this.epochMs() : null;
  }

  // ---- Business calendar --------------------------------------------------

  isBusinessDay(date: Date = this.now()): boolean {
    const day = date.getUTCDay();
    const isWeekend = day === 0 || day === 6;
    return !isWeekend && !BUSINESS_HOLIDAYS.has(this.toIsoDate(date));
  }

  /** The next business day strictly after `date`. */
  nextBusinessDay(date: Date = this.now()): Date {
    let cursor = new Date(date.getTime() + MS_PER_DAY);
    while (!this.isBusinessDay(cursor)) {
      cursor = new Date(cursor.getTime() + MS_PER_DAY);
    }
    return cursor;
  }

  /** Add `count` business days, skipping weekends and holidays. */
  addBusinessDays(count: number, from: Date = this.now()): Date {
    let cursor = from;
    for (let added = 0; added < count; added += 1) {
      cursor = this.nextBusinessDay(cursor);
    }
    return cursor;
  }

  /**
   * Whether a cut-off time (UTC `HH:mm`) has already passed today. A wire submitted at 16:01
   * against a 16:00 cut-off settles tomorrow, and the customer is told so before they confirm.
   */
  isPastCutOff(cutOff: string, at: Date = this.now()): boolean {
    const [hours = '0', minutes = '0'] = cutOff.split(':');
    const cutOffMinutes = Number(hours) * 60 + Number(minutes);
    const currentMinutes = at.getUTCHours() * 60 + at.getUTCMinutes();
    return currentMinutes >= cutOffMinutes;
  }

  toIsoDate(date: Date): string {
    return date.toISOString().slice(0, 10);
  }

  /** Start of the UTC day containing `date`. */
  startOfDay(date: Date = this.now()): Date {
    return new Date(`${this.toIsoDate(date)}T00:00:00.000Z`);
  }

  /** Inclusive first and last instant of the calendar month containing `date`. */
  monthBounds(date: Date = this.now()): { from: Date; to: Date } {
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth();
    return {
      from: new Date(Date.UTC(year, month, 1, 0, 0, 0, 0)),
      to: new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999)),
    };
  }

  /** Whole days between two instants, ignoring the time of day. */
  daysBetween(from: Date, to: Date): number {
    return Math.round((this.startOfDay(to).getTime() - this.startOfDay(from).getTime()) / MS_PER_DAY);
  }
}
