import type { Money } from '@icb/money';

import type { RailSubmission } from '../rails/rail.types.js';
import type { ScenarioAccount } from './scenario.toolkit.js';
import { scaleFor, type ScenarioContext, type ScenarioScript } from './scenario.types.js';

/** Merchants a compromised card is tested against: high value, easily resold, card-not-present. */
const SUSPECT_MERCHANTS = [
  { name: 'GLOBAL ELECTRONICS DL', mcc: '5732' },
  { name: 'LUXE WATCH EXCHANGE', mcc: '5944' },
  { name: 'PREPAID TOPUP HUB', mcc: '6540' },
  { name: 'CRYPTO GATEWAY XG', mcc: '6051' },
  { name: 'DUTYFREE TERMINAL 3', mcc: '5309' },
] as const;

const CARD_RAIL = 'card';

/**
 * Fraud burst.
 *
 * A compromised card is tested with a small authorisation and then run hard: several attempts a
 * minute, at merchants the cardholder has never used, escalating in value. What makes it a useful
 * scenario is that the card network declines some of them on its own — the bank's fraud rules are
 * not the only thing standing between the customer and the loss, and the two have to agree.
 */
export const fraudBurstScenario: ScenarioScript = {
  name: 'fraud_burst',

  definition: {
    name: 'fraud_burst',
    label: 'Fraud burst',
    description:
      'A compromised card is probed with a small authorisation, then run repeatedly at unusual '
      + 'merchants. The card network declines a share of the attempts on its own.',
    estimatedEvents: 90,
    affects: ['cards', 'ledger', 'risk', 'disputes'],
  },

  async execute(context: ScenarioContext): Promise<number> {
    const accounts = await context.toolkit.pickAccounts(
      ['current'],
      scaleFor(context.intensity, 6),
    );

    let events = 0;
    for (const account of accounts) {
      events += await runBurst(account, context);
    }
    return events;
  },
};

/**
 * One card's burst: a probe of a few units, then escalating attempts. Every attempt is a real
 * authorisation through the card rail, so a decline leaves no posting — exactly as it would not.
 */
async function runBurst(account: ScenarioAccount, context: ScenarioContext): Promise<number> {
  const attempts = context.random.int(4, 12);
  let events = 0;
  let value = context.random.int(1, 4);

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const merchant = context.random.pick(SUSPECT_MERCHANTS);
    const amount = context.toolkit.major(value, account.currency);
    events += await attemptAuthorisation(account, amount, merchant, context);
    // Card testing escalates fast once a small authorisation is approved.
    value = Math.min(value * context.random.int(2, 4) + 5, 2_500);
  }
  return events;
}

async function attemptAuthorisation(
  account: ScenarioAccount,
  amount: Money,
  merchant: (typeof SUSPECT_MERCHANTS)[number],
  context: ScenarioContext,
): Promise<number> {
  const submission: RailSubmission = {
    sourceId: `${context.runId}:${account.id}`,
    amount,
    debtorAccount: account.number,
    debtorName: account.customerId,
    creditorName: merchant.name,
    creditorAccount: merchant.mcc,
    narrative: `CARD PURCHASE ${merchant.name}`,
    attributes: { mcc: merchant.mcc },
  };

  const result = await context.toolkit.rails.dispatch(CARD_RAIL, submission, {
    random: context.random,
  });

  if (!result.accepted) {
    // A decline is an event worth counting: it is what the fraud queue will be looking at.
    return 1;
  }

  const posted = await context.toolkit.spend(account, amount, {
    type: 'card_purchase',
    description: `Card purchase at ${merchant.name}`,
    narrative: `AUTH ${result.railReference}`,
  });
  return posted ? 1 : 0;
}
