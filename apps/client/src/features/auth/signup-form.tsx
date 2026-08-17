'use client';

import { registerRequestSchema } from '@icb/contracts';
import { Button, Checkbox, Field, Input, PasswordInput, PhoneInput } from '@icb/ui';
import { Check, MailCheck } from 'lucide-react';
import Link from 'next/link';
import { useActionState, useEffect, useRef, useState } from 'react';

import { FormAlert } from './form-alert';
import type { AuthFormState } from './password-actions';
import { signupAction } from './signup-actions';

const INITIAL: AuthFormState = { error: null, fieldErrors: {}, done: false };

/** The terms version the customer asserts to. Bumped when the terms materially change. */
const TERMS_VERSION = '1.0';

const STEPS = [
  { id: 'name', title: 'Your name', fields: ['firstName', 'lastName'] },
  { id: 'contact', title: 'Contact', fields: ['email', 'phone'] },
  { id: 'security', title: 'Security', fields: ['password', 'confirmPassword', 'terms'] },
] as const;

/** Per-step slices of the register contract, validated client-side before advancing. */
const STEP_SCHEMAS = [
  registerRequestSchema.pick({ firstName: true, lastName: true }),
  registerRequestSchema.pick({ email: true, phone: true }),
  registerRequestSchema.pick({ password: true }),
] as const;

/** Earliest step owning one of the server-rejected fields, so the error is on screen. */
function stepForErrors(fieldErrors: Record<string, string>): number {
  const keys = new Set(Object.keys(fieldErrors));
  const index = STEPS.findIndex((step) => step.fields.some((field) => keys.has(field)));
  return index === -1 ? STEPS.length - 1 : index;
}

/**
 * Opening an account, part one: who you are and how you will sign in.
 *
 * The form is stepwise — name, then contact, then security — so the split page never scrolls
 * and each screen asks for one kind of thing. Every step stays mounted (hidden, not disabled),
 * so a single FormData submit on the last step carries the whole draft; Continue validates just
 * the current step's fields against the shared register contract before moving on.
 *
 * The success state is not a dashboard — registration deliberately does not create a session.
 * The next thing the customer must do is in their inbox, so that is what the screen says.
 */
export function SignupForm() {
  const [state, action, pending] = useActionState(signupAction, INITIAL);
  const [step, setStep] = useState(0);
  const [stepErrors, setStepErrors] = useState<Record<string, string>>({});
  const [phone, setPhone] = useState('');
  const stepRefs = useRef<Array<HTMLDivElement | null>>([]);

  // Server-side validation errors land on the step that owns the field, not under the button.
  useEffect(() => {
    if (Object.keys(state.fieldErrors).length > 0) {
      setStep(stepForErrors(state.fieldErrors));
    }
  }, [state]);

  // Move focus into the step that just became visible.
  useEffect(() => {
    stepRefs.current[step]?.querySelector('input')?.focus();
  }, [step]);

  if (state.done) {
    return <SuccessPanel />;
  }

  const fieldErrors = { ...stepErrors, ...state.fieldErrors };

  /**
   * Move to another step once the click that asked for it has fully finished. Advancing
   * synchronously swaps the button under the cursor mid-click (Continue out, "Open account"
   * in), and the browser then activates the new button as the click's default action —
   * submitting the form before the customer has seen the last step.
   */
  const goToStep = (next: number) => {
    setTimeout(() => setStep(next), 0);
  };

  /** Validate the current step's slice of the register contract before advancing. */
  const advance = (form: HTMLFormElement) => {
    const current = STEPS[step];
    const schema = STEP_SCHEMAS[step];
    if (!current || !schema) {
      return;
    }
    const fields = current.fields.filter(
      (field) => field !== 'terms' && field !== 'confirmPassword',
    );
    const data = Object.fromEntries(
      fields.map((field) => [field, new FormData(form).get(field)]),
    );
    const parsed = schema.safeParse(data);
    setStepErrors(
      parsed.success
        ? {}
        : Object.fromEntries(
            parsed.error.issues.map((issue) => [issue.path.map(String).join('.'), issue.message]),
          ),
    );
    if (parsed.success) {
      goToStep(step + 1);
    }
  };

  /** The last client-side gate before the server: matching passwords and accepted terms. */
  const guardSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    const data = new FormData(event.currentTarget);
    const errors: Record<string, string> = {};
    if (data.get('password') !== data.get('confirmPassword')) {
      errors['confirmPassword'] = 'The passwords do not match';
    }
    if (data.get('terms') !== 'on') {
      errors['terms'] = 'You must accept the terms to open an account';
    }
    setStepErrors(errors);
    if (Object.keys(errors).length > 0) {
      event.preventDefault();
    }
  };

  return (
    <form action={action} className="space-y-5" noValidate onSubmit={guardSubmit}>
      <StepIndicator current={step} />
      <FormAlert message={state.error} />
      <input type="hidden" name="acceptedTermsVersion" value={TERMS_VERSION} />
      <input type="hidden" name="phone" value={phone} />

      <div
        ref={(el) => {
          stepRefs.current[0] = el;
        }}
        hidden={step !== 0}
        className="animate-rise space-y-5"
      >
        <NameStep fieldErrors={fieldErrors} />
      </div>

      <div
        ref={(el) => {
          stepRefs.current[1] = el;
        }}
        hidden={step !== 1}
        className="animate-rise space-y-5"
      >
        <ContactStep fieldErrors={fieldErrors} phone={phone} onPhoneChange={setPhone} />
      </div>

      <div
        ref={(el) => {
          stepRefs.current[2] = el;
        }}
        hidden={step !== 2}
        className="animate-rise space-y-5"
      >
        <SecurityStep fieldErrors={fieldErrors} />
      </div>

      <div className="flex items-center justify-between gap-3 pt-1">
        {step > 0 ? (
          <Button type="button" variant="ghost" size="lg" onClick={() => goToStep(step - 1)}>
            Back
          </Button>
        ) : (
          <span aria-hidden="true" />
        )}
        {step < STEPS.length - 1 ? (
          <Button type="button" size="lg" onClick={(event) => advance(event.currentTarget.form!)}>
            Continue
          </Button>
        ) : (
          <Button type="submit" size="lg" loading={pending}>
            {pending ? 'Opening your account…' : 'Open account'}
          </Button>
        )}
      </div>
    </form>
  );
}

function NameStep({ fieldErrors }: Readonly<{ fieldErrors: Record<string, string> }>) {
  return (
    <>
      <Field label="First name" error={fieldErrors['firstName']} required>
        <Input name="firstName" autoComplete="given-name" required />
      </Field>
      <Field label="Last name" error={fieldErrors['lastName']} required>
        <Input name="lastName" autoComplete="family-name" required />
      </Field>
    </>
  );
}

function ContactStep({
  fieldErrors,
  phone,
  onPhoneChange,
}: Readonly<{
  fieldErrors: Record<string, string>;
  phone: string;
  onPhoneChange: (value: string) => void;
}>) {
  return (
    <>
      <Field label="Email address" error={fieldErrors['email']} required>
        <Input name="email" type="email" autoComplete="email" required />
      </Field>
      <Field
        label="Mobile number"
        description="Used for security codes. Include the country code, e.g. +233201234567."
        error={fieldErrors['phone']}
        required
      >
        <PhoneInput value={phone} onChange={onPhoneChange} required />
      </Field>
    </>
  );
}

function SecurityStep({ fieldErrors }: Readonly<{ fieldErrors: Record<string, string> }>) {
  return (
    <>
      <Field
        label="Password"
        description="At least 12 characters, with upper and lower case letters and a digit."
        error={fieldErrors['password']}
        required
      >
        <PasswordInput name="password" autoComplete="new-password" required />
      </Field>
      <Field label="Confirm password" error={fieldErrors['confirmPassword']} required>
        <PasswordInput
          name="confirmPassword"
          autoComplete="new-password"
          showStrengthMeter={false}
          required
        />
      </Field>
      <div>
        <Checkbox
          name="terms"
          label="I agree to the account terms and the privacy notice"
          invalid={Boolean(fieldErrors['terms'])}
        />
        {fieldErrors['terms'] ? (
          <p role="alert" className="mt-1.5 text-xs text-[var(--icb-danger-fg)]">
            {fieldErrors['terms']}
          </p>
        ) : null}
      </div>
    </>
  );
}

/** Registration ends on "check your inbox", not a dashboard. */
function SuccessPanel() {
  return (
    <div className="space-y-4">
      <div
        role="status"
        className="flex items-start gap-3 rounded-[var(--radius-md)] border border-[var(--icb-success-border)] bg-[var(--icb-success-bg)] px-4 py-3 text-sm text-[var(--icb-success-fg)]"
      >
        <MailCheck size={17} className="mt-0.5 shrink-0" aria-hidden="true" />
        <span>
          Your account is created. We sent a verification code to your email — enter it to confirm
          the address, then sign in to finish setting up.
        </span>
      </div>
      <div className="flex gap-2">
        <Link
          href="/verify-email"
          className="inline-flex h-10 items-center gap-2 rounded-[var(--radius-md)] bg-[var(--icb-primary)] px-4 text-sm font-medium text-white shadow-[var(--shadow-xs)] transition-colors hover:bg-[var(--icb-primary-hover)]"
        >
          Enter verification code
        </Link>
        <Link
          href="/login"
          className="inline-flex h-10 items-center gap-2 rounded-[var(--radius-md)] px-4 text-sm font-medium text-[var(--icb-text-muted)] transition-colors hover:bg-[var(--icb-bg-muted)] hover:text-[var(--icb-text)]"
        >
          Sign in
        </Link>
      </div>
    </div>
  );
}

type StepState = 'done' | 'current' | 'todo';

function stepState(index: number, current: number): StepState {
  if (index < current) return 'done';
  return index === current ? 'current' : 'todo';
}

/**
 * The step indicator. An ordered list so screen readers announce "step 2 of 3"; completed steps
 * show a check and are deliberately not clickable — keyboard flow has exactly one path.
 */
function StepIndicator({ current }: Readonly<{ current: number }>) {
  return (
    <nav aria-label="Sign-up progress" className="mb-2">
      <ol className="flex items-center gap-2">
        {STEPS.map((step, index) => {
          const state = stepState(index, current);
          return (
            <li key={step.id} className="flex min-w-0 flex-1 flex-col gap-2">
              <span
                aria-hidden="true"
                className={`h-1 rounded-full transition-colors ${
                  state === 'todo' ? 'bg-[var(--icb-border)]' : 'bg-[var(--icb-primary)]'
                }`}
              />
              <span className="flex items-center gap-1.5 text-xs">
                <StepBadge index={index} state={state} />
                <span
                  aria-current={state === 'current' ? 'step' : undefined}
                  className={`truncate ${
                    state === 'current'
                      ? 'font-semibold text-[var(--icb-text)]'
                      : 'text-[var(--icb-text-subtle)]'
                  }`}
                >
                  {step.title}
                </span>
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function StepBadge({ index, state }: Readonly<{ index: number; state: StepState }>) {
  if (state === 'done') {
    return (
      <span className="flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full bg-[var(--icb-primary)] text-white">
        <Check size={11} strokeWidth={3} aria-hidden="true" />
      </span>
    );
  }
  return (
    <span
      aria-hidden="true"
      className={`tabular flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full border text-[0.65rem] font-semibold ${
        state === 'current'
          ? 'border-[var(--icb-primary)] text-[var(--icb-primary)]'
          : 'border-[var(--icb-border-strong)] text-[var(--icb-text-subtle)]'
      }`}
    >
      {index + 1}
    </span>
  );
}
