import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { DropdownMenu, type DropdownMenuItem } from '../dropdown-menu';

const items: DropdownMenuItem[] = [
  { id: 'rename', label: 'Rename account' },
  { id: 'close', label: 'Close account', danger: true },
];

describe('DropdownMenu', () => {
  it('renders a menu-button trigger, closed by default', () => {
    const html = renderToStaticMarkup(
      <DropdownMenu trigger={<span>⋯</span>} triggerLabel="Account actions" items={items} />,
    );
    expect(html).toContain('aria-haspopup="menu"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('aria-label="Account actions"');
    expect(html).not.toContain('role="menu"');
  });

  it('keeps menu items out of the markup while closed', () => {
    const html = renderToStaticMarkup(
      <DropdownMenu trigger={<span>⋯</span>} triggerLabel="Actions" items={items} />,
    );
    expect(html).not.toContain('Rename account');
  });
});
