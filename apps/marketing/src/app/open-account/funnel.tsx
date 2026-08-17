'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Button, Card, CardBody } from '@icb/ui';
import { AlertCircle } from 'lucide-react';
import { useEffect, useRef, useState, useTransition, type FormEvent } from 'react';
import { FormProvider, useForm } from 'react-hook-form';

import { applyAction, type ApplicationState } from './actions';
import { Confirmation } from './confirmation';
import { FunnelProgress } from './progress';
import { ReviewStep } from './review';
import {
  APPLICATION_DEFAULTS,
  applicationSchema,
  FUNNEL_STEPS,
  stepForField,
  type ApplicationDraft,
} from './schema';
import { IdentityStep, PersonalStep, ProductStep } from './steps';

const INITIAL: ApplicationState = { status: 'idle', message: null, fieldErrors: {}, signInUrl: null };

const STEP_PANELS = [ProductStep, PersonalStep, IdentityStep] as const;

/**
 * The account-application funnel.
 *
 * One react-hook-form instance holds the whole draft across steps, so Back and the review
 * step's Edit links never lose input. Each step validates only its own fields; the final
 * submit posts the credential fields to the existing registration server action, which creates
 * the customer and KYC case through `/auth/register`.
 */
export function ApplicationFunnel() {
  const [step, setStep] = useState(0);
  const [server, setServer] = useState<ApplicationState>(INITIAL);
  const [pending, startTransition] = useTransition();
  const headingRef = useRef<HTMLHeadingElement>(null);

  const form = useForm<ApplicationDraft>({
    resolver: zodResolver(applicationSchema),
    defaultValues: APPLICATION_DEFAULTS,
    mode: 'onTouched',
  });

  useEffect(() => {
    headingRef.current?.focus();
  }, [step]);

  if (server.status === 'submitted') {
    return <Confirmation signInUrl={server.signInUrl} />;
  }

  const isLast = step === FUNNEL_STEPS.length - 1;

  const goNext = async () => {
    const valid = await form.trigger(FUNNEL_STEPS[step]?.fields ?? []);
    if (valid) {
      setServer(INITIAL);
      setStep((current) => Math.min(current + 1, FUNNEL_STEPS.length - 1));
    }
  };

  const submit = form.handleSubmit((values) => {
    startTransition(async () => {
      const formData = new FormData();
      formData.set('firstName', values.firstName);
      formData.set('lastName', values.lastName);
      formData.set('email', values.email);
      formData.set('phone', values.phone);
      formData.set('password', values.password);
      const result = await applyAction(server, formData);
      setServer(result);
      applyServerFieldErrors(result, form.setError, setStep);
    });
  });

  const onFormSubmit = (event: FormEvent<HTMLFormElement>) => {
    if (!isLast) {
      event.preventDefault();
      void goNext();
      return;
    }
    void submit(event);
  };

  const Panel = STEP_PANELS[step];
  const currentStep = FUNNEL_STEPS[step];

  return (
    <Card>
      <CardBody className="pt-6">
        <FunnelProgress steps={FUNNEL_STEPS} current={step} />
        <FormProvider {...form}>
          <form onSubmit={onFormSubmit} noValidate className="space-y-6">
            <h2
              ref={headingRef}
              tabIndex={-1}
              className="font-display text-xl font-bold tracking-[-0.02em] outline-none"
            >
              {currentStep?.title}
            </h2>

            {server.message ? (
              <p
                role="alert"
                className="flex items-start gap-2 rounded-[var(--radius-md)] border border-[var(--icb-danger-border)] bg-[var(--icb-danger-bg)] px-4 py-3 text-sm text-[var(--icb-danger-fg)]"
              >
                <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
                {server.message}
              </p>
            ) : null}

            <div key={step} className="animate-rise">
              {Panel ? <Panel /> : <ReviewStep onEdit={setStep} />}
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-[var(--icb-border)] pt-5">
              {step > 0 ? (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setStep((current) => Math.max(current - 1, 0))}
                  disabled={pending}
                >
                  Back
                </Button>
              ) : (
                <span />
              )}
              {isLast ? (
                <Button type="submit" size="lg" loading={pending}>
                  {pending ? 'Opening your account…' : 'Open my account'}
                </Button>
              ) : (
                <Button type="button" size="lg" onClick={() => void goNext()}>
                  Continue
                </Button>
              )}
            </div>
          </form>
        </FormProvider>
      </CardBody>
    </Card>
  );
}

/** Pushes server-side field errors back into the form and returns to the owning step. */
function applyServerFieldErrors(
  result: ApplicationState,
  setError: (name: keyof ApplicationDraft, error: { message: string }) => void,
  goToStep: (step: number) => void,
) {
  const fields = Object.keys(result.fieldErrors);
  if (fields.length === 0) {
    return;
  }
  for (const field of fields) {
    const message = result.fieldErrors[field];
    if (message) {
      setError(field as keyof ApplicationDraft, { message });
    }
  }
  goToStep(stepForField(fields[0] ?? ''));
}
