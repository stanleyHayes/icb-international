import '@testing-library/jest-dom/vitest';
// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { Field } from '../field';
import { Input } from '../input';

afterEach(cleanup);

describe('Field', () => {
  it('associates the label with the control', () => {
    render(
      <Field label="Account name">
        <Input />
      </Field>,
    );
    const input = screen.getByLabelText('Account name');
    expect(input.tagName).toBe('INPUT');
  });

  it('wires description and error through aria-describedby', () => {
    render(
      <Field label="Amount" description="Daily limit applies" error="Amount is required">
        <Input />
      </Field>,
    );
    const input = screen.getByLabelText('Amount');
    const error = screen.getByRole('alert');
    expect(error).toHaveTextContent('Amount is required');
    const describedBy = input.getAttribute('aria-describedby') ?? '';
    for (const id of describedBy.split(' ')) {
      expect(document.getElementById(id)).not.toBeNull();
    }
    expect(describedBy).toContain(error.id);
    expect(input).toHaveAttribute('aria-invalid', 'true');
  });

  it('marks required fields visually and programmatically', () => {
    render(
      <Field label="Email" required>
        <Input />
      </Field>,
    );
    expect(screen.getByLabelText(/Email/)).toBeRequired();
  });

  it('lets an explicit id win over the generated one', () => {
    render(
      <Field id="custom-id" label="Name" error="Required">
        <Input />
      </Field>,
    );
    const input = screen.getByLabelText('Name');
    expect(input.id).toBe('custom-id');
    expect(input.getAttribute('aria-describedby')).toBe('custom-id-error');
  });

  it('omits the description region when no description is given', () => {
    render(
      <Field label="Name">
        <Input />
      </Field>,
    );
    expect(screen.getByLabelText('Name').getAttribute('aria-describedby')).toBeNull();
  });
});
