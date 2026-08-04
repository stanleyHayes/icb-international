import '@testing-library/jest-dom/vitest';
// @vitest-environment jsdom
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';

import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Field } from '../field';
import { Input } from '../input';
import { MoneyInput } from '../money-input';
import { RadioGroup } from '../radio-group';

const transferSchema = z.object({
  recipient: z.string().min(1, 'Recipient is required'),
  amount: z.number().int('Whole minor units only').positive('Enter an amount'),
  rail: z.string().min(1, 'Choose a rail'),
});

type TransferValues = z.infer<typeof transferSchema>;

const RAIL_OPTIONS = [
  { value: 'internal', label: 'Between my accounts' },
  { value: 'ach', label: 'ACH transfer' },
];

function TransferForm({ onSend }: Readonly<{ onSend: (values: TransferValues) => void }>) {
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<TransferValues>({
    resolver: zodResolver(transferSchema),
    defaultValues: { recipient: '', amount: 0, rail: '' },
  });
  return (
    <form
      onSubmit={(event) => {
        void handleSubmit(onSend)(event);
      }}
    >
      <Field label="Recipient" error={errors.recipient?.message}>
        <Input {...register('recipient')} />
      </Field>
      <Field label="Amount" error={errors.amount?.message}>
        <Controller
          name="amount"
          control={control}
          render={({ field }) => (
            <MoneyInput
              currency="USD"
              name={field.name}
              value={field.value === 0 ? null : field.value}
              onChange={(minor) => field.onChange(minor ?? 0)}
              onBlur={field.onBlur}
            />
          )}
        />
      </Field>
      <Field label="Rail" error={errors.rail?.message}>
        <Controller
          name="rail"
          control={control}
          render={({ field }) => (
            <RadioGroup
              options={RAIL_OPTIONS}
              name={field.name}
              value={field.value === '' ? null : field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
            />
          )}
        />
      </Field>
      <button type="submit">Send</button>
    </form>
  );
}

afterEach(cleanup);

describe('react-hook-form + Zod wiring', () => {
  it('surfaces Zod errors through Field with aria association', async () => {
    render(<TransferForm onSend={() => undefined} />);
    await userEvent.click(screen.getByRole('button', { name: 'Send' }));
    const recipient = screen.getByLabelText('Recipient');
    expect(await screen.findByText('Recipient is required')).toBeInTheDocument();
    expect(recipient).toHaveAttribute('aria-invalid', 'true');
    const describedBy = recipient.getAttribute('aria-describedby') ?? '';
    expect(describedBy).not.toBe('');
    expect(document.getElementById(describedBy)).toHaveTextContent('Recipient is required');
    expect(screen.getByText('Enter an amount')).toBeInTheDocument();
    expect(screen.getByText('Choose a rail')).toBeInTheDocument();
  });

  it('submits typed values with money as integer minor units', async () => {
    const onSend = vi.fn();
    render(<TransferForm onSend={onSend} />);
    await userEvent.type(screen.getByLabelText('Recipient'), 'Ada Lovelace');
    await userEvent.type(screen.getByLabelText('Amount'), '25.50');
    await userEvent.click(screen.getByRole('radio', { name: 'ACH transfer' }));
    await userEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(onSend).toHaveBeenCalledWith(
      { recipient: 'Ada Lovelace', amount: 2550, rail: 'ach' },
      expect.anything(),
    );
  });
});
