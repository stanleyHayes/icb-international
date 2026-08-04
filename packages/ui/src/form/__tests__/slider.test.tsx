import '@testing-library/jest-dom/vitest';
// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Slider } from '../slider';

afterEach(cleanup);

describe('Slider', () => {
  it('renders a range input with the current value shown', () => {
    render(<Slider defaultValue={40} aria-label="Monthly budget" />);
    expect(screen.getByRole('slider')).toHaveValue('40');
    expect(screen.getByText('40')).toBeInTheDocument();
  });

  it('works uncontrolled and reports changes', () => {
    const onChange = vi.fn();
    render(<Slider defaultValue={10} onChange={onChange} />);
    fireEvent.change(screen.getByRole('slider'), { target: { value: '65' } });
    expect(onChange).toHaveBeenCalledWith(65);
    expect(screen.getByRole('slider')).toHaveValue('65');
  });

  it('works controlled', () => {
    const onChange = vi.fn();
    render(<Slider value={25} onChange={onChange} />);
    fireEvent.change(screen.getByRole('slider'), { target: { value: '80' } });
    expect(onChange).toHaveBeenCalledWith(80);
    expect(screen.getByRole('slider')).toHaveValue('25');
  });

  it('formats the value bubble and respects bounds', () => {
    render(
      <Slider value={1200} min={0} max={5000} formatValue={(v) => `$${v}`} onChange={() => undefined} />,
    );
    const slider = screen.getByRole('slider');
    expect(slider).toHaveAttribute('min', '0');
    expect(slider).toHaveAttribute('max', '5000');
    expect(screen.getByText('$1200')).toBeInTheDocument();
  });

  it('can hide the value bubble', () => {
    render(<Slider value={10} showValue={false} onChange={() => undefined} />);
    expect(screen.queryByText('10')).not.toBeInTheDocument();
  });
});
