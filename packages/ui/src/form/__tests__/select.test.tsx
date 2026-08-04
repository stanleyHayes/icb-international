import '@testing-library/jest-dom/vitest';
// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Field } from '../field';
import { Select } from '../select';

afterEach(cleanup);

describe('Select', () => {
  it('renders options and selects with the keyboard', async () => {
    const onChange = vi.fn();
    render(
      <Select aria-label="Currency" onChange={onChange}>
        <option value="USD">US Dollar</option>
        <option value="GHS">Ghanaian Cedi</option>
      </Select>,
    );
    const select = screen.getByLabelText('Currency');
    await userEvent.selectOptions(select, 'GHS');
    expect(select).toHaveValue('GHS');
    expect(onChange).toHaveBeenCalled();
  });

  it('renders the chevron as decoration only', () => {
    const { container } = render(
      <Select aria-label="Currency">
        <option value="USD">US Dollar</option>
      </Select>,
    );
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('inherits invalid state and described-by from Field', () => {
    render(
      <Field label="Currency" error="Pick one">
        <Select>
          <option value="USD">US Dollar</option>
        </Select>
      </Field>,
    );
    const select = screen.getByLabelText('Currency');
    expect(select).toHaveAttribute('aria-invalid', 'true');
    expect(select.getAttribute('aria-describedby')).toContain('-error');
  });
});
