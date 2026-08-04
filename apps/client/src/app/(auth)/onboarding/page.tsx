import type { KycCase, Product } from '@icb/contracts';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { AccountForm } from '@/features/auth/account-form';
import { DocumentUpload } from '@/features/auth/document-upload';
import { IdentityDocumentUpload } from '@/features/auth/identity-document-upload';
import { IdentityForm } from '@/features/auth/identity-form';
import { LivenessForm } from '@/features/auth/liveness-form';
import { OnboardingTour } from '@/features/auth/onboarding-tour';
import { api, ApiError } from '@/lib/api';
import { readSession } from '@/lib/session';

export const metadata: Metadata = { title: 'Account setup' };

const STEPS = ['identity', 'documents', 'liveness', 'account', 'done'] as const;
type Step = (typeof STEPS)[number];

const STEP_COPY: Record<Step, { title: string; subtitle: string }> = {
  identity: {
    title: 'Tell us about yourself',
    subtitle:
      'A verification analyst reads these details beside your documents, so accuracy now means no follow-up later.',
  },
  documents: {
    title: 'Your documents',
    subtitle: 'One government-issued identity document and something that proves your address.',
  },
  liveness: {
    title: 'A quick face check',
    subtitle: 'A selfie proves the person opening this account is the person in the documents.',
  },
  account: {
    title: 'Open your first account',
    subtitle:
      'Verification runs in the background — your account works now, with limits that lift when it clears.',
  },
  done: {
    title: 'You’re all set',
    subtitle: 'Your account is open. Here are the four places worth knowing first.',
  },
};

/** Onboarding wizard: one screen per step, the step carried in the URL so refresh is safe. */
export default async function OnboardingPage({
  searchParams,
}: Readonly<{ searchParams: Promise<{ step?: string }> }>) {
  const { step: raw } = await searchParams;
  const step: Step = STEPS.includes(raw as Step) ? (raw as Step) : 'identity';
  const copy = STEP_COPY[step];

  return (
    <>
      <StepIndicator current={step} />
      <header className="mt-8">
        <h1 className="font-display text-3xl font-bold tracking-[-0.02em]">{copy.title}</h1>
        <p className="mt-1.5 text-sm text-[var(--icb-text-muted)]">{copy.subtitle}</p>
      </header>
      <div className="mt-8">
        <StepBody step={step} />
      </div>
    </>
  );
}

async function StepBody({ step }: Readonly<{ step: Step }>): Promise<ReactNode> {
  if (step === 'identity') {
    const session = await readSession();
    return (
      <IdentityForm
        firstName={session?.user.firstName ?? ''}
        lastName={session?.user.lastName ?? ''}
      />
    );
  }
  if (step === 'documents') {
    return <DocumentsStep kycCase={await loadCase()} />;
  }
  if (step === 'liveness') {
    return <LivenessStep kycCase={await loadCase()} />;
  }
  if (step === 'account') {
    return <AccountForm products={await loadProducts()} />;
  }
  return <OnboardingTour />;
}

function DocumentsStep({ kycCase }: Readonly<{ kycCase: KycCase | null }>) {
  return (
    <div className="space-y-6">
      <IdentityDocumentUpload documents={kycCase?.documents ?? []} />
      <DocumentUpload
        documentType="proof_of_address"
        label="Proof of address"
        description="A bank statement or utility bill from the last three months, showing your name and address."
        existing={
          kycCase?.documents.find((document) => document.type === 'proof_of_address') ?? null
        }
      />
      <a
        href="/onboarding?step=liveness"
        className="inline-flex h-11 items-center rounded-[var(--radius-md)] bg-[var(--icb-primary)] px-5 text-sm font-medium text-white shadow-[var(--shadow-xs)] transition-colors hover:bg-[var(--icb-primary-hover)]"
      >
        Continue to face check
      </a>
    </div>
  );
}

function LivenessStep({ kycCase }: Readonly<{ kycCase: KycCase | null }>) {
  return (
    <LivenessForm
      selfie={kycCase?.documents.find((document) => document.type === 'selfie') ?? null}
      documentsReady={hasRequiredDocuments(kycCase)}
    />
  );
}

async function loadCase(): Promise<KycCase | null> {
  try {
    return await api<KycCase>('/kyc/case');
  } catch (error) {
    if (error instanceof ApiError) {
      return null;
    }
    throw error;
  }
}

async function loadProducts(): Promise<Product[]> {
  const all = await api<Product[]>('/products');
  return all.filter((product) => product.kind === 'current' || product.kind === 'savings');
}

function hasRequiredDocuments(kycCase: KycCase | null): boolean {
  const types = new Set(kycCase?.documents.map((document) => document.type) ?? []);
  const hasIdentity =
    types.has('passport') || types.has('national_id') || types.has('drivers_licence');
  return hasIdentity && types.has('proof_of_address');
}

function StepIndicator({ current }: Readonly<{ current: Step }>) {
  const currentIndex = STEPS.indexOf(current);
  return (
    <nav aria-label="Setup progress">
      <ol className="flex items-center gap-2">
        {STEPS.map((step, index) => (
          <li
            key={step}
            aria-current={step === current ? 'step' : undefined}
            className="flex items-center gap-2"
          >
            <span
              className={`h-1.5 w-10 rounded-full ${
                index <= currentIndex ? 'bg-[var(--icb-primary)]' : 'bg-[var(--icb-border)]'
              }`}
            />
            <span className="sr-only">{stepLabel(step, index, currentIndex)}</span>
          </li>
        ))}
      </ol>
    </nav>
  );
}

function stepLabel(step: Step, index: number, currentIndex: number): string {
  if (index < currentIndex) {
    return `${step} (done)`;
  }
  return index === currentIndex ? `${step} (current)` : step;
}
