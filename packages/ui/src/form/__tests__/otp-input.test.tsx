import '@testing-library/jest-dom/vitest';
// @vitest-environment jsdom
import { useState } from 'react';

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { OTPInput } from '../otp-input';

function Harness({
  onComplete,
  length = 6,
}: Readonly<{ onComplete?: (v: string) => void; length?: number }>) {
  const [value, setValue] = useState('');
  return <OTPInput value={value} onChange={setValue} onComplete={onComplete} length={length} />;
}

afterEach(cleanup);

describe('OTPInput', () => {
  it('renders one labelled cell per digit', () => {
    render(<Harness />);
    expect(screen.getAllByRole('textbox')).toHaveLength(6);
    expect(screen.getByLabelText('Digit 1 of 6')).toBeInTheDocument();
  });

  it('advances as digits are typed and completes', async () => {
    const onComplete = vi.fn();
    render(<Harness onComplete={onComplete} />);
    await userEvent.type(screen.getByLabelText('Digit 1 of 6'), '123456');
    expect(onComplete).toHaveBeenCalledWith('123456');
    for (const [index, digit] of ['1', '2', '3', '4', '5', '6'].entries()) {
      expect(screen.getByLabelText(`Digit ${index + 1} of 6`)).toHaveValue(digit);
    }
  });

  it('retreats on Backspace and moves with arrows', async () => {
    render(<Harness />);
    await userEvent.type(screen.getByLabelText('Digit 1 of 6'), '12');
    await userEvent.keyboard('{Backspace}');
    expect(screen.getByLabelText('Digit 2 of 6')).toHaveValue('');
    await userEvent.keyboard('{ArrowLeft}');
    expect(screen.getByLabelText('Digit 1 of 6')).toHaveFocus();
    await userEvent.keyboard('{ArrowRight}');
    expect(screen.getByLabelText('Digit 2 of 6')).toHaveFocus();
  });

  it('fans a pasted code out across the cells', () => {
    const onComplete = vi.fn();
    render(<Harness onComplete={onComplete} />);
    const first = screen.getByLabelText('Digit 1 of 6');
    first.focus();
    fireEvent.paste(first, { clipboardData: { getData: () => '9 8 7-654' } });
    expect(onComplete).toHaveBeenCalledWith('987654');
    expect(screen.getByLabelText('Digit 6 of 6')).toHaveValue('4');
  });

  it('respects a custom length', () => {
    render(<Harness length={4} />);
    expect(screen.getAllByRole('textbox')).toHaveLength(4);
  });
});
