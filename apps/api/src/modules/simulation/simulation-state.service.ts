import type { RailProfile, SimulationRail } from '@icb/contracts';
import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { ClockService } from '../../simulation/clock/clock.service.js';
import { toRailProfile, toStoredRailProfile } from './infrastructure/simulation.mapper.js';
import { SIM_STATE_ID, SimStateDoc } from './infrastructure/simulation.schemas.js';

export interface ChaosSettings {
  enabled: boolean;
  databaseLatencyMs: number;
  randomFailureRate: number;
}

/**
 * The `sim_state` singleton.
 *
 * Two responsibilities that belong together: it is the durable home of the clock offset, and it
 * is the store every other simulation component reads its configuration from. Keeping them in one
 * document means a restart restores the whole simulated world atomically — the same "now", the
 * same rail behaviour, the same chaos settings — rather than half of it.
 */
@Injectable()
export class SimulationStateService implements OnModuleInit {
  private readonly logger = new Logger(SimulationStateService.name);

  constructor(
    @InjectModel(SimStateDoc.name) private readonly states: Model<SimStateDoc>,
    private readonly clock: ClockService,
  ) {}

  /**
   * Restore the persisted offset before anything reads the clock.
   *
   * A failure here must not stop the bank booting: an unreachable `sim_state` means the clock
   * runs true, which is the correct fallback and is visible immediately on the control screen.
   */
  async onModuleInit(): Promise<void> {
    try {
      const state = await this.read();
      this.clock.restore(state.clockOffsetMs, state.clockFrozen);
      if (state.clockOffsetMs !== 0 || state.clockFrozen) {
        this.logger.warn(
          { offsetMs: state.clockOffsetMs, frozen: state.clockFrozen },
          'Restored a simulated clock',
        );
      }
    } catch (error) {
      this.logger.error({ error }, 'Could not restore simulation state; the clock runs true');
    }
  }

  /** The singleton, created on first read so no migration or seed step is required. */
  async read(): Promise<SimStateDoc> {
    const existing = await this.states.findById(SIM_STATE_ID).lean();
    if (existing) {
      return existing;
    }

    await this.states.updateOne(
      { _id: SIM_STATE_ID },
      { $setOnInsert: { _id: SIM_STATE_ID } },
      { upsert: true },
    );

    const created = await this.states.findById(SIM_STATE_ID).lean();
    return created ?? this.empty();
  }

  async railProfiles(): Promise<RailProfile[]> {
    const state = await this.read();
    return state.railProfiles.map(toRailProfile);
  }

  /** Upsert one rail's profile, leaving every other rail untouched. */
  async saveRailProfile(profile: RailProfile): Promise<void> {
    const stored = toStoredRailProfile(profile);

    const updated = await this.states.updateOne(
      { _id: SIM_STATE_ID, 'railProfiles.rail': profile.rail },
      { $set: { 'railProfiles.$': stored } },
    );

    if (updated.matchedCount === 0) {
      await this.states.updateOne(
        { _id: SIM_STATE_ID },
        { $push: { railProfiles: stored } },
        { upsert: true },
      );
    }
  }

  async resetRailProfile(rail: SimulationRail): Promise<void> {
    await this.states.updateOne(
      { _id: SIM_STATE_ID },
      { $pull: { railProfiles: { rail } } },
    );
  }

  /** Called after every clock change so a second process sees the same "now". */
  async persistClock(): Promise<void> {
    await this.states.updateOne(
      { _id: SIM_STATE_ID },
      {
        $set: { clockOffsetMs: this.clock.getOffsetMs(), clockFrozen: this.clock.isFrozen() },
        $setOnInsert: { _id: SIM_STATE_ID },
      },
      { upsert: true },
    );
  }

  async chaos(): Promise<ChaosSettings> {
    const state = await this.read();
    return {
      enabled: state.chaosEnabled,
      databaseLatencyMs: state.chaosDatabaseLatencyMs,
      randomFailureRate: state.chaosRandomFailureRate,
    };
  }

  async setChaos(settings: Partial<ChaosSettings>): Promise<ChaosSettings> {
    const current = await this.chaos();
    const next = { ...current, ...settings };
    await this.states.updateOne(
      { _id: SIM_STATE_ID },
      {
        $set: {
          chaosEnabled: next.enabled,
          chaosDatabaseLatencyMs: next.databaseLatencyMs,
          chaosRandomFailureRate: next.randomFailureRate,
        },
      },
      { upsert: true },
    );
    return next;
  }

  async activeScenarioRunId(): Promise<string | null> {
    const state = await this.read();
    return state.activeScenarioRunId;
  }

  async setActiveScenarioRunId(runId: string | null): Promise<void> {
    await this.states.updateOne(
      { _id: SIM_STATE_ID },
      { $set: { activeScenarioRunId: runId } },
      { upsert: true },
    );
  }

  async seededAt(): Promise<Date | null> {
    const state = await this.read();
    return state.seededAt;
  }

  async markSeeded(): Promise<void> {
    await this.states.updateOne(
      { _id: SIM_STATE_ID },
      { $set: { seededAt: this.clock.now() } },
      { upsert: true },
    );
  }

  /** Values used when the document cannot be read at all. Never persisted. */
  private empty(): SimStateDoc {
    return {
      _id: SIM_STATE_ID,
      clockOffsetMs: 0,
      clockFrozen: false,
      railProfiles: [],
      chaosEnabled: false,
      chaosDatabaseLatencyMs: 0,
      chaosRandomFailureRate: 0,
      activeScenarioRunId: null,
      seededAt: null,
    };
  }
}
