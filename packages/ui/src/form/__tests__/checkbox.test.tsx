import '@testing-library/jest-dom/vitest';
// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Field } from '../field';
import { Checkbox } from '../checkbox';

afterEach(cleanup);

describe('Checkbox', () => {
  it('toggles with a click on the label', async () => {
    const onChange = vi.fn();
    render(<Checkbox label="I agree to the terms" onChange={onChange} />);
    const checkbox = screen.getByRole('checkbox', { name: 'I agree to the terms' });
    await userEvent.click(checkbox);
    expect(checkbox).toBeChecked();
    expect(onChange).toHaveBeenCalled();
  });

  it('toggles with the keyboard', async () => {
    render(<Checkbox label="Remember this device" />);
    const checkbox = screen.getByRole('checkbox', { name: 'Remember this device' });
    checkbox.focus();
    await userEvent.keyboard('[Space]');
    expect(checkbox).toBeChecked();
  });

  it('renders without a label for composed layouts', () => {
    render(<Checkbox aria-label="Select row" />);
    expect(screen.getByRole('checkbox', { name: 'Select row' })).toBeInTheDocument();
  });

  it('inherits error wiring from Field', () => {
    render(
      <Field label="Consent" error="Consent is required">
        <Checkbox label="I agree" />
      </Field>,
    );
    const checkbox = screen.getByRole('checkbox', { name: /I agree/ });
    expect(checkbox).toHaveAttribute('aria-invalid', 'true');
    expect(checkbox.getAttribute('aria-describedby')).toContain('-error');
  });
});
