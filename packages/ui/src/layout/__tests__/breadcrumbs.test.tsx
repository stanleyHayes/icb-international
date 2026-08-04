import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { Breadcrumbs } from '../breadcrumbs';

describe('Breadcrumbs', () => {
  const items = [
    { label: 'Customers', href: '/customers' },
    { label: 'Ada Lovelace', href: '/customers/ada' },
    { label: 'Accounts' },
  ];

  it('renders a labelled nav with an ordered list', () => {
    const html = renderToStaticMarkup(<Breadcrumbs items={items} />);
    expect(html).toContain('aria-label="Breadcrumb"');
    expect(html).toContain('<ol');
  });

  it('links ancestors and marks the last item as the current page', () => {
    const html = renderToStaticMarkup(<Breadcrumbs items={items} />);
    expect(html).toContain('href="/customers"');
    expect(html).toContain('aria-current="page"');
    // The current page is never a link.
    expect(html).not.toContain('href="/accounts"');
  });

  it('renders a separator between items', () => {
    const html = renderToStaticMarkup(<Breadcrumbs items={items} />);
    expect((html.match(/aria-hidden="true"/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });
});
