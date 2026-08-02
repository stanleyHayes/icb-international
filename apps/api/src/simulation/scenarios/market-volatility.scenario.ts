import type { CurrencyCode } from '@icb/money';

import { scaleFor, type ScenarioContext, type ScenarioScript } from './scenario.types.js';

/** The books ICB revalues. The base currency is not revalued against itself. */
const REVALUED_CURRENCIES: readonly CurrencyCode[] = ['USD', 'EUR', 'GBP'];

/**
 * Market volatility.
 *
 * Rates move, and every foreign-currency position the bank holds is worth a different amount in
 * the reporting currency than it was an hour ago. The revaluation is a real posting — FX income
 * against cash — and it is the one that proves the trial balance still holds when the movement is
 * a gain on one book and a loss on another in the same run.
 */
export const marketVolatilityScenario: ScenarioScript = {
  name: 'market_volatility',

  definition: {
    name: 'market_volatility',
    label: 'Market volatility',
    description:
      'Rates move sharply and the bank revalues its foreign-currency positions, booking the '
      + 'gains and losses to FX income against cash.',
    estimatedEvents: 45,
    affects: ['fx', 'ledger', 'treasury'],
  },

  async execute(context: ScenarioContext): Promise<number> {
    const ticks = scaleFor(context.intensity, 15);
    let events = 0;

    for (let tick = 0; tick < ticks; tick += 1) {
      events += await revalueOnce(context);
    }
    return events;
  },
};

/**
 * One revaluation tick. Direction is drawn rather than alternated: a run of losses is exactly the
 * sequence that makes a treasury desk uncomfortable, and it must be reproducible from the seed.
 */
async function revalueOnce(context: ScenarioContext): Promise<number> {
  const currency = context.random.pick(REVALUED_CURRENCIES);
  const gain = context.random.chance(0.5);
  // Movement of roughly 0.1%–2.5% on a nominal position, in whole currency units.
  const amount = context.toolkit.major(context.random.int(50, 12_000), currency);

  await context.toolkit.revalue(amount, gain, {
    type: 'fx_conversion',
    description: `${currency} position revaluation (${gain ? 'gain' : 'loss'})`,
    narrative: `FX REVAL ${currency}`,
  });
  return 1;
}
