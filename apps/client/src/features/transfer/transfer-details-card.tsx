import type { TransferDetail } from '@icb/contracts';
import { Amount, Card, CardBody, CardHeader, DefinitionList, formatDate, formatTime } from '@icb/ui';

import { CancelTransferButton } from './cancel-transfer-button';
import { frequencyLabel, railInfo } from './transfer.constants';

/** The read-only terms of an executed or pending instruction, plus its fee lines. */
export function TransferDetailsCard({ transfer }: Readonly<{ transfer: TransferDetail }>) {
  const rail = railInfo(transfer.rail);
  return (
    <Card>
      <CardHeader title="Details" />
      <CardBody className="pt-0">
        <DefinitionList
          items={[
            { id: 'rail', term: 'Rail', description: `${rail.title} · ${rail.eta}` },
            { id: 'from', term: 'From', description: transfer.fromAccountLabel },
            {
              id: 'created',
              term: 'Instructed',
              description: `${formatDate(transfer.createdAt, 'medium')} · ${formatTime(transfer.createdAt)}`,
            },
            {
              id: 'execute',
              term: transfer.status === 'scheduled' ? 'Runs' : 'Executed',
              description: formatDate(transfer.executeAt, 'medium'),
            },
            {
              id: 'eta',
              term: 'Arrives by',
              description: `${formatDate(transfer.estimatedArrival, 'medium')} · ${formatTime(transfer.estimatedArrival)}`,
            },
            ...(transfer.completedAt
              ? [
                  {
                    id: 'done',
                    term: 'Completed',
                    description: `${formatDate(transfer.completedAt, 'medium')} · ${formatTime(transfer.completedAt)}`,
                  },
                ]
              : []),
            ...transfer.fees.map((fee) => ({
              id: fee.code,
              term: fee.label,
              description: <Amount value={fee.amount} size="sm" />,
            })),
            {
              id: 'total-fees',
              term: 'Total fees',
              description: <Amount value={transfer.totalFees} size="sm" />,
            },
            { id: 'total', term: 'Total debited', description: <Amount value={transfer.debitAmount} /> },
            ...(transfer.fx
              ? [
                  {
                    id: 'fx',
                    term: 'Exchange rate',
                    description: `1 ${transfer.fx.fromAmount.currency} = ${transfer.fx.rate} ${transfer.fx.toAmount.currency}`,
                  },
                  {
                    id: 'credited',
                    term: 'Recipient received',
                    description: <Amount value={transfer.creditAmount} direction="credit" />,
                  },
                ]
              : []),
            ...(transfer.schedule?.rrule
              ? [{ id: 'repeat', term: 'Repeats', description: frequencyLabel(transfer.schedule.rrule) }]
              : []),
            ...(transfer.nextOccurrenceAt
              ? [
                  {
                    id: 'next',
                    term: 'Next run',
                    description: formatDate(transfer.nextOccurrenceAt, 'medium'),
                  },
                ]
              : []),
            ...(transfer.note ? [{ id: 'note', term: 'Note', description: transfer.note }] : []),
          ]}
        />
      </CardBody>
    </Card>
  );
}

/** The cancel affordance, rendered only while the API says the instruction is cancellable. */
export function TransferCancelCard({ transfer }: Readonly<{ transfer: TransferDetail }>) {
  if (!transfer.cancellable) {
    return null;
  }
  return (
    <Card>
      <CardBody>
        <p className="text-sm text-[var(--icb-text-muted)]">
          This transfer has not executed yet and can still be withdrawn.
        </p>
        <div className="mt-4">
          <CancelTransferButton transferId={transfer.id} />
        </div>
      </CardBody>
    </Card>
  );
}
