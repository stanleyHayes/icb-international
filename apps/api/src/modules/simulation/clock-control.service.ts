import type { AdvanceClockRequest, ClockState, setClockRequestSchema } from '@icb/contracts';
import { Injectable, Logger } from '@nestjs/common';
import type { z } from 'zod';

import { ValidationError } from '../../common/errors/index.js';
import { EndOfDayService } from '../../simulation/eod/end-of-day.service.js';
import { ClockService } from '../../simulation/clock/clock.service.js';
import { parseIsoDuration } from './domain/duration.js';
import { SimulationStateService } from './simulation-state.service.js';

export type SetClockRequest = z.infer<typeof setClockRequestSchema>;

const MS_PER_DAY = 86_400_000;
/** One second before midnight: the instant a business day is closed at. */
const END_OF_DAY_MS = MS_PER_DAY - 1_000;
/**
 * A jump of more than a year would run hundreds of end-of-day batches and take minutes. The jump
 * still happens; only the batches are capped, and the cap is reported rather than hidden.
 */
const MAX_END_OF_DAY_RUNS = 366;

/**
 * Time travel.
 *
 * Advancing the clock is not just moving a number: a bank that skips from March to April without
 * closing the days between has no interest accruals, no statements, and no aged arrears for that
 * month. So the jump is performed *through* each business day it crosses, closing each one at its
 * own end-of-day instant, which is why an operator can advance a month and watch a year's worth of
 * behaviour appear in the right order.
 */
@Injectable()
export class ClockControlService {
  private readonly logger = new Logger(ClockControlService.name);

  constructor(
    private readonly clock: ClockService,
    private readonly state: SimulationStateService,
    private readonly endOfDay: EndOfDayService,
  ) {}

  current(): ClockState {
    const now = this.clock.now();
    return {
      now: now.toISOString(),
      offsetMs: Math.trunc(this.clock.getOffsetMs()),
      frozen: this.clock.isFrozen(),
      businessDate: this.clock.toIsoDate(now),
      isBusinessDay: this.clock.isBusinessDay(now),
      nextBusinessDate: this.clock.toIsoDate(this.clock.nextBusinessDay(now)),
    };
  }

  async advance(request: AdvanceClockRequest): Promise<ClockState> {
    const from = this.clock.now();
    const target = this.targetFor(request, from);

    if (target.getTime() < from.getTime()) {
      throw new ValidationError('The clock cannot be advanced backwards', [
        { path: 'to', message: 'Use POST /simulation/clock/set to move the clock backwards' },
      ]);
    }

    if (request.runEndOfDay) {
      await this.closeCrossedDays(from, target);
    }

    this.clock.setTo(target);
    await this.state.persistClock();
    this.logger.warn({ from: from.toISOString(), to: target.toISOString() }, 'Clock advanced');
    return this.current();
  }

  private targetFor(request: AdvanceClockRequest, from: Date): Date {
    if (request.to) {
      return new Date(request.to);
    }
    if (!request.duration) {
      throw new ValidationError('Provide exactly one of duration or to');
    }
    return new Date(from.getTime() + parseIsoDuration(request.duration));
  }

  /**
   * Close every business day strictly between the starting day and the target day.
   *
   * The clock is moved to each day's own end-of-day instant before the batch runs, so every
   * posting the batch makes is dated correctly rather than all landing on the arrival date.
   */
  private async closeCrossedDays(from: Date, target: Date): Promise<number> {
    const lastDay = this.clock.startOfDay(target).getTime();
    let cursor = this.clock.startOfDay(from);
    let runs = 0;

    while (cursor.getTime() < lastDay) {
      if (runs >= MAX_END_OF_DAY_RUNS) {
        this.logger.warn({ cap: MAX_END_OF_DAY_RUNS }, 'End-of-day runs capped for this jump');
        break;
      }
      if (this.clock.isBusinessDay(cursor)) {
        this.clock.setTo(new Date(cursor.getTime() + END_OF_DAY_MS));
        await this.endOfDay.run(this.clock.toIsoDate(cursor));
        runs += 1;
      }
      cursor = new Date(cursor.getTime() + MS_PER_DAY);
    }
    return runs;
  }

  /** Absolute set, plus freeze and unfreeze. Both are optional and independent. */
  async set(request: SetClockRequest): Promise<ClockState> {
    if (request.to) {
      this.clock.setTo(new Date(request.to));
    }
    if (request.frozen === true) {
      this.clock.freeze();
    }
    if (request.frozen === false) {
      this.clock.unfreeze();
    }

    await this.state.persistClock();
    this.logger.warn({ request }, 'Clock set');
    return this.current();
  }

  async reset(): Promise<ClockState> {
    this.clock.reset();
    await this.state.persistClock();
    this.logger.warn('Clock reset to real time');
    return this.current();
  }
}
