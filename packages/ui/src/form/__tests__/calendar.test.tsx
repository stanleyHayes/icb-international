import '@testing-library/jest-dom/vitest';
// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Calendar } from '../calendar';

afterEach(cleanup);

function renderCalendar(overrides: Partial<Parameters<typeof Calendar>[0]> = {}) {
  const onSelect = vi.fn();
  const onMonthChange = vi.fn();
  render(
    <Calendar
      month={new Date(2026, 2, 1)}
      onMonthChange={onMonthChange}
      onSelect={onSelect}
      selectedIso="2026-03-10"
      {...overrides}
    />,
  );
  return { onSelect, onMonthChange };
}

describe('Calendar', () => {
  it('renders the month grid with weekday headers and 42 cells', () => {
    renderCalendar();
    expect(screen.getByRole('grid')).toBeInTheDocument();
    expect(screen.getAllByRole('columnheader')).toHaveLength(7);
    expect(screen.getAllByRole('gridcell')).toHaveLength(42);
    expect(screen.getByText('March 2026')).toBeInTheDocument();
  });

  it('marks the selected day', () => {
    renderCalendar();
    expect(screen.getByRole('button', { name: '2026-03-10' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('selects a day on click', async () => {
    const { onSelect } = renderCalendar();
    await userEvent.click(screen.getByRole('button', { name: '2026-03-15' }));
    expect(onSelect).toHaveBeenCalledWith('2026-03-15');
  });

  it('changes month from the header buttons', async () => {
    const { onMonthChange } = renderCalendar();
    await userEvent.click(screen.getByRole('button', { name: 'Next month' }));
    expect(onMonthChange).toHaveBeenCalledWith(expect.any(Date));
    expect((onMonthChange.mock.calls[0]?.[0] as Date).getMonth()).toBe(3);
  });

  it('moves focus with the arrow keys and selects with Enter', async () => {
    const { onSelect } = renderCalendar();
    screen.getByRole('button', { name: '2026-03-10' }).focus();
    await userEvent.keyboard('{ArrowRight}');
    await userEvent.keyboard('{ArrowDown}');
    await userEvent.keyboard('{Enter}');
    expect(onSelect).toHaveBeenCalledWith('2026-03-18');
  });

  it('jumps a month with PageDown', async () => {
    const { onMonthChange } = renderCalendar();
    screen.getByRole('button', { name: '2026-03-10' }).focus();
    await userEvent.keyboard('{PageDown}');
    expect((onMonthChange.mock.calls[0]?.[0] as Date).getMonth()).toBe(3);
  });

  it('disables days outside the min/max bounds', () => {
    renderCalendar({ minIso: '2026-03-05', maxIso: '2026-03-20' });
    expect(screen.getByRole('button', { name: '2026-03-04' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '2026-03-21' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '2026-03-10' })).toBeEnabled();
  });

  it('highlights a range', () => {
    renderCalendar({ selectedIso: null, rangeStartIso: '2026-03-10', rangeEndIso: '2026-03-14' });
    expect(screen.getByRole('button', { name: '2026-03-10' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '2026-03-14' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '2026-03-12' }).className).toContain('primary-subtle');
  });
});
