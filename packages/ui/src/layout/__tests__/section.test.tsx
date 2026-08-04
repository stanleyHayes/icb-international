import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { Section } from '../section';

describe('Section', () => {
  it('renders a titled region wired with aria-labelledby', () => {
    const html = renderToStaticMarkup(
      <Section id="recent" title="Recent activity" description="Your latest transactions">
        <p>body</p>
      </Section>,
    );
    expect(html).toContain('<section');
    expect(html).toContain('aria-labelledby="recent-heading"');
    expect(html).toContain('id="recent-heading"');
    expect(html).toContain('Recent activity');
    expect(html).toContain('Your latest transactions');
  });

  it('renders actions beside the heading', () => {
    const html = renderToStaticMarkup(
      <Section id="s" title="T" actions={<button>View all</button>}>
        <p>body</p>
      </Section>,
    );
    expect(html).toContain('View all');
  });

  it('renders an untitled section without heading or aria association', () => {
    const html = renderToStaticMarkup(
      <Section>
        <p>body</p>
      </Section>,
    );
    expect(html).not.toContain('aria-labelledby');
    expect(html).not.toContain('<h2');
  });
});
