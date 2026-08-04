'use client';

import { Button, Field, Input, Select, Textarea } from '@icb/ui';
import { useActionState } from 'react';

import { requestCallbackAction, type SupportActionState } from './actions';
import { SupportFeedback } from './form-feedback';
import { CALLBACK_WINDOWS } from './types';

const INITIAL: SupportActionState = { error: null, done: false };

/**
 * Callback request. The bank calls the customer — never the other way round for anything
 * sensitive — so the customer picks the window and the number, and the reason lets the agent
 * reach the right desk first time.
 */
export function CallbackForm({ defaultPhone }: Readonly<{ defaultPhone: string }>) {
  const [state, action, pending] = useActionState(requestCallbackAction, INITIAL);

  return (
    <form action={action} className="space-y-5">
      <Field label="Number to call" required description="We only ever call the number on your account.">
        <Input name="phone" type="tel" required defaultValue={defaultPhone} maxLength={32} />
      </Field>

      <Field label="Best time" required>
        <Select name="preferredWindow" required defaultValue="any">
          {CALLBACK_WINDOWS.map((window) => (
            <option key={window.value} value={window.value}>
              {window.label}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="What is it about?" required>
        <Textarea
          name="reason"
          required
          minLength={4}
          maxLength={500}
          rows={4}
          placeholder="A sentence or two so the right person calls you."
        />
      </Field>

      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" loading={pending}>
          Request callback
        </Button>
        <SupportFeedback state={state} doneText="Booked — we will call you in your chosen window." />
      </div>
    </form>
  );
}
