import { Card, CardBody } from '@icb/ui';
import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { BeneficiaryForm } from '@/features/beneficiaries/beneficiary-form';

export const metadata: Metadata = { title: 'Add payee' };

/** Add a saved payee; they enter cooling-off immediately and can be verified from their page. */
export default function NewBeneficiaryPage() {
  return (
    <>
      <Link
        href="/beneficiaries"
        className="inline-flex items-center gap-1.5 text-sm text-[var(--icb-text-muted)] transition-colors hover:text-[var(--icb-text)]"
      >
        <ArrowLeft size={15} />
        Payees
      </Link>

      <header className="mt-4">
        <h1 className="font-display text-3xl font-bold tracking-[-0.02em]">Add a payee</h1>
        <p className="mt-1.5 text-sm text-[var(--icb-text-muted)]">
          Save their details once, pay them in a couple of taps afterwards.
        </p>
      </header>

      <Card className="mt-8 max-w-2xl">
        <CardBody>
          <BeneficiaryForm />
        </CardBody>
      </Card>
    </>
  );
}
