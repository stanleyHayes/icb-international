import '@testing-library/jest-dom/vitest';
// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';

import { PasswordInput } from '../password-input';

afterEach(cleanup);

describe('PasswordInput', () => {
  it('masks the value by default and reveals it on toggle', async () => {
    render(<PasswordInput aria-label="Password" defaultValue="hunter2" />);
    const input = screen.getByLabelText('Password');
    expect(input).toHaveAttribute('type', 'password');
    await userEvent.click(screen.getByRole('button', { name: 'Show password' }));
    expect(input).toHaveAttribute('type', 'text');
    await userEvent.click(screen.getByRole('button', { name: 'Hide password' }));
    expect(input).toHaveAttribute('type', 'password');
  });

  it('shows the strength meter while typing', async () => {
    render(<PasswordInput aria-label="Password" />);
    expect(screen.queryByRole('meter')).not.toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Password'), 'Tr0ub4dor&3xtra');
    const meter = screen.getByRole('meter', { name: 'Password strength' });
    expect(meter).toHaveAttribute('aria-valuemax', '4');
    expect(Number(meter.getAttribute('aria-valuenow'))).toBeGreaterThanOrEqual(3);
  });

  it('keeps the meter out when asked', async () => {
    render(<PasswordInput aria-label="Password" showStrengthMeter={false} />);
    await userEvent.type(screen.getByLabelText('Password'), 'secret');
    expect(screen.queryByRole('meter')).not.toBeInTheDocument();
  });

  it('scores weak passwords low in the accessible text', async () => {
    render(<PasswordInput aria-label="Password" />);
    await userEvent.type(screen.getByLabelText('Password'), 'abc');
    expect(screen.getByRole('meter').getAttribute('aria-valuetext')).toMatch(/weak/i);
  });
});
