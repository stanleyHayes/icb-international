import type { FxRate } from '@icb/contracts';
import type { CurrencyCode } from '@icb/money';
import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { CONFIG, type AppConfiguration } from '../../config/configuration.js';
import { newId } from '../../infrastructure/database/identifier.js';
import { ClockService } from '../../simulation/clock/clock.service.js';
import { listPairs, parsePair, type CurrencyPair } from './domain/fx-pair.js';
import { DEFAULT_SPREAD_BPS, dealtRates } from './domain/fx-spread.js';
import { changePercent24h, historyInstants, midRateAt } from './domain/rate-drift.js';
import { toFxRate, toRateDocumentFields } from './infrastructure/fx.mapper.js';
import { FxRateDoc } from './infrastructure/fx.schemas.js';

/** How stale the persisted board may get before a read refreshes it, in simulated milliseconds. */
const REFRESH_INTERVAL_MS = 60_000;

const DEFAULT_HISTORY_POINTS = 24;
const DEFAULT_HISTORY_HOURS = 24;

/** Chart controls. Written with explicit `undefined` because `exactOptionalPropertyTypes` is on. */
export interface RateHistoryOptions {
  readonly spreadBps?: number | undefined;
  readonly points?: number | undefined;
  readonly hours?: number | undefined;
}

/**
 * The rate board.
 *
 * Every pair among the currencies `@icb/money` supports is quoted — 210 of them — seeded on boot
 * and thereafter derived from the simulated clock by `midRateAt()`. Reads compute the live value
 * and lazily refresh the persisted board, so advancing the clock a week and reloading shows a
 * week of movement without a scheduler, a timer, or a single call to `Math.random()`.
 */
@Injectable()
export class FxRatesService implements OnModuleInit {
  private readonly logger = new Logger(FxRatesService.name);
  private lastRefreshMs = Number.NEGATIVE_INFINITY;

  constructor(
    @InjectModel(FxRateDoc.name) private readonly rates: Model<FxRateDoc>,
    @Inject(CONFIG) private readonly config: AppConfiguration,
    private readonly clock: ClockService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.seed();
  }

  /** Write the whole board once at the standard spread, so the collection is never empty. */
  async seed(): Promise<void> {
    const rates = this.computeAll(DEFAULT_SPREAD_BPS, this.clock.now());
    await this.persist(rates);
    this.lastRefreshMs = this.clock.epochMs();
    this.logger.log({ pairs: rates.length }, 'FX rate table seeded');
  }

  /** The full board at the caller's spread. */
  async list(spreadBps: number = DEFAULT_SPREAD_BPS): Promise<FxRate[]> {
    const rates = this.computeAll(spreadBps, this.clock.now());
    await this.refreshIfStale(rates);
    return rates;
  }

  async get(pair: CurrencyPair, spreadBps: number = DEFAULT_SPREAD_BPS): Promise<FxRate> {
    const rate = this.compute(pair, spreadBps, this.clock.now());
    await this.rates.updateOne(
      { pair: rate.pair },
      { $set: toRateDocumentFields(rate), $setOnInsert: { _id: newId() } },
      { upsert: true },
    );
    return rate;
  }

  /** Convenience for callers holding a `EUR-USD`-style path segment rather than a parsed pair. */
  async getByKey(pairKeyValue: string, spreadBps?: number): Promise<FxRate> {
    return this.get(parsePair(pairKeyValue), spreadBps);
  }

  /**
   * The historical series.
   *
   * Recomputed rather than read back, because the drift function *is* the history: it is defined
   * for every instant, so the series stays consistent with the present even after an operator
   * jumps the simulated clock backwards. A stored series would contradict itself the moment they
   * did.
   */
  history(pair: CurrencyPair, options: RateHistoryOptions = {}): FxRate[] {
    const spreadBps = options.spreadBps ?? DEFAULT_SPREAD_BPS;
    const points = options.points ?? DEFAULT_HISTORY_POINTS;
    const hours = options.hours ?? DEFAULT_HISTORY_HOURS;

    return historyInstants(this.clock.epochMs(), points, hours).map((atMs) =>
      this.compute(pair, spreadBps, new Date(atMs)),
    );
  }

  /** The mid-market rate a quote is built from. Pure — no database, no wall clock. */
  midFor(base: CurrencyCode, quote: CurrencyCode, at: Date = this.clock.now()): number {
    return midRateAt(this.seedValue(), base, quote, at.getTime());
  }

  private computeAll(spreadBps: number, at: Date): FxRate[] {
    return listPairs().map((pair) => this.compute(pair, spreadBps, at));
  }

  private compute(pair: CurrencyPair, spreadBps: number, at: Date): FxRate {
    const atMs = at.getTime();
    const mid = midRateAt(this.seedValue(), pair.base, pair.quote, atMs);
    const dealt = dealtRates(mid, spreadBps);

    return toFxRate({
      pair,
      mid,
      buy: dealt.buy,
      sell: dealt.sell,
      spreadBps,
      changePercent24h: changePercent24h(this.seedValue(), pair.base, pair.quote, atMs),
      effectiveAt: at,
    });
  }

  /**
   * Refresh the persisted board at most once a simulated minute. Recomputing is cheap; writing
   * 210 rows on every read is not, and the board is a cache — nothing depends on it being exact.
   */
  private async refreshIfStale(rates: readonly FxRate[]): Promise<void> {
    const nowMs = this.clock.epochMs();
    if (Math.abs(nowMs - this.lastRefreshMs) < REFRESH_INTERVAL_MS) {
      return;
    }
    this.lastRefreshMs = nowMs;
    await this.persist(rates);
  }

  private async persist(rates: readonly FxRate[]): Promise<void> {
    await this.rates.bulkWrite(
      rates.map((rate) => ({
        updateOne: {
          filter: { pair: rate.pair },
          update: { $set: toRateDocumentFields(rate), $setOnInsert: { _id: newId() } },
          upsert: true,
        },
      })),
      { ordered: false },
    );
  }

  private seedValue(): string {
    return this.config.simulation.seed;
  }
}
