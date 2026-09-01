import '@testing-library/jest-dom/vitest';
// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Field } from '../field';
import { Input } from '../input';

afterEach(cleanup);

describe('Input', () => {
  it('renders with the shared control chrome at md size', () => {
    render(<Input aria-label="Name" />);
    const input = screen.getByLabelText('Name');
    expect(input.className).toContain('h-10');
    expect(input.className).toContain('rounded-[var(--radius-md)]');
  });

  it('supports typing and change handlers', async () => {
    const onChange = vi.fn();
    render(<Input aria-label="Name" onChange={onChange} />);
    await userEvent.type(screen.getByLabelText('Name'), 'Ada');
    expect(screen.getByLabelText('Name')).toHaveValue('Ada');
    expect(onChange).toHaveBeenCalled();
  });

  it('applies the danger border when invalid', () => {
    render(<Input aria-label="Name" invalid />);
    expect(screen.getByLabelText('Name').className).toContain('border-[var(--icb-danger)]');
  });

  it('forwards ref for react-hook-form register', () => {
    let element: HTMLInputElement | null = null;
    render(
      <Input
        aria-label="Name"
        ref={(node) => {
          element = node;
        }}
      />,
    );
    expect(element).toBeInstanceOf(HTMLInputElement);
  });

  it('renders small and large sizes', () => {
    const { rerender } = render(<Input aria-label="Name" size="sm" />);
    expect(screen.getByLabelText('Name').className).toContain('h-8');
    rerender(<Input aria-label="Name" size="lg" />);
    expect(screen.getByLabelText('Name').className).toContain('h-12');
  });

  it('reserves space for decorative start and end icons', () => {
    const { container } = render(
      <Input
        aria-label="Search"
        startIcon={<span data-testid="start-icon">S</span>}
        endIcon={<span data-testid="end-icon">E</span>}
      />,
    );

    const input = screen.getByLabelText('Search');
    expect(input.className).toContain('pl-10');
    expect(input.className).toContain('pr-10');
    expect(screen.getByTestId('start-icon').parentElement).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByTestId('end-icon').parentElement).toHaveAttribute('aria-hidden', 'true');
    expect(container.firstElementChild).toHaveClass('relative');
  });

  it('inherits disabled state from an enclosing Field', () => {
    render(
      <Field label="Name" disabled>
        <Input />
      </Field>,
    );
    expect(screen.getByLabelText('Name')).toBeDisabled();
  });
});
