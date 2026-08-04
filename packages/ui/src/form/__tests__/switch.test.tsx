import '@testing-library/jest-dom/vitest';
// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Field } from '../field';
import { Switch } from '../switch';

afterEach(cleanup);

describe('Switch', () => {
  it('renders as a switch with the pressed state exposed', () => {
    render(<Switch value={false} onChange={() => undefined} aria-label="Auto-save" />);
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false');
  });

  it('toggles with click and keyboard', async () => {
    const onChange = vi.fn();
    render(<Switch value={false} onChange={onChange} />);
    const control = screen.getByRole('switch');
    await userEvent.click(control);
    expect(onChange).toHaveBeenCalledWith(true);
    control.focus();
    await userEvent.keyboard('[Enter]');
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it('renders the on state', () => {
    render(<Switch value onChange={() => undefined} />);
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true');
  });

  it('inherits labelling and disabled state from Field', () => {
    render(
      <Field label="Paperless statements" disabled>
        <Switch value={false} onChange={() => undefined} />
      </Field>,
    );
    expect(screen.getByRole('switch')).toBeDisabled();
  });
});
