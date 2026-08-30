import { Card, CardBody, CardHeader } from '@icb/ui';
import type { Metadata } from 'next';
import Link from 'next/link';

import { CreateStaffForm } from '@/features/staff/create-staff-form';

export const metadata: Metadata = { title: 'New staff member' };

export default function NewStaffPage() {
  return (
    <>
      <header>
        <p className="text-sm text-[var(--icb-text-subtle)]">
          <Link href="/staff" className="hover:underline">
            Staff
          </Link>
          {' / '}
          New
        </p>
        <h1 className="mt-1 font-display text-3xl font-bold tracking-[-0.02em]">
          New staff member
        </h1>
        <p className="mt-1.5 max-w-prose text-sm text-[var(--icb-text-muted)]">
          The account is created active. Access is granted by the roles you assign here.
        </p>
      </header>

      <Card className="mt-6 max-w-2xl">
        <CardHeader title="Account" description="Access is granted by role, never per person." />
        <CardBody>
          <CreateStaffForm />
        </CardBody>
      </Card>
    </>
  );
}
