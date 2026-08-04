import type { AccountDetail } from '@icb/contracts';
import {
  Amount,
  Card,
  CardBody,
  CardHeader,
  DefinitionList,
  formatDate,
} from '@icb/ui';

/** The read side of the account console: what the account holds and what it is. */
export function OverviewCards({ account }: Readonly<{ account: AccountDetail }>) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader
          title="Balances"
          description={`As of ${formatDate(account.balances.asOf, 'long')}`}
        />
        <CardBody className="pt-0">
          <DefinitionList
            items={[
              {
                id: 'ledger',
                term: 'Ledger balance',
                description: <Amount value={account.balances.ledger} />,
              },
              {
                id: 'holds',
                term: 'Holds',
                description: <Amount value={account.balances.holds} />,
              },
              {
                id: 'available',
                term: 'Available',
                description: <Amount value={account.balances.available} />,
              },
              {
                id: 'overdraft',
                term: 'Overdraft limit',
                description: <Amount value={account.balances.overdraftLimit} />,
              },
            ]}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Account details" />
        <CardBody className="pt-0">
          <DefinitionList
            items={[
              {
                id: 'number',
                term: 'Account number',
                description: <span className="font-mono text-xs">{account.identifiers.number}</span>,
              },
              {
                id: 'iban',
                term: 'IBAN',
                description: <span className="font-mono text-xs">{account.identifiers.iban}</span>,
              },
              {
                id: 'sort',
                term: 'Sort code',
                description: (
                  <span className="font-mono text-xs">{account.identifiers.sortCode}</span>
                ),
              },
              {
                id: 'opened',
                term: 'Opened',
                description: formatDate(account.openedAt, 'long'),
              },
              {
                id: 'rate',
                term: 'Interest rate',
                description:
                  account.interestRate === null
                    ? 'Product rate'
                    : `${account.interestRate}% (override)`,
              },
            ]}
          />
        </CardBody>
      </Card>
    </div>
  );
}
