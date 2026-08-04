import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { Container } from '../container';

describe('Container', () => {
  it('caps width at the reading container token by default', () => {
    const html = renderToStaticMarkup(<Container>content</Container>);
    expect(html).toContain('max-width:var(--icb-container)');
    expect(html).toContain('mx-auto');
  });

  it('uses the wide token when requested', () => {
    const html = renderToStaticMarkup(<Container wide>content</Container>);
    expect(html).toContain('max-width:var(--icb-container-wide)');
  });
});
