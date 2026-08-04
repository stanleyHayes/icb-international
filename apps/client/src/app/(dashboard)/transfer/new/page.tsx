import type {
  AccountSummary,
  Beneficiary,
  CursorPage,
  TransferRail,
  TransferTemplate,
} from '@icb/contracts';
import { Card, CardBody } from '@icb/ui';
import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { railInfo } from '@/features/transfer/transfer.constants';
import { TransferWizard } from '@/features/transfer/wizard/transfer-wizard';
import { api } from '@/lib/api';

export const metadata: Metadata = { title: 'New transfer' };

const VALID_RAILS = new Set(['internal', 'on_us', 'ach', 'wire', 'swift']);

interface NewTransferParams {
  rail?: string;
  from?: string;
  templateId?: string;
  payee?: string;
}

function resolveRail(value: string | undefined): TransferRail {
  return (value && VALID_RAILS.has(value) ? value : 'internal') as TransferRail;
}

/** A template's rail is implied by its destination kind. */
function templateRail(template: TransferTemplate): TransferRail | null {
  switch (template.destination.kind) {
    case 'own_account':
      return 'internal';
    case 'icb_customer':
      return 'on_us';
    case 'domestic_bank':
      return 'ach';
    case 'international':
      return 'swift';
    case 'beneficiary':
      return null;
  }
}

async function loadTemplate(templateId: string | undefined): Promise<TransferTemplate | null> {
  if (!templateId) {
    return null;
  }
  const templates = await api<TransferTemplate[]>('/transfer-templates', {
    tags: ['transfer-templates'],
  });
  return templates.find((template) => template.id === templateId) ?? null;
}

/** The priced transfer flow: details → quote → confirm → receipt, on the chosen rail. */
export default async function NewTransferPage({
  searchParams,
}: Readonly<{ searchParams: Promise<NewTransferParams> }>) {
  const params = await searchParams;

  const [accountsPage, beneficiariesPage, template] = await Promise.all([
    api<CursorPage<AccountSummary>>('/accounts?limit=50', { tags: ['accounts'] }),
    api<CursorPage<Beneficiary>>('/beneficiaries?limit=100', { tags: ['beneficiaries'] }),
    loadTemplate(params.templateId),
  ]);

  const rail = (template ? templateRail(template) : null) ?? resolveRail(params.rail);
  const railMeta = railInfo(rail);

  return (
    <>
      <Link
        href="/transfer"
        className="inline-flex items-center gap-1.5 text-sm text-[var(--icb-text-muted)] transition-colors hover:text-[var(--icb-text)]"
      >
        <ArrowLeft size={15} />
        Move money
      </Link>

      <header className="mt-4">
        <h1 className="font-display text-3xl font-bold tracking-[-0.02em]">{railMeta.title}</h1>
        <p className="mt-1.5 text-sm text-[var(--icb-text-muted)]">
          {railMeta.description} You will review the exact cost before confirming.
        </p>
      </header>

      <Card className="mt-8 max-w-2xl">
        <CardBody>
          <TransferWizard
            accounts={accountsPage.items}
            beneficiaries={beneficiariesPage.items}
            initialRail={rail}
            initialFrom={params.from ?? template?.fromAccountId ?? ''}
            {...(params.payee ? { initialPayee: params.payee } : {})}
            template={template}
          />
        </CardBody>
      </Card>
    </>
  );
}
