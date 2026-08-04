import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { Stack } from '../stack';

describe('Stack', () => {
  it('renders a column flex container with a token gap by default', () => {
    const html = renderToStaticMarkup(
      <Stack>
        <span>a</span>
        <span>b</span>
      </Stack>,
    );
    expect(html).toContain('flex-col');
    expect(html).toContain('gap:var(--icb-space-4)');
  });

  it('applies direction, alignment, justify, wrap, and gap props', () => {
    const html = renderToStaticMarkup(
      <Stack direction="row" gap={8} align="center" justify="between" wrap>
        <span>a</span>
      </Stack>,
    );
    expect(html).toContain('flex-row');
    expect(html).toContain('items-center');
    expect(html).toContain('justify-between');
    expect(html).toContain('flex-wrap');
    expect(html).toContain('gap:var(--icb-space-8)');
  });

  it('merges a consumer className and inline style', () => {
    const html = renderToStaticMarkup(
      <Stack className="mt-6" style={{ padding: 4 }}>
        <span>a</span>
      </Stack>,
    );
    expect(html).toContain('mt-6');
    expect(html).toContain('padding:4px');
  });
});
