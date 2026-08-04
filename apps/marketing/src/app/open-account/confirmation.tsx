import { Card, CardBody } from '@icb/ui';
import { CheckCircle2, MailCheck, ScanFace, UserRound } from 'lucide-react';

const NEXT_STEPS = [
  {
    icon: MailCheck,
    title: 'Verify your email',
    detail: 'We have sent a link to your inbox. It expires in 24 hours.',
  },
  {
    icon: ScanFace,
    title: 'Confirm your identity',
    detail: 'A photo of your document and a selfie, checked within minutes in the app.',
  },
  {
    icon: UserRound,
    title: 'Your account opens',
    detail: 'Account number and IBAN the same day, virtual card immediately.',
  },
] as const;

/**
 * The confirmation panel shown after the registration is accepted.
 *
 * What it says is what the backend actually did: a customer record and credential exist, a
 * verification email has been sent, and identity verification happens after first sign-in.
 */
export function Confirmation({ signInUrl }: Readonly<{ signInUrl: string | null }>) {
  return (
    <Card>
      <CardBody className="py-10">
        <div className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[var(--icb-success-bg)] text-[var(--icb-success-fg)]">
            <CheckCircle2 size={24} aria-hidden="true" />
          </div>
          <h2 className="mt-5 font-display text-2xl font-bold tracking-[-0.02em]">
            Application received
          </h2>
          <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-[var(--icb-text-muted)]">
            Three short steps and the account is open. The first is already in your inbox.
          </p>
        </div>

        <ol className="mx-auto mt-8 max-w-md space-y-5">
          {NEXT_STEPS.map((step, index) => (
            <li key={step.title} className="flex gap-4">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--icb-bg-muted)] text-[var(--icb-primary)]">
                <step.icon size={17} aria-hidden="true" />
                <span className="sr-only">Step {index + 1}</span>
              </span>
              <div>
                <p className="text-sm font-semibold">{step.title}</p>
                <p className="mt-0.5 text-sm text-[var(--icb-text-muted)]">{step.detail}</p>
              </div>
            </li>
          ))}
        </ol>

        {signInUrl ? (
          <div className="mt-9 text-center">
            <a
              href={signInUrl}
              className="inline-flex h-12 items-center rounded-[var(--radius-md)] bg-[var(--icb-primary)] px-6 text-base font-medium text-white transition-colors hover:bg-[var(--icb-primary-hover)]"
            >
              Sign in to continue
            </a>
          </div>
        ) : null}
      </CardBody>
    </Card>
  );
}
