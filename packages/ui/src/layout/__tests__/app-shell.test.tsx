import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { AppShell } from '../app-shell';

describe('AppShell', () => {
  it('renders the skip link, slots, and main landmark', () => {
    const html = renderToStaticMarkup(
      <AppShell sidebar={<aside>nav</aside>} topbar={<header>bar</header>}>
        <p>page</p>
      </AppShell>,
    );
    expect(html).toContain('Skip to content');
    expect(html).toContain('href="#main-content"');
    expect(html).toContain('id="main-content"');
    expect(html).toContain('nav');
    expect(html).toContain('bar');
    expect(html).toContain('page');
  });

  it('renders without the optional slots', () => {
    const html = renderToStaticMarkup(
      <AppShell>
        <p>page</p>
      </AppShell>,
    );
    expect(html).toContain('<main');
    expect(html).toContain('page');
  });
});
