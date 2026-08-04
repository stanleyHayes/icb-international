import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { PageHeader } from '../page-header';

describe('PageHeader', () => {
  it('renders the page h1, description, breadcrumbs, and actions', () => {
    const html = renderToStaticMarkup(
      <PageHeader
        title="Accounts"
        description="Every account on the book."
        breadcrumbs={<nav>crumbs</nav>}
        actions={<button>New account</button>}
      />,
    );
    expect(html).toContain('<h1');
    expect(html).toContain('Accounts');
    expect(html).toContain('Every account on the book.');
    expect(html).toContain('crumbs');
    expect(html).toContain('New account');
  });

  it('omits optional slots cleanly', () => {
    const html = renderToStaticMarkup(<PageHeader title="Overview" />);
    expect(html).toContain('Overview');
    expect(html).not.toContain('<button');
  });
});
