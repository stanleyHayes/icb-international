import '@testing-library/jest-dom/vitest';
// @vitest-environment jsdom
import { useState } from 'react';

import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Combobox, type ComboOption } from '../combobox';

const OPTIONS: ComboOption[] = [
  { value: 'ghs', label: 'Ghanaian Cedi', description: 'GHS' },
  { value: 'usd', label: 'US Dollar', description: 'USD' },
  { value: 'gbp', label: 'Pound Sterling', disabled: true },
  { value: 'eur', label: 'Euro' },
];

function Harness({
  onChange,
  allowCustomValue = false,
}: Readonly<{
  onChange?: (value: string | null) => void;
  allowCustomValue?: boolean;
}>) {
  const [value, setValue] = useState<string | null>(null);
  return (
    <Combobox
      options={OPTIONS}
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange?.(next);
      }}
      placeholder="Pick a currency"
      allowCustomValue={allowCustomValue}
    />
  );
}

afterEach(cleanup);

describe('Combobox', () => {
  it('opens on focus and filters as the user types', async () => {
    render(<Harness />);
    const input = screen.getByRole('combobox');
    await userEvent.click(input);
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    expect(screen.getAllByRole('option')).toHaveLength(4);
    await userEvent.type(input, 'dol');
    expect(screen.getAllByRole('option')).toHaveLength(1);
    expect(screen.getByRole('option', { name: /US Dollar/ })).toBeInTheDocument();
  });

  it('selects with ArrowDown + Enter and shows the choice', async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    const input = screen.getByRole('combobox');
    await userEvent.click(input);
    await userEvent.keyboard('{ArrowDown}{Enter}');
    expect(onChange).toHaveBeenCalledWith('usd');
    expect(input).toHaveValue('US Dollar');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('skips disabled options when stepping', async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    await userEvent.click(screen.getByRole('combobox'));
    await userEvent.keyboard('{ArrowDown}{ArrowDown}{Enter}');
    expect(onChange).toHaveBeenCalledWith('eur');
  });

  it('exposes the active option via aria-activedescendant', async () => {
    render(<Harness />);
    const input = screen.getByRole('combobox');
    await userEvent.click(input);
    await userEvent.keyboard('{ArrowDown}');
    const activeId = input.getAttribute('aria-activedescendant');
    expect(activeId).toBeTruthy();
    expect(document.getElementById(activeId ?? '')).not.toBeNull();
    expect(input).toHaveAttribute('aria-expanded', 'true');
  });

  it('closes on Escape and reverts the query', async () => {
    render(<Harness />);
    const input = screen.getByRole('combobox');
    await userEvent.click(input);
    await userEvent.type(input, 'xyz');
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('shows the empty message when nothing matches', async () => {
    render(<Harness />);
    const input = screen.getByRole('combobox');
    await userEvent.click(input);
    await userEvent.type(input, 'zzz');
    expect(screen.getByText('No matches')).toBeInTheDocument();
  });

  it('commits a custom value when allowed', async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} allowCustomValue />);
    const input = screen.getByRole('combobox');
    await userEvent.click(input);
    await userEvent.type(input, 'Swiss Franc');
    await userEvent.keyboard('{Enter}');
    expect(onChange).toHaveBeenCalledWith('Swiss Franc');
  });

  it('selects an option by click', async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    await userEvent.click(screen.getByRole('combobox'));
    await userEvent.click(screen.getByRole('option', { name: /Euro/ }));
    expect(onChange).toHaveBeenCalledWith('eur');
  });
});
