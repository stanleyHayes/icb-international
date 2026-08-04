import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { Sidebar, type SidebarNavItem } from '../sidebar';

const items: SidebarNavItem[] = [
  { id: 'overview', label: 'Overview', href: '/' },
  { id: 'accounts', label: 'Accounts', href: '/accounts', active: true },
  { id: 'archived', label: 'Archived', href: '/archived', disabled: true },
];

describe('Sidebar', () => {
  it('renders a labelled nav landmark with all items', () => {
    const html = renderToStaticMarkup(<Sidebar items={items} />);
    expect(html).toContain('aria-label="Primary"');
    expect(html).toContain('Overview');
    expect(html).toContain('Accounts');
  });

  it('marks the active item with aria-current and puts it in the tab order', () => {
    const html = renderToStaticMarkup(<Sidebar items={items} />);
    expect(html).toContain('aria-current="page"');
    // Roving tabindex: the active item is tabbable, the others are not.
    expect(html).toMatch(/aria-current="page"[^>]*tabindex="0"|tabindex="0"[^>]*aria-current="page"/);
    expect((html.match(/tabindex="-1"/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });

  it('disables items without navigating', () => {
    const html = renderToStaticMarkup(<Sidebar items={items} />);
    expect(html).toContain('aria-disabled="true"');
    expect(html).not.toContain('href="/archived"');
  });

  it('hides labels visually when collapsed but keeps them accessible', () => {
    const html = renderToStaticMarkup(<Sidebar items={items} collapsed />);
    expect(html).toContain('sr-only');
    expect(html).toContain('width:var(--icb-sidebar-width-collapsed)');
  });

  it('renders the collapse toggle with an accessible name when collapsible', () => {
    const html = renderToStaticMarkup(<Sidebar items={items} onToggleCollapse={() => undefined} />);
    expect(html).toContain('aria-label="Collapse sidebar"');
    expect(html).toContain('aria-expanded="true"');
  });

  it('omits the toggle when no handler is provided', () => {
    expect(renderToStaticMarkup(<Sidebar items={items} />)).not.toContain('Collapse sidebar');
  });
});
