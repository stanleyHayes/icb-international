import { scaleFor, type ScenarioContext, type ScenarioScript } from './scenario.types.js';
import type { ScenarioAccount } from './scenario.toolkit.js';

const DORMANT = 'dormant';

const REACTIVATION_SOURCES = [
  'Inbound salary',
  'Transfer from linked account',
  'Branch cash deposit',
  'Cheque deposit',
] as const;

/**
 * Dormant reactivation.
 *
 * A dormant account is not a dead account: the money is still the customer's, and the moment they
 * touch it the bank must bring it back to life, unfreeze the balance, and treat the reactivation
 * as a risk event rather than a routine credit. Long-inactive accounts coming alive is a classic
 * mule pattern, which is why this scenario exists next to the fraud ones.
 */
export const dormantReactivationScenario: ScenarioScript = {
  name: 'dormant_reactivation',

  definition: {
    name: 'dormant_reactivation',
    label: 'Dormant reactivation',
    description:
      'Long-inactive accounts are reactivated by an inbound credit, returned to active status, '
      + 'and put back into normal use.',
    estimatedEvents: 30,
    affects: ['accounts', 'ledger', 'risk', 'kyc'],
  },

  async execute(context: ScenarioContext): Promise<number> {
    const dormant = await context.toolkit.pickAccounts(
      ['current', 'savings'],
      scaleFor(context.intensity, 12),
      DORMANT,
    );

    let events = 0;
    for (const account of dormant) {
      events += await reactivate(account, context);
    }
    return events;
  },
};

/**
 * Status first, then the credit.
 *
 * The order matters: crediting a dormant account and reactivating it afterwards leaves a window
 * where the balance is spendable but the account is not, and every such window eventually becomes
 * a support ticket.
 */
async function reactivate(account: ScenarioAccount, context: ScenarioContext): Promise<number> {
  await context.toolkit.reactivate(account);

  const source = context.random.pick(REACTIVATION_SOURCES);
  const amount = context.toolkit.major(context.random.int(75, 2_600), account.currency);

  await context.toolkit.receive({ ...account, status: 'active' }, amount, {
    type: 'deposit',
    description: `Reactivation credit — ${source}`,
    narrative: 'ACCOUNT REACTIVATED',
  });

  // Two events: the status change and the credit that caused it.
  return 2;
}
