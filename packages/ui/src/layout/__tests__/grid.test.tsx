import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { Grid } from '../grid';

describe('Grid', () => {
  it('renders a single-column grid with a token gap by default', () => {
    const html = renderToStaticMarkup(
      <Grid>
        <span>a</span>
      </Grid>,
    );
    expect(html).toContain('grid-cols-1');
    expect(html).toContain('gap:var(--icb-space-4)');
  });

  it('applies responsive column classes', () => {
    const html = renderToStaticMarkup(
      <Grid cols={2} colsMd={4} colsLg={6} gap={2}>
        <span>a</span>
      </Grid>,
    );
    expect(html).toContain('grid-cols-2');
    expect(html).toContain('md:grid-cols-4');
    expect(html).toContain('lg:grid-cols-6');
    expect(html).toContain('gap:var(--icb-space-2)');
  });
});
