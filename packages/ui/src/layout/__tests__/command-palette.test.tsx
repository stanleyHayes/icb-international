import '@testing-library/jest-dom/vitest';
// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { CommandPalette, type CommandItem } from '../command-palette';

const commands: CommandItem[] = [
  { id: 'transfer', label: 'Make a transfer', group: 'Payments', shortcut: '⌘T' },
  { id: 'accounts', label: 'View accounts', group: 'Navigate' },
];

afterEach(cleanup);

describe('CommandPalette', () => {
  it('renders nothing when closed', () => {
    render(<CommandPalette open={false} onClose={() => undefined} commands={commands} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders a combobox driving a grouped listbox when open', () => {
    render(<CommandPalette open onClose={() => undefined} commands={commands} />);
    const html = document.body.innerHTML;
    expect(html).toContain('role="dialog"');
    expect(html).toContain('role="combobox"');
    expect(html).toContain('aria-expanded="true"');
    expect(html).toContain('role="listbox"');
    expect(html).toContain('role="option"');
    expect(html).toContain('aria-activedescendant');
    expect(html).toContain('Payments');
    expect(html).toContain('Make a transfer');
    expect(html).toContain('⌘T');
  });

  it('marks the first command active by default', () => {
    render(<CommandPalette open onClose={() => undefined} commands={commands} />);
    expect(document.body.innerHTML).toContain('aria-selected="true"');
  });
});
