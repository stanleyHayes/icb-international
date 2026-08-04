import '@testing-library/jest-dom/vitest';
// @vitest-environment jsdom
import { useState } from 'react';

import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PhoneInput } from '../phone-input';

afterEach(cleanup);

describe('PhoneInput', () => {
  it('splits an E.164 value into code and formatted national number', () => {
    render(<PhoneInput value="+233555123456" onChange={() => undefined} />);
    expect(screen.getByRole('combobox', { name: 'Country calling code' })).toHaveValue('233');
    expect(screen.getByRole('textbox')).toHaveValue('555 123 456');
  });

  it('emits E.164 as the national number is typed', async () => {
    const onChange = vi.fn();
    function Harness() {
      const [value, setValue] = useState('+44');
      return (
        <PhoneInput
          value={value}
          onChange={(next) => {
            setValue(next);
            onChange(next);
          }}
        />
      );
    }
    render(<Harness />);
    await userEvent.type(screen.getByRole('textbox'), '207');
    expect(onChange).toHaveBeenLastCalledWith('+44207');
    expect(screen.getByRole('textbox')).toHaveValue('207');
  });

  it('switches the calling code and keeps the national digits', async () => {
    const onChange = vi.fn();
    render(<PhoneInput value="+233555123456" onChange={onChange} />);
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Country calling code' }), '44');
    expect(onChange).toHaveBeenCalledWith('+44555123456');
  });

  it('emits an empty value when the national number is cleared', async () => {
    const onChange = vi.fn();
    render(<PhoneInput value="+233555123456" onChange={onChange} />);
    await userEvent.clear(screen.getByRole('textbox'));
    expect(onChange).toHaveBeenLastCalledWith('');
  });
});
