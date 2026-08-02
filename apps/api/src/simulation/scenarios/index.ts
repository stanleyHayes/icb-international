import type { Provider } from '@nestjs/common';

import { ScenarioRunner } from './scenario.runner.js';
import { ScenarioToolkit } from './scenario.toolkit.js';

export { scenarioCatalogue, scriptFor } from './scenario.catalogue.js';
export { ScenarioRunner, type RunScenarioCommand } from './scenario.runner.js';
export { ScenarioToolkit, type ScenarioAccount } from './scenario.toolkit.js';
export type { ScenarioContext, ScenarioIntensity, ScenarioScript } from './scenario.types.js';

/** Everything the scenario engine contributes to the simulation module. */
export const SCENARIO_PROVIDERS: Provider[] = [ScenarioToolkit, ScenarioRunner];
