import '@testing-library/jest-dom/vitest';
// @vitest-environment jsdom
import { useState } from 'react';

import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { formatDate } from '../../lib/format';
import { DateRangePicker, type DateRange } from '../date-range-picker';

function Harness({ onChange }: Readonly<{ onChange?: (range: DateRange) => void }>) {
  const [value, setValue] = useState<DateRange>({ start: null, end: null });
  return (
    <DateRangePicker
      value={value}
      onChange={(range) => {
        setValue(range);
        onChange?.(range);
      }}
    />
  );
}

function currentMonthIso(day: string): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${day}`;
}

afterEach(cleanup);

describe('DateRangePicker', () => {
  it('shows the placeholder until a range is chosen', () => {
    render(<Harness />);
    expect(screen.getByRole('textbox')).toHaveValue('');
    expect(screen.getByRole('textbox')).toHaveAttribute('placeholder', 'Select dates');
  });

  it('builds a range from two clicks', async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: 'Open calendar' }));
    await userEvent.click(screen.getByRole('button', { name: currentMonthIso('10') }));
    expect(onChange).toHaveBeenLastCalledWith({ start: currentMonthIso('10'), end: null });
    await userEvent.click(screen.getByRole('button', { name: currentMonthIso('14') }));
    expect(onChange).toHaveBeenLastCalledWith({
      start: currentMonthIso('10'),
      end: currentMonthIso('14'),
    });
    expect(screen.queryByRole('grid')).not.toBeInTheDocument();
  });

  it('swaps a reversed second click', async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: 'Open calendar' }));
    await userEvent.click(screen.getByRole('button', { name: currentMonthIso('14') }));
    await userEvent.click(screen.getByRole('button', { name: currentMonthIso('10') }));
    expect(onChange).toHaveBeenLastCalledWith({
      start: currentMonthIso('10'),
      end: currentMonthIso('14'),
    });
  });

  it('labels the input with the formatted range', async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole('button', { name: 'Open calendar' }));
    await userEvent.click(screen.getByRole('button', { name: currentMonthIso('10') }));
    await userEvent.click(screen.getByRole('button', { name: currentMonthIso('14') }));
    const expected = `${formatDate(currentMonthIso('10'), 'medium')} – ${formatDate(currentMonthIso('14'), 'medium')}`;
    expect(screen.getByRole('textbox')).toHaveValue(expected);
  });
});
