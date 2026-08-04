import type { CustomerProfile } from '@icb/contracts';
import { Card, CardBody, CardHeader } from '@icb/ui';
import type { Metadata } from 'next';

import { AddressForm } from '@/features/settings/address-form';
import { MarketingForm } from '@/features/settings/marketing-form';
import { PersonalDetailsForm } from '@/features/settings/personal-details-form';
import { api } from '@/lib/api';

export const metadata: Metadata = { title: 'Profile' };

/**
 * Profile editing. Identity facts set at onboarding (date of birth, nationality) are shown
 * read-only — they change through verification, not through a text field.
 */
export default async function ProfilePage() {
  const profile = await api<CustomerProfile>('/customers/me', { tags: ['profile'] });
  const individual = profile.individual;

  return (
    <>
      <header>
        <h1 className="font-display text-3xl font-bold tracking-[-0.02em]">Profile</h1>
        <p className="mt-1.5 text-sm text-[var(--icb-text-muted)]">
          Who you are and where statements and letters reach you.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        {individual ? (
          <Card>
            <CardHeader
              title="Personal details"
              description={`Date of birth ${individual.dateOfBirth} and nationality ${individual.nationality} are fixed at verification.`}
            />
            <CardBody className="pt-0">
              <PersonalDetailsForm
                initial={{
                  firstName: individual.firstName,
                  middleName: individual.middleName,
                  lastName: individual.lastName,
                  occupation: individual.occupation,
                  employer: individual.employer,
                  annualIncomeBand: individual.annualIncomeBand,
                  phone: profile.phone,
                }}
              />
            </CardBody>
          </Card>
        ) : (
          <Card>
            <CardHeader title="Business details" />
            <CardBody className="pt-0">
              <dl className="space-y-3 text-sm">
                <Row label="Legal name" value={profile.business?.legalName ?? '—'} />
                <Row label="Trading name" value={profile.business?.tradingName ?? '—'} />
                <Row label="Registration" value={profile.business?.registrationNumber ?? '—'} />
                <Row label="Phone" value={profile.phone} />
              </dl>
              <p className="mt-4 text-xs text-[var(--icb-text-subtle)]">
                Registered business details change through your relationship team — message us
                from Support and we will take care of it.
              </p>
            </CardBody>
          </Card>
        )}

        <div className="space-y-6">
          <Card>
            <CardHeader title="Residential address" />
            <CardBody className="pt-0">
              <AddressForm kind="residential" address={profile.residentialAddress} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Postal address"
              description="Only if it differs from where you live."
            />
            <CardBody className="pt-0">
              <AddressForm kind="postal" address={profile.postalAddress} removable />
            </CardBody>
          </Card>
        </div>
      </div>

      <Card className="mt-6">
        <CardHeader
          title="Marketing"
          description="Optional, and it stays optional — you can change your mind as often as you like."
        />
        <CardBody className="pt-0">
          <MarketingForm
            initial={{
              marketingEmail: profile.preferences.marketingEmail,
              marketingSms: profile.preferences.marketingSms,
            }}
          />
        </CardBody>
      </Card>
    </>
  );
}

function Row({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-[var(--icb-border)] pb-3 last:border-0 last:pb-0">
      <dt className="shrink-0 text-[var(--icb-text-subtle)]">{label}</dt>
      <dd className="text-right">{value}</dd>
    </div>
  );
}
