import { scaleFor, type ScenarioContext, type ScenarioScript } from './scenario.types.js';
import type { ScenarioAccount } from './scenario.toolkit.js';

/** Chargeback reasons, in the language a scheme uses on the dispute record. */
const DISPUTE_REASONS = [
  'Transaction not recognised',
  'Goods or services not received',
  'Duplicate processing',
  'Cancelled recurring transaction',
  'Credit not processed',
] as const;

/**
 * Dispute wave.
 *
 * A merchant fails, or a subscription bills a cohort twice, and disputes arrive in a batch rather
 * than a trickle. The bank must front the money while it investigates: the customer is made whole
 * on day one and the loss sits on GL 5100 until the scheme decides. That provisional credit is the
 * posting this scenario exists to produce, because it is the one people forget to write.
 */
export const disputeWaveScenario: ScenarioScript = {
  name: 'dispute_wave',

  definition: {
    name: 'dispute_wave',
    label: 'Dispute wave',
    description:
      'A batch of chargebacks lands at once. Each disputed amount is provisionally credited to '
      + 'the customer and carried as a loss on GL 5100 until the case is resolved.',
    estimatedEvents: 60,
    affects: ['disputes', 'ledger', 'cards', 'support'],
  },

  async execute(context: ScenarioContext): Promise<number> {
    const accounts = await context.toolkit.pickAccounts(
      ['current'],
      scaleFor(context.intensity, 25),
    );

    let events = 0;
    for (const account of accounts) {
      events += await raiseDisputes(account, context);
    }
    return events;
  },
};

/** One to three disputes per affected customer, each provisionally credited immediately. */
async function raiseDisputes(
  account: ScenarioAccount,
  context: ScenarioContext,
): Promise<number> {
  const count = context.random.int(1, 3);
  let events = 0;

  for (let index = 0; index < count; index += 1) {
    const reason = context.random.pick(DISPUTE_REASONS);
    const amount = context.toolkit.major(context.random.int(12, 480), account.currency);

    await context.toolkit.provisionalCredit(account, amount, {
      type: 'adjustment',
      description: `Provisional credit — ${reason}`,
      narrative: 'DISPUTE PROVISIONAL CREDIT',
    });
    events += 1;
  }
  return events;
}
