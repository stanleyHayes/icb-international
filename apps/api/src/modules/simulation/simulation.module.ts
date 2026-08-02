import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { EndOfDayService } from '../../simulation/eod/end-of-day.service.js';
import { EOD_PROVIDERS } from '../../simulation/eod/index.js';
import {
  EodReportDoc,
  EodReportSchema,
  FeeChargeDoc,
  FeeChargeSchema,
  InterestAccrualDoc,
  InterestAccrualSchema,
} from '../../simulation/eod/infrastructure/eod.schemas.js';
import { RAIL_PROVIDERS } from '../../simulation/rails/index.js';
import { RailRegistry } from '../../simulation/rails/rail.registry.js';
import { SCENARIO_PROVIDERS } from '../../simulation/scenarios/index.js';
import { ScenarioRunner } from '../../simulation/scenarios/scenario.runner.js';
import { AccountsModule } from '../accounts/accounts.module.js';
import { LedgerModule } from '../ledger/ledger.module.js';
import { TransferDoc, TransferSchema } from '../transfers/infrastructure/transfer.schemas.js';
import { ClockControlService } from './clock-control.service.js';
import { FeatureFlagsService } from './feature-flags.service.js';
import {
  ScenarioRunDoc,
  ScenarioRunSchema,
  SimFeatureFlagDoc,
  SimFeatureFlagSchema,
  SimStateDoc,
  SimStateSchema,
} from './infrastructure/simulation.schemas.js';
import { SimulationClockController } from './simulation-clock.controller.js';
import { SimulationEodController } from './simulation-eod.controller.js';
import { SimulationFlagsController } from './simulation-flags.controller.js';
import { SimulationRailsController } from './simulation-rails.controller.js';
import { SimulationScenariosController } from './simulation-scenarios.controller.js';
import { SimulationStateService } from './simulation-state.service.js';
import { SimulationController } from './simulation.controller.js';
import { SimulationService } from './simulation.service.js';

/**
 * The simulation engine.
 *
 * Rails, scenarios and the end-of-day batch live in `src/simulation/**` because they are not a
 * banking domain — they are the machinery that makes the banking domains observable. They are
 * wired here, in one module, so that a rail can read its profile from `sim_state` and the batch
 * can settle a transfer without either of them importing the other's Nest module and creating a
 * cycle.
 *
 * `TransferDoc` is registered with the schema object the transfers module already registered.
 * Mongoose returns the existing compiled model for an identical schema, so this shares the model
 * rather than defining a second one over the same collection.
 */
@Module({
  imports: [
    LedgerModule,
    AccountsModule,
    MongooseModule.forFeature([
      { name: SimStateDoc.name, schema: SimStateSchema },
      { name: ScenarioRunDoc.name, schema: ScenarioRunSchema },
      { name: SimFeatureFlagDoc.name, schema: SimFeatureFlagSchema },
      { name: InterestAccrualDoc.name, schema: InterestAccrualSchema },
      { name: FeeChargeDoc.name, schema: FeeChargeSchema },
      { name: EodReportDoc.name, schema: EodReportSchema },
      { name: TransferDoc.name, schema: TransferSchema },
    ]),
  ],
  controllers: [
    SimulationController,
    SimulationClockController,
    SimulationRailsController,
    SimulationScenariosController,
    SimulationEodController,
    SimulationFlagsController,
  ],
  providers: [
    SimulationStateService,
    ClockControlService,
    FeatureFlagsService,
    SimulationService,
    ...RAIL_PROVIDERS,
    ...SCENARIO_PROVIDERS,
    ...EOD_PROVIDERS,
  ],
  exports: [
    SimulationStateService,
    FeatureFlagsService,
    ClockControlService,
    RailRegistry,
    ScenarioRunner,
    EndOfDayService,
  ],
})
export class SimulationModule {}
