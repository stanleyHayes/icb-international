import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { CommandPalette, type CommandItem } from '../command-palette';

const commands: CommandItem[] = [
  { id: 'transfer', label: 'Make a transfer', group: 'Payments', shortcut: '⌘T' },
  { id: 'accounts', label: 'View accounts', group: 'Navigate' },
];

describe('CommandPalette', () => {
  it('renders nothing when closed', () => {
    expect(
      renderToStaticMarkup(
        <CommandPalette open={false} onClose={() => undefined} commands={commands} />,
      ),
    ).toBe('');
  });

  it('renders a combobox driving a grouped listbox when open', () => {
    const html = renderToStaticMarkup(
      <CommandPalette open onClose={() => undefined} commands={commands} />,
    );
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
    const html = renderToStaticMarkup(
      <CommandPalette open onClose={() => undefined} commands={commands} />,
    );
    expect(html).toContain('aria-selected="true"');
  });
});
