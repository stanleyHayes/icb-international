import { scaleFor, type ScenarioContext, type ScenarioScript } from './scenario.types.js';
import type { ScenarioAccount } from './scenario.toolkit.js';

/** Maintenance fee bands, in whole currency units, by account kind. */
const MAINTENANCE_FEE = { current: 5, savings: 0, fixed_deposit: 0 } as const;

const CORPORATE_PAYMENTS = [
  'Supplier settlement',
  'Payroll funding',
  'Quarterly tax provision',
  'Insurance premium',
] as const;

const SAVINGS_KIND = 'savings';

/**
 * Month end.
 *
 * The accounting close: maintenance fees are assessed, savings interest is paid away, and the
 * corporate payment run empties into suppliers. It is deliberately fee- and interest-heavy
 * because those are the postings that touch income and expense accounts, and therefore the ones
 * that break a trial balance when they are wrong.
 */
export const monthEndScenario: ScenarioScript = {
  name: 'month_end',

  definition: {
    name: 'month_end',
    label: 'Month end',
    description:
      'Maintenance fees are assessed on current accounts, savings interest is paid, and the '
      + 'corporate payment run settles supplier and payroll obligations.',
    estimatedEvents: 160,
    affects: ['accounts', 'ledger', 'fees', 'interest', 'statements'],
  },

  async execute(context: ScenarioContext): Promise<number> {
    const size = scaleFor(context.intensity, 45);
    const current = await context.toolkit.pickAccounts(['current'], size);
    const savings = await context.toolkit.pickAccounts([SAVINGS_KIND], size);

    let events = 0;
    events += await assessFees(current, context);
    events += await payInterest(savings, context);
    events += await corporateRun(current, context);
    return events;
  },
};

async function assessFees(
  accounts: readonly ScenarioAccount[],
  context: ScenarioContext,
): Promise<number> {
  let events = 0;
  for (const account of accounts) {
    const fee = context.toolkit.major(MAINTENANCE_FEE.current, account.currency);
    const charged = await context.toolkit.charge(account, fee, {
      type: 'fee',
      description: 'Monthly account maintenance fee',
      narrative: 'FEE MAINTENANCE',
    });
    events += charged ? 1 : 0;
  }
  return events;
}

/**
 * Interest paid away on savings balances. Modest amounts on purpose: the point is that interest
 * expense lands on GL 5000 and the customer's liability grows by exactly the same figure.
 */
async function payInterest(
  accounts: readonly ScenarioAccount[],
  context: ScenarioContext,
): Promise<number> {
  let events = 0;
  for (const account of accounts) {
    const balance = await context.toolkit.availableBalance(account);
    if (balance.minorUnits <= 0) {
      continue;
    }
    // A month of a nominal 2.4% annual rate, in whole minor units.
    const interest = Math.floor(balance.minorUnits * 0.002);
    if (interest <= 0) {
      continue;
    }
    await context.toolkit.payInterest(
      account,
      context.toolkit.minor(interest, account.currency),
      { type: 'interest', description: 'Savings interest', narrative: 'INTEREST CREDIT' },
    );
    events += 1;
  }
  return events;
}

async function corporateRun(
  accounts: readonly ScenarioAccount[],
  context: ScenarioContext,
): Promise<number> {
  let events = 0;
  for (const account of accounts.slice(0, Math.ceil(accounts.length / 3))) {
    const amount = context.toolkit.major(context.random.int(250, 4_000), account.currency);
    const posted = await context.toolkit.spend(account, amount, {
      type: 'transfer_out',
      description: context.random.pick(CORPORATE_PAYMENTS),
      narrative: 'MONTH END RUN',
    });
    events += posted ? 1 : 0;
  }
  return events;
}
