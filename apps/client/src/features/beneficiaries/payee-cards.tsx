import type { Beneficiary } from '@icb/contracts';
import { Card, CardBody, CardHeader, DefinitionList, formatDate } from '@icb/ui';

import { DeleteBeneficiaryButton } from './delete-beneficiary-button';
import { describeDestination } from '../transfer/destination';

/** The payee's stored facts: destination, usage, favourites. */
export function PayeeDetailsCard({ payee }: Readonly<{ payee: Beneficiary }>) {
  return (
    <Card>
      <CardHeader title="Details" />
      <CardBody className="pt-0">
        <DefinitionList
          items={[
            { id: 'name', term: 'Account name', description: payee.name },
            { id: 'dest', term: 'Account', description: describeDestination(payee.destination) },
            ...(payee.bankName ? [{ id: 'bank', term: 'Bank', description: payee.bankName }] : []),
            { id: 'added', term: 'Added', description: formatDate(payee.createdAt, 'medium') },
            { id: 'uses', term: 'Times paid', description: String(payee.useCount) },
            ...(payee.lastUsedAt
              ? [{ id: 'last', term: 'Last paid', description: formatDate(payee.lastUsedAt, 'medium') }]
              : []),
            { id: 'fav', term: 'Favourite', description: payee.favourite ? 'Yes' : 'No' },
          ]}
        />
      </CardBody>
    </Card>
  );
}

/** Removal, with the reassurance that history is untouched. */
export function PayeeRemoveCard({ payee }: Readonly<{ payee: Beneficiary }>) {
  return (
    <Card>
      <CardBody>
        <p className="text-sm text-[var(--icb-text-muted)]">
          Removing a payee does not affect transfers already sent to them.
        </p>
        <div className="mt-4">
          <DeleteBeneficiaryButton beneficiaryId={payee.id} name={payee.name} />
        </div>
      </CardBody>
    </Card>
  );
}
