import '@testing-library/jest-dom/vitest';
// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';

import { Field } from '../field';
import { Textarea } from '../textarea';

afterEach(cleanup);

describe('Textarea', () => {
  it('renders three rows by default and accepts input', async () => {
    render(<Textarea aria-label="Notes" />);
    const textarea = screen.getByLabelText('Notes');
    expect(textarea).toHaveAttribute('rows', '3');
    await userEvent.type(textarea, 'line one');
    expect(textarea).toHaveValue('line one');
  });

  it('inherits aria wiring and invalid state from Field', () => {
    render(
      <Field label="Notes" error="Too long">
        <Textarea />
      </Field>,
    );
    const textarea = screen.getByLabelText('Notes');
    expect(textarea).toHaveAttribute('aria-invalid', 'true');
    expect(textarea.getAttribute('aria-describedby')).toContain('-error');
  });

  it('honours the disabled prop', () => {
    render(<Textarea aria-label="Notes" disabled />);
    expect(screen.getByLabelText('Notes')).toBeDisabled();
  });
});
