import { getConnectionToken } from '@nestjs/mongoose';
import { Test, type TestingModule } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { MetricsModule } from '../../../common/observability/metrics.module.js';
import { ConfigModule } from '../../../config/config.module.js';
import { ClockModule } from '../../../simulation/clock/clock.module.js';
import { EndOfDayService } from '../../../simulation/eod/end-of-day.service.js';
import { RailRegistry } from '../../../simulation/rails/rail.registry.js';
import { scenarioCatalogue } from '../../../simulation/scenarios/scenario.catalogue.js';
import { ScenarioRunner } from '../../../simulation/scenarios/scenario.runner.js';
import { ClockControlService } from '../clock-control.service.js';
import { FeatureFlagsService } from '../feature-flags.service.js';
import { SimulationModule } from '../simulation.module.js';
import { SimulationService } from '../simulation.service.js';
import { SimulationStateService } from '../simulation-state.service.js';

/**
 * Wiring test.
 *
 * A module that type-checks can still fail to boot: a missing export, a provider nobody supplies,
 * or a cycle between two services only shows up when the container is built. This builds the real
 * container with the database connection stubbed, so the wiring is verified without needing an
 * infrastructure stack — which also means it runs in CI on every pull request.
 */
describe('SimulationModule wiring', () => {
  let moduleRef: TestingModule;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      // MetricsModule is @Global in the real graph, so AppModule importing it once makes
      // MetricsService available to every instrumented service. A partial graph gets no such
      // favour — it has to import it explicitly or the ledger cannot be constructed.
      imports: [ConfigModule, ClockModule, MetricsModule, SimulationModule],
    })
      // The container never talks to Mongo here; only the graph is under test.
      .overrideProvider(getConnectionToken())
      .useValue(stubConnection())
      .compile();
  });

  afterAll(async () => {
    await moduleRef?.close();
  });

  it('resolves every simulation service', () => {
    expect(moduleRef.get(SimulationStateService)).toBeInstanceOf(SimulationStateService);
    expect(moduleRef.get(ClockControlService)).toBeInstanceOf(ClockControlService);
    expect(moduleRef.get(FeatureFlagsService)).toBeInstanceOf(FeatureFlagsService);
    expect(moduleRef.get(SimulationService)).toBeInstanceOf(SimulationService);
    expect(moduleRef.get(ScenarioRunner)).toBeInstanceOf(ScenarioRunner);
    expect(moduleRef.get(EndOfDayService)).toBeInstanceOf(EndOfDayService);
  });

  it('registers one profile for every rail the simulator answers for', () => {
    const rails = moduleRef.get(RailRegistry);
    const keys = rails.keys();

    expect(keys).toEqual(
      expect.arrayContaining(['internal', 'on_us', 'ach', 'wire', 'swift', 'card']),
    );
    expect(rails.defaultProfiles()).toHaveLength(keys.length);
  });

  it('resolves an adapter for every rail key, aliases included', () => {
    const rails = moduleRef.get(RailRegistry);
    for (const key of rails.keys()) {
      expect(rails.adapterFor(key)).toBeDefined();
    }
  });

  it('publishes a script for all eight scenario names', () => {
    expect(scenarioCatalogue().map((scenario) => scenario.name)).toEqual([
      'payday',
      'month_end',
      'fraud_burst',
      'dispute_wave',
      'market_volatility',
      'rail_outage',
      'high_load',
      'dormant_reactivation',
    ]);
  });
});

/**
 * The narrow slice of a Mongoose connection the container touches while it is being built:
 * model registration for `forFeature`, and raw collection handles for the batch.
 */
function stubConnection() {
  const model = { modelName: 'stub' };
  return {
    models: {},
    model: () => model,
    collection: () => ({}),
    on: () => undefined,
    once: () => undefined,
    close: () => Promise.resolve(),
  };
}
