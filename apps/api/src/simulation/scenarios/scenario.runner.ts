import type { ScenarioName, ScenarioRun } from '@icb/contracts';
import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { ConflictError, NotFoundError } from '../../common/errors/index.js';
import { newId } from '../../infrastructure/database/identifier.js';
import { toScenarioRun } from '../../modules/simulation/infrastructure/simulation.mapper.js';
import { ScenarioRunDoc } from '../../modules/simulation/infrastructure/simulation.schemas.js';
import { SimulationStateService } from '../../modules/simulation/simulation-state.service.js';
import { ClockService } from '../clock/clock.service.js';
import { createHelpers } from '../seed/random.js';
import { scriptFor } from './scenario.catalogue.js';
import { ScenarioToolkit } from './scenario.toolkit.js';
import type { ScenarioIntensity } from './scenario.types.js';

export interface RunScenarioCommand {
  readonly name: ScenarioName;
  readonly seed?: string;
  readonly intensity: ScenarioIntensity;
}

/**
 * Runs a scenario to completion.
 *
 * Synchronously, on purpose. A scenario is an operator pulling a lever and watching what happens;
 * returning a "started" handle and finishing in the background would mean the console shows a
 * half-built world, and a failure halfway through would surface as a log line nobody reads. The
 * run record exists anyway, so progress is still queryable after the fact.
 */
@Injectable()
export class ScenarioRunner {
  private readonly logger = new Logger(ScenarioRunner.name);

  constructor(
    @InjectModel(ScenarioRunDoc.name) private readonly runs: Model<ScenarioRunDoc>,
    private readonly toolkit: ScenarioToolkit,
    private readonly state: SimulationStateService,
    private readonly clock: ClockService,
  ) {}

  async run(command: RunScenarioCommand): Promise<ScenarioRun> {
    await this.assertNoActiveRun();

    const script = scriptFor(command.name);
    // Without an explicit seed, the business date makes a same-day rerun reproduce exactly.
    const seed = command.seed ?? `${command.name}-${this.clock.today()}`;
    const runId = newId();

    await this.open(runId, command, seed);

    try {
      const events = await script.execute({
        random: createHelpers(seed),
        intensity: command.intensity,
        toolkit: this.toolkit,
        runId,
      });
      return await this.close(runId, events);
    } catch (error) {
      return await this.fail(runId, error);
    } finally {
      await this.state.setActiveScenarioRunId(null);
    }
  }

  /** One at a time: two scenarios writing to the same accounts would not be replayable. */
  private async assertNoActiveRun(): Promise<void> {
    const activeId = await this.state.activeScenarioRunId();
    if (!activeId) {
      return;
    }
    const active = await this.runs.findById(activeId).lean();
    if (active && active.status === 'running') {
      throw new ConflictError('A scenario is already running', { runId: activeId });
    }
    await this.state.setActiveScenarioRunId(null);
  }

  private async open(runId: string, command: RunScenarioCommand, seed: string): Promise<void> {
    await this.runs.create([
      {
        _id: runId,
        name: command.name,
        seed,
        intensity: command.intensity,
        status: 'running',
        eventsGenerated: 0,
        startedAt: this.clock.now(),
        completedAt: null,
        error: null,
      },
    ]);
    await this.state.setActiveScenarioRunId(runId);
    this.logger.log({ runId, name: command.name, seed }, 'Scenario started');
  }

  private async close(runId: string, events: number): Promise<ScenarioRun> {
    await this.runs.updateOne(
      { _id: runId },
      {
        $set: {
          status: 'completed',
          eventsGenerated: events,
          completedAt: this.clock.now(),
        },
      },
    );
    this.logger.log({ runId, events }, 'Scenario completed');
    return this.get(runId);
  }

  /**
   * A failed scenario is recorded, not swallowed. The events it managed to post are real and
   * already in the ledger; pretending the run never happened would leave them unexplained.
   */
  private async fail(runId: string, error: unknown): Promise<ScenarioRun> {
    const message = error instanceof Error ? error.message : String(error);
    await this.runs.updateOne(
      { _id: runId },
      { $set: { status: 'failed', completedAt: this.clock.now(), error: message } },
    );
    this.logger.error({ runId, error: message }, 'Scenario failed');
    return this.get(runId);
  }

  async get(runId: string): Promise<ScenarioRun> {
    const run = await this.runs.findById(runId).lean();
    if (!run) {
      throw new NotFoundError('Scenario run', runId);
    }
    return toScenarioRun(run);
  }

  /** The run currently in flight, or the most recent one, for the control screen. */
  async latest(): Promise<ScenarioRun | null> {
    const run = await this.runs.findOne().sort({ startedAt: -1, _id: -1 }).lean();
    return run ? toScenarioRun(run) : null;
  }
}
