import { scaleFor, type ScenarioContext, type ScenarioScript } from './scenario.types.js';
import type { ScenarioAccount } from './scenario.toolkit.js';

const NARRATIVES = [
  'Split bill',
  'Rent share',
  'Group gift',
  'Lunch',
  'Taxi share',
] as const;

/**
 * High load.
 *
 * Thousands of small on-us transfers between the same population of accounts, which is the
 * pattern that actually breaks banks: not volume, but *contention* — many postings racing for the
 * same balance rows. Every transfer here goes through the same ledger path production uses, so
 * the retry-on-write-conflict behaviour is exercised for real rather than asserted in a unit test.
 */
export const highLoadScenario: ScenarioScript = {
  name: 'high_load',

  definition: {
    name: 'high_load',
    label: 'High load',
    description:
      'A sustained burst of small on-us transfers between a fixed population of accounts, '
      + 'deliberately contending for the same balance rows.',
    estimatedEvents: 600,
    affects: ['transfers', 'ledger', 'balances'],
  },

  async execute(context: ScenarioContext): Promise<number> {
    const accounts = await context.toolkit.pickAccounts(
      ['current', 'savings'],
      scaleFor(context.intensity, 40),
    );

    if (accounts.length < 2) {
      return 0;
    }

    const transfers = scaleFor(context.intensity, 250);
    let events = 0;

    for (let index = 0; index < transfers; index += 1) {
      events += await moveOnce(accounts, context);
    }
    return events;
  },
};

/** One transfer between two distinct accounts sharing a currency. */
async function moveOnce(
  accounts: readonly ScenarioAccount[],
  context: ScenarioContext,
): Promise<number> {
  const from = context.random.pick(accounts);
  const to = context.random.pick(accounts);

  if (from.id === to.id || from.currency !== to.currency) {
    return 0;
  }

  const amount = context.toolkit.major(context.random.int(1, 120), from.currency);
  const posted = await context.toolkit.internalTransfer(from, to, amount, {
    type: 'transfer_out',
    description: context.random.pick(NARRATIVES),
    narrative: 'ON-US TRANSFER',
  });
  return posted ? 1 : 0;
}
