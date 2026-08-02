import type { Scenario, ScenarioName } from '@icb/contracts';

import { NotFoundError } from '../../common/errors/index.js';
import { disputeWaveScenario } from './dispute-wave.scenario.js';
import { dormantReactivationScenario } from './dormant-reactivation.scenario.js';
import { fraudBurstScenario } from './fraud-burst.scenario.js';
import { highLoadScenario } from './high-load.scenario.js';
import { marketVolatilityScenario } from './market-volatility.scenario.js';
import { monthEndScenario } from './month-end.scenario.js';
import { paydayScenario } from './payday.scenario.js';
import { railOutageScenario } from './rail-outage.scenario.js';
import type { ScenarioScript } from './scenario.types.js';

/**
 * The scenario catalogue.
 *
 * Typed as a total map over `ScenarioName`, so adding a name to the contract without writing the
 * script it promises is a compile error rather than a 404 discovered during a demo.
 */
const SCRIPTS: Readonly<Record<ScenarioName, ScenarioScript>> = {
  payday: paydayScenario,
  month_end: monthEndScenario,
  fraud_burst: fraudBurstScenario,
  dispute_wave: disputeWaveScenario,
  market_volatility: marketVolatilityScenario,
  rail_outage: railOutageScenario,
  high_load: highLoadScenario,
  dormant_reactivation: dormantReactivationScenario,
};

export function scriptFor(name: ScenarioName): ScenarioScript {
  const script = SCRIPTS[name];
  if (!script) {
    throw new NotFoundError('Scenario', name);
  }
  return script;
}

/** Everything an operator can run, in the order the console lists it. */
export function scenarioCatalogue(): Scenario[] {
  return Object.values(SCRIPTS).map((script) => script.definition);
}
