import '@testing-library/jest-dom/vitest';
// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { MoneyInput } from '../money-input';

afterEach(cleanup);

describe('MoneyInput', () => {
  it('renders the minor-unit value as a decimal draft with the currency symbol', () => {
    render(<MoneyInput value={123456} currency="USD" onChange={() => undefined} />);
    expect(screen.getByRole('textbox')).toHaveValue('1234.56');
    expect(screen.getByText('$')).toBeInTheDocument();
  });

  it('emits integer minor units as the user types', async () => {
    const onChange = vi.fn();
    render(<MoneyInput value={null} currency="USD" onChange={onChange} />);
    await userEvent.type(screen.getByRole('textbox'), '12.34');
    expect(onChange).toHaveBeenLastCalledWith(1234);
  });

  it('masks invalid characters and excess decimals', () => {
    const onChange = vi.fn();
    render(<MoneyInput value={null} currency="USD" onChange={onChange} />);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'ab9.999' } });
    expect(input).toHaveValue('9.99');
    expect(onChange).toHaveBeenLastCalledWith(999);
  });

  it('drops the separator for zero-scale currencies', () => {
    const onChange = vi.fn();
    render(<MoneyInput value={null} currency="JPY" onChange={onChange} />);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: '500.50' } });
    expect(input).toHaveValue('500');
    expect(onChange).toHaveBeenLastCalledWith(500);
  });

  it('normalises the draft on blur', () => {
    render(<MoneyInput value={540} currency="USD" onChange={() => undefined} />);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: '5.4' } });
    fireEvent.blur(input);
    expect(input).toHaveValue('5.40');
  });

  it('emits null for an empty draft', () => {
    const onChange = vi.fn();
    render(<MoneyInput value={100} currency="USD" onChange={onChange} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '' } });
    expect(onChange).toHaveBeenLastCalledWith(null);
  });
});
