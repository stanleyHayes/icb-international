import '@testing-library/jest-dom/vitest';
// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Field } from '../field';
import { RadioGroup } from '../radio-group';

const OPTIONS = [
  { value: 'internal', label: 'Between my accounts' },
  { value: 'ach', label: 'ACH transfer', description: 'Arrives next business day' },
  { value: 'wire', label: 'Wire transfer', disabled: true },
] as const;

afterEach(cleanup);

describe('RadioGroup', () => {
  it('renders a labelled radiogroup with option descriptions', () => {
    render(
      <Field label="Transfer type">
        <RadioGroup options={OPTIONS} value={null} onChange={() => undefined} />
      </Field>,
    );
    expect(screen.getByRole('radiogroup', { name: 'Transfer type' })).toBeInTheDocument();
    expect(screen.getByText('Arrives next business day')).toBeInTheDocument();
  });

  it('selects an option and reports its value', async () => {
    const onChange = vi.fn();
    render(<RadioGroup options={OPTIONS} value={null} onChange={onChange} />);
    await userEvent.click(screen.getByRole('radio', { name: /ACH transfer/ }));
    expect(onChange).toHaveBeenCalledWith('ach');
  });

  it('moves with the arrow keys like a native group', async () => {
    const onChange = vi.fn();
    render(<RadioGroup options={OPTIONS} value="internal" onChange={onChange} name="rail" />);
    const first = screen.getByRole('radio', { name: 'Between my accounts' });
    first.focus();
    await userEvent.keyboard('{ArrowDown}');
    expect(onChange).toHaveBeenCalledWith('ach');
  });

  it('disables individual options', () => {
    render(<RadioGroup options={OPTIONS} value={null} onChange={() => undefined} />);
    expect(screen.getByRole('radio', { name: 'Wire transfer' })).toBeDisabled();
  });

  it('associates Field errors with the group', () => {
    render(
      <Field label="Transfer type" error="Choose a rail">
        <RadioGroup options={OPTIONS} value={null} onChange={() => undefined} />
      </Field>,
    );
    const group = screen.getByRole('radiogroup');
    expect(group).toHaveAttribute('aria-invalid', 'true');
    expect(group.getAttribute('aria-describedby')).toContain('-error');
  });
});
