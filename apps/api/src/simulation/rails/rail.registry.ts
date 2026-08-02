import type { RailProfile, SimulationRail } from '@icb/contracts';
import { Inject, Injectable, Logger } from '@nestjs/common';

import { NotFoundError, RailRejectedError } from '../../common/errors/index.js';
import { SimulationStateService } from '../../modules/simulation/simulation-state.service.js';
import { ClockService } from '../clock/clock.service.js';
import { createHelpers, type RandomHelpers } from '../seed/random.js';
import { RAIL_UNAVAILABLE } from './rail-codes.js';
import { RAIL_ADAPTERS } from './rail.tokens.js';
import type {
  DispatchOptions,
  Rail,
  RailResult,
  RailSubmission,
} from './rail.types.js';

const MS_PER_HOUR = 3_600_000;
const MS_PER_DAY = 86_400_000;
/** Ad-hoc dispatches share one stream; scenarios pass their own so a replay is exact. */
const DEFAULT_RAIL_SEED = 'icb-rails';

/**
 * The only place a rail exists.
 *
 * Adapters describe behaviour; this decides which one applies, what its live profile is, when the
 * value lands, and what happens when an operator has switched the rail off. Centralising that
 * means "ACH is down" is one edit to one document rather than a change to every module that
 * happens to send money.
 */
@Injectable()
export class RailRegistry {
  private readonly logger = new Logger(RailRegistry.name);
  private readonly random: RandomHelpers = createHelpers(DEFAULT_RAIL_SEED);

  constructor(
    @Inject(RAIL_ADAPTERS) private readonly adapters: readonly Rail[],
    private readonly state: SimulationStateService,
    private readonly clock: ClockService,
  ) {}

  /** Every rail key the simulator answers for, including adapter aliases. */
  keys(): SimulationRail[] {
    return this.adapters.flatMap((adapter) => [adapter.rail, ...(adapter.aliases ?? [])]);
  }

  adapterFor(rail: SimulationRail): Rail {
    const adapter = this.adapters.find(
      (candidate) => candidate.rail === rail || (candidate.aliases ?? []).includes(rail),
    );
    if (!adapter) {
      throw new NotFoundError('Rail', rail);
    }
    return adapter;
  }

  /** Shipped defaults, expanded so an aliased key gets a profile of its own. */
  defaultProfiles(): RailProfile[] {
    return this.adapters.flatMap((adapter) => [
      adapter.defaultProfile,
      ...(adapter.aliases ?? []).map((alias) => ({ ...adapter.defaultProfile, rail: alias })),
    ]);
  }

  /** Live profiles: whatever is stored, backfilled from defaults for any rail never edited. */
  async profiles(): Promise<RailProfile[]> {
    const stored = await this.state.railProfiles();
    const byRail = new Map(stored.map((profile) => [profile.rail, profile]));
    return this.defaultProfiles().map((fallback) => byRail.get(fallback.rail) ?? fallback);
  }

  async profileFor(rail: SimulationRail): Promise<RailProfile> {
    this.adapterFor(rail);
    const profiles = await this.profiles();
    const profile = profiles.find((candidate) => candidate.rail === rail);
    if (!profile) {
      throw new NotFoundError('Rail profile', rail);
    }
    return profile;
  }

  /** Persist a runtime change. Latency, failure rate and cut-off are all editable live. */
  async updateProfile(
    rail: SimulationRail,
    patch: Partial<Omit<RailProfile, 'rail'>>,
  ): Promise<RailProfile> {
    const current = await this.profileFor(rail);
    const updated: RailProfile = { ...current, ...patch, rail };
    await this.state.saveRailProfile(updated);
    this.logger.warn({ rail, patch }, 'Rail profile changed');
    return updated;
  }

  /**
   * Send one instruction.
   *
   * A disabled rail rejects before the adapter is consulted: nothing was transmitted, so it would
   * be dishonest to return a network code.
   */
  async dispatch(
    rail: SimulationRail,
    submission: RailSubmission,
    options: DispatchOptions & { random?: RandomHelpers; at?: Date } = {},
  ): Promise<RailResult> {
    const adapter = this.adapterFor(rail);
    const profile = await this.profileFor(rail);
    const random = options.random ?? this.random;
    const submittedAt = options.at ?? this.clock.now();

    if (!profile.enabled) {
      return {
        accepted: false,
        rail,
        code: RAIL_UNAVAILABLE,
        label: 'The rail is not accepting instructions',
        latencyMs: 0,
        payload: { rail, sourceId: submission.sourceId },
      };
    }

    const timing = this.settlementFor(profile, submittedAt);
    const result = adapter.submit(submission, { profile, random, submittedAt, ...timing });

    if (options.applyLatency) {
      await delay(result.latencyMs);
    }
    return result;
  }

  /** Dispatch and convert a rejection into the domain error callers already handle. */
  async dispatchOrThrow(
    rail: SimulationRail,
    submission: RailSubmission,
    options: DispatchOptions & { random?: RandomHelpers; at?: Date } = {},
  ): Promise<RailResult> {
    const result = await this.dispatch(rail, submission, options);
    if (!result.accepted) {
      throw new RailRejectedError(rail, result.code, result.label);
    }
    return result;
  }

  /**
   * When value lands.
   *
   * Delay first, then the cut-off penalty, then the business calendar — in that order, because a
   * wire missing a Friday cut-off settles on Monday, not on Saturday.
   */
  settlementFor(
    profile: RailProfile,
    submittedAt: Date,
  ): { settlesAt: Date; pastCutOff: boolean } {
    const pastCutOff = profile.cutOffTime
      ? this.clock.isPastCutOff(profile.cutOffTime, submittedAt)
      : false;

    const delayMs = profile.settlementDelayHours * MS_PER_HOUR + (pastCutOff ? MS_PER_DAY : 0);
    return { settlesAt: this.toBankingDay(new Date(submittedAt.getTime() + delayMs)), pastCutOff };
  }

  /** The instant itself when it falls on a banking day, otherwise the next one. */
  private toBankingDay(instant: Date): Date {
    let cursor = instant;
    // Bounded by construction: a weekend plus the longest holiday run is well under a week.
    for (let guard = 0; guard < 10 && !this.clock.isBusinessDay(cursor); guard += 1) {
      cursor = new Date(cursor.getTime() + MS_PER_DAY);
    }
    return cursor;
  }
}

async function delay(milliseconds: number): Promise<void> {
  if (milliseconds <= 0) {
    return;
  }
  await new Promise((resolve) => setTimeout(resolve, milliseconds));
}
