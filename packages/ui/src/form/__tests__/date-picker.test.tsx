import '@testing-library/jest-dom/vitest';
// @vitest-environment jsdom
import { useState } from 'react';

import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { DatePicker } from '../date-picker';

function Harness({ onChange }: Readonly<{ onChange?: (iso: string | null) => void }>) {
  const [value, setValue] = useState<string | null>(null);
  return (
    <DatePicker
      value={value}
      onChange={(iso) => {
        setValue(iso);
        onChange?.(iso);
      }}
    />
  );
}

afterEach(cleanup);

describe('DatePicker', () => {
  it('commits a typed ISO date on blur', async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    const input = screen.getByRole('textbox');
    await userEvent.type(input, '2026-03-15');
    await userEvent.click(document.body);
    expect(onChange).toHaveBeenLastCalledWith('2026-03-15');
    expect(input).toHaveValue('2026-03-15');
  });

  it('parses day-first typed dates', async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    const input = screen.getByRole('textbox');
    await userEvent.type(input, '15/03/2026');
    await userEvent.keyboard('{Enter}');
    expect(onChange).toHaveBeenLastCalledWith('2026-03-15');
  });

  it('reverts an unparseable draft on blur', async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    const input = screen.getByRole('textbox');
    await userEvent.type(input, 'not a date');
    await userEvent.click(document.body);
    expect(input).toHaveValue('');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('clears the value when the draft is emptied', async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    const input = screen.getByRole('textbox');
    await userEvent.type(input, '2026-03-15{Enter}');
    await userEvent.clear(input);
    await userEvent.keyboard('{Enter}');
    expect(onChange).toHaveBeenLastCalledWith(null);
  });

  it('opens the calendar and selects a day', async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: 'Open calendar' }));
    const grid = screen.getByRole('grid');
    expect(grid).toBeInTheDocument();
    const today = new Date();
    const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-15`;
    await userEvent.click(screen.getByRole('button', { name: iso }));
    expect(onChange).toHaveBeenCalledWith(iso);
    expect(screen.queryByRole('grid')).not.toBeInTheDocument();
  });

  it('closes the calendar on Escape', async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole('button', { name: 'Open calendar' }));
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('grid')).not.toBeInTheDocument();
  });
});
