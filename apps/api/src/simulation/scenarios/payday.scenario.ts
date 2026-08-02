import { scaleFor, type ScenarioContext, type ScenarioScript } from './scenario.types.js';
import type { ScenarioAccount } from './scenario.toolkit.js';

const EMPLOYERS = [
  'Accra Freight Ltd',
  'Volta Energy plc',
  'Kwame & Partners',
  'Northline Logistics',
  'Sable Analytics',
] as const;

const IMMEDIATE_OUTGOINGS = [
  { label: 'Rent', low: 400, high: 1_400 },
  { label: 'Utilities', low: 40, high: 180 },
  { label: 'Mobile', low: 15, high: 60 },
  { label: 'Streaming', low: 8, high: 25 },
] as const;

const ACCOUNT_KINDS = ['current'] as const;

/**
 * Payday.
 *
 * The most load-bearing day in retail banking: salaries land within minutes of each other, then
 * standing orders and direct debits fire against the same accounts in the same window. It is the
 * scenario that exposes concurrency bugs, because it is the one day the bank posts to thousands
 * of accounts at once.
 */
export const paydayScenario: ScenarioScript = {
  name: 'payday',

  definition: {
    name: 'payday',
    label: 'Payday',
    description:
      'Salary credits land across current accounts, immediately followed by the rent, utility '
      + 'and subscription payments that leave the same accounts within the hour.',
    estimatedEvents: 220,
    affects: ['accounts', 'ledger', 'transactions', 'balances'],
  },

  async execute(context: ScenarioContext): Promise<number> {
    const accounts = await context.toolkit.pickAccounts(
      ACCOUNT_KINDS,
      scaleFor(context.intensity, 60),
    );

    let events = 0;
    for (const account of accounts) {
      events += await creditSalary(account, context);
      events += await runOutgoings(account, context);
    }
    return events;
  },
};

async function creditSalary(account: ScenarioAccount, context: ScenarioContext): Promise<number> {
  const employer = context.random.pick(EMPLOYERS);
  const salary = context.toolkit.major(context.random.int(1_800, 6_500), account.currency);

  await context.toolkit.receive(account, salary, {
    type: 'transfer_in',
    description: `Salary from ${employer}`,
    narrative: `SALARY ${employer.toUpperCase()}`,
  });
  return 1;
}

/**
 * The outgoings that follow a credit within minutes. Each is skipped rather than forced when the
 * balance will not cover it, because a bank that lets a direct debit overdraw an account without
 * an arranged limit is the bug, not the demo.
 */
async function runOutgoings(account: ScenarioAccount, context: ScenarioContext): Promise<number> {
  const count = context.random.int(1, IMMEDIATE_OUTGOINGS.length);
  let events = 0;

  for (let index = 0; index < count; index += 1) {
    const outgoing = context.random.pick(IMMEDIATE_OUTGOINGS);
    const amount = context.toolkit.major(
      context.random.int(outgoing.low, outgoing.high),
      account.currency,
    );
    const posted = await context.toolkit.spend(account, amount, {
      type: 'transfer_out',
      description: `${outgoing.label} payment`,
      narrative: `DD ${outgoing.label.toUpperCase()}`,
    });
    events += posted ? 1 : 0;
  }
  return events;
}
