import type { RailProfile, SimulationRail } from '@icb/contracts';

import type { RailSubmission } from '../rails/rail.types.js';
import type { ScenarioAccount } from './scenario.toolkit.js';
import { scaleFor, type ScenarioContext, type ScenarioScript } from './scenario.types.js';

/** The rails taken down. Internal book transfers keep working, as they would in a real outage. */
const AFFECTED_RAILS: readonly SimulationRail[] = ['ach', 'wire'];

/**
 * Rail outage.
 *
 * A clearing network goes dark. The bank is fine, the ledger is fine, and every outbound payment
 * on that rail fails at submission — no money moves, so no posting is written. That distinction is
 * the point: a failed instruction must leave *no* trace in the books, only in the operational
 * record, and a system that debits first and asks later is the one that loses customer money.
 *
 * The original profiles are restored when the run finishes, so a demo cannot accidentally leave
 * the bank crippled for the next person to open the console.
 */
export const railOutageScenario: ScenarioScript = {
  name: 'rail_outage',

  definition: {
    name: 'rail_outage',
    label: 'Rail outage',
    description:
      'ACH and wire stop accepting instructions. Outbound payments on those rails are rejected '
      + 'at submission and no value moves. The rails are restored when the run ends.',
    estimatedEvents: 40,
    affects: ['transfers', 'rails', 'notifications'],
  },

  async execute(context: ScenarioContext): Promise<number> {
    const accounts = await context.toolkit.pickAccounts(
      ['current'],
      scaleFor(context.intensity, 12),
    );
    const restore = await disableRails(context);

    try {
      return await attemptPayments(accounts, context);
    } finally {
      await restoreRails(restore, context);
    }
  },
};

/** Take the rails down, remembering exactly what they looked like first. */
async function disableRails(context: ScenarioContext): Promise<RailProfile[]> {
  const original: RailProfile[] = [];

  for (const rail of AFFECTED_RAILS) {
    original.push(await context.toolkit.rails.profileFor(rail));
    await context.toolkit.rails.updateProfile(rail, { enabled: false });
  }
  return original;
}

async function restoreRails(
  original: readonly RailProfile[],
  context: ScenarioContext,
): Promise<void> {
  for (const profile of original) {
    await context.toolkit.rails.updateProfile(profile.rail, {
      enabled: profile.enabled,
      failureRate: profile.failureRate,
    });
  }
}

/**
 * Every attempt is rejected by the registry before an adapter sees it, so the loop below writes
 * nothing to the ledger — which is precisely what is being demonstrated.
 */
async function attemptPayments(
  accounts: readonly ScenarioAccount[],
  context: ScenarioContext,
): Promise<number> {
  let events = 0;

  for (const account of accounts) {
    for (const rail of AFFECTED_RAILS) {
      const result = await context.toolkit.rails.dispatch(rail, buildSubmission(account, context), {
        random: context.random,
      });
      events += result.accepted ? 0 : 1;
    }
  }
  return events;
}

function buildSubmission(account: ScenarioAccount, context: ScenarioContext): RailSubmission {
  return {
    sourceId: `${context.runId}:${account.id}`,
    amount: context.toolkit.major(context.random.int(50, 3_000), account.currency),
    debtorAccount: account.number,
    debtorName: account.customerId,
    creditorName: 'External beneficiary',
    creditorAccount: `EXT${context.random.int(10_000_000, 99_999_999)}`,
    narrative: 'Outbound payment during rail outage',
  };
}
