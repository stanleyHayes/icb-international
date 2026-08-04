import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { Sheet } from '../sheet';

describe('Sheet', () => {
  it('renders nothing when closed', () => {
    expect(
      renderToStaticMarkup(
        <Sheet open={false} onClose={() => undefined}>
          body
        </Sheet>,
      ),
    ).toBe('');
  });

  it('renders a right-anchored modal panel by default', () => {
    const html = renderToStaticMarkup(
      <Sheet open onClose={() => undefined} title="Filters">
        body
      </Sheet>,
    );
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain('right-0');
    expect(html).toContain('Filters');
    expect(html).toContain('aria-label="Close"');
  });

  it('anchors to other edges', () => {
    const html = renderToStaticMarkup(
      <Sheet open onClose={() => undefined} side="left">
        body
      </Sheet>,
    );
    expect(html).toContain('left-0');
  });

  it('works without a title', () => {
    const html = renderToStaticMarkup(
      <Sheet open onClose={() => undefined}>
        body
      </Sheet>,
    );
    expect(html).toContain('role="dialog"');
    expect(html).not.toContain('<h2');
  });
});
